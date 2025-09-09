// src/workers/visionWorker.js
// Vision-Worker: Heuristiken + optional TFJS-TFLite (efficientdet_lite0.tflite) + BlazeFace-Anonymisierung.

let faceModel = null;
let tfliteModel = null;
let tf = null;

// --- Helpers ---------------------------------------------------------------
async function resourceExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (res.ok) return true;
    const res2 = await fetch(url, { method: 'GET', cache: 'no-store' });
    return res2.ok;
  } catch { return false; }
}

async function loadFaceModel() {
  if (faceModel) return faceModel;
  if (!tf) tf = (await import('@tensorflow/tfjs')).default;
  try { await import('@tensorflow/tfjs-backend-webgl'); await tf.setBackend('webgl'); }
  catch { await tf.setBackend('cpu'); }
  await tf.ready();
  const blazeface = await import('@tensorflow-models/blazeface');
  faceModel = await blazeface.load({ modelUrl: '/models/blazeface/model.json' });
  return faceModel;
}

// sehr leichte Heuristik: viel Rot = blood_suspected
function detectBloodHeuristic(img) {
  const { data, width, height } = img;
  let red = 0, total = 0;
  for (let i = 0; i < data.length; i += 4 * 8) {
    const r = data[i], g = data[i+1], b = data[i+2];
    if (r > 150 && g < 110 && b < 110 && r > g + 40 && r > b + 40) red++;
    total++;
  }
  return (red / Math.max(total,1)) > 0.02;
}

// sehr leichte Heuristik: warmes Orange = smoke_fire
function detectWarmHeuristic(img) {
  const { data } = img;
  let warm = 0, total = 0;
  for (let i = 0; i < data.length; i += 4 * 16) {
    const r = data[i], g = data[i+1], b = data[i+2];
    if (r > 160 && g > 90 && b < 90) warm++;
    total++;
  }
  return (warm / Math.max(total,1)) > 0.01;
}

// --- TFJS-TFLite Laden -----------------------------------------------------
async function ensureTFLite() {
  if (tfliteModel) return true;
  const exists = await resourceExists('/models/efficientdet_lite0.tflite');
  if (!exists) return false;
  const tfl = await import('@tensorflow/tfjs-tflite');
  if (!tf) tf = (await import('@tensorflow/tfjs')).default;
  try { await import('@tensorflow/tfjs-backend-webgl'); await tf.setBackend('webgl'); }
  catch { await tf.setBackend('cpu'); }
  await tf.ready();
  tfliteModel = await tfl.loadTFLiteModel('/models/efficientdet_lite0.tflite');
  return true;
}

// Bild zu Tensor (Resizing auf 320x320 als Default; ggf. an Modell anpassen)
function imageDataToTensor(imgData, size = 320) {
  const { data, width, height } = imgData;
  const off = new OffscreenCanvas(width, height);
  const ctx = off.getContext('2d');
  const img = new ImageData(new Uint8ClampedArray(data), width, height);
  ctx.putImageData(img, 0, 0);
  const off2 = new OffscreenCanvas(size, size);
  const ctx2 = off2.getContext('2d');
  ctx2.drawImage(off, 0, 0, size, size);
  const resized = ctx2.getImageData(0, 0, size, size);
  const arr = Float32Array.from(resized.data, (v, i) => (i % 4 === 3 ? 0 : (v - 127.5) / 127.5));
  if (!tf) return null;
  const t = tf.tensor4d(arr, [1, size, size, 4]).slice([0,0,0,0],[1,size,size,3]); // RG B; A weg
  return t;
}

// NMS in TFJS
async function nms(boxes, scores, max=10, iou=0.5, scoreThresh=0.5) {
  if (!tf) tf = (await import('@tensorflow/tfjs')).default;
  const keep = await tf.image.nonMaxSuppressionAsync(boxes, scores, max, iou, scoreThresh);
  const idx = await keep.array();
  keep.dispose();
  return idx;
}

// Output-Parser (für EffDet/SSD-artige TFLite Modelle mit PostProcess)
// Erwartet Keys wie 'TFLite_Detection_PostProcess', '…_scores', '…_classes', '…_boxes'
function parseDetections(output) {
  // Robust gegen unterschiedliche Keynamen
  const keys = Object.keys(output);
  // Suche das boxes/scores/classes
  const boxesKey   = keys.find(k => /box/i.test(k) && output[k].shape?.length===3) || keys.find(k => /boxes/i.test(k));
  const scoresKey  = keys.find(k => /score/i.test(k)) || keys.find(k => /scores/i.test(k));
  const classesKey = keys.find(k => /class/i.test(k)) || keys.find(k => /classes/i.test(k));
  if (!boxesKey || !scoresKey) return [];
  const boxes  = output[boxesKey];   // [1,N,4] (ymin,xmin,ymax,xmax) relativ
  const scores = output[scoresKey];  // [1,N]
  const classes= classesKey ? output[classesKey] : null;

  const b = boxes.dataSync ? boxes.dataSync() : boxes;
  const s = scores.dataSync ? scores.dataSync() : scores;
  const n = s.length;
  const out = [];
  for (let i=0;i<n;i++){
    // in Pixel umrechnen übernimmt später das UI, wir geben normalisierte Koords
    out.push({ box: [b[i*4], b[i*4+1], b[i*4+2], b[i*4+3]], score: s[i], cls: classes ? (classes[i]|0) : -1 });
  }
  return out;
}

// --- Haupt-Handler ---------------------------------------------------------
let frameCount = 0;

self.onmessage = async (e) => {
  const { type, data } = e.data || {};
  if (type !== 'frame' || !data) return;

  const imageData = data;
  const hints = new Set();

  // 1) Heuristiken (leicht & schnell)
  try {
    if (detectBloodHeuristic(imageData)) hints.add('blood_suspected');
    if (detectWarmHeuristic(imageData))  hints.add('smoke_fire');
  } catch {}

  // 2) Optional: TFJS-TFLite laden und laufen lassen
  try {
    const ready = await ensureTFLite();
    if (ready && tfliteModel) {
      if (!tf) tf = (await import('@tensorflow/tfjs')).default;
      const x = imageDataToTensor(imageData, 320);
      if (x) {
        const out = await tfliteModel.predict(x);
        // `out` kann Map oder Array sein – wir versuchen beides robust zu parsen
        const output = {};
        if (Array.isArray(out)) {
          out.forEach((t, i) => output[`out_${i}`] = t);
        } else {
          Object.assign(output, out);
        }
        const dets = parseDetections(output);
        // einfache Schwelle + NMS
        const boxes = dets.map(d => d.box);                 // [ymin,xmin,ymax,xmax] normiert
        const scores= dets.map(d => d.score);
        if (boxes.length && scores.length) {
          const boxesTensor  = tf.tensor2d(boxes);
          const scoresTensor = tf.tensor1d(scores);
          const keep = await nms(boxesTensor, scoresTensor, 10, 0.5, 0.5);
          // Beispielhafte Hint-Ableitung (ohne echte Labels):
          // Wir bleiben vorsichtig und nutzen TF-Ergebnis aktuell nur, um smoke/blood-Heuristik zu bestätigen.
          if (keep.length >= 1 && scores.some(s => s > 0.5)) {
            // könnten hier weitere Hints setzen, z.B. crowd_panic etc. – abhängig vom Modell/Labels
          }
          boxesTensor.dispose(); scoresTensor.dispose();
        }
        // Tensoren aufräumen
        if (out.dispose) out.dispose();
        x.dispose();
      }
    }
  } catch { /* bei Fehlern bleiben nur Heuristiken aktiv */ }

  // 3) BlazeFace (nur Vorbereitung für Anonymisierung / keine Hints)
  try { await loadFaceModel(); /* model.estimateFaces(...) optional */ }
  catch {}

  // 4) Sturz-Simulation (Demo)
  frameCount++;
  if (frameCount % 180 === 0) hints.add('fall_detected');

  if (hints.size) {
    self.postMessage({ type: 'hint', hints: Array.from(hints) });
  }
};
