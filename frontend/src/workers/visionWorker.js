// src/workers/visionWorker.js
//
// Vision-Worker: Heuristiken + optional TFJS-TFLite (efficientdet_lite0.tflite) + Hooks für MediaPipe/ONNX.
// Läuft vollständig offline; sendet nur Hint-Labels zurück. Keine Bilddaten nach außen.

let tf = null;                 // tfjs Kern wird lazy geladen
let tfliteModel = null;        // tfjs-tflite Modell
let mpReady = false;           // MediaPipe-Task-Hook (optional)
let mpObjectDetector = null;
let onnxReady = false;         // ONNX-Hook (optional)
let onnxSession = null;
let onnxLabels = [];

// ---------- Utils ----------

async function resourceExists(url) {
  try {
    const h = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (h.ok) return true;
    const g = await fetch(url, { method: 'GET', cache: 'no-store' });
    return g.ok;
  } catch { return false; }
}

async function ensureTF() {
  if (tf) return;
  tf = (await import('@tensorflow/tfjs')).default;
  try { await import('@tensorflow/tfjs-backend-webgl'); await tf.setBackend('webgl'); }
  catch { await tf.setBackend('cpu'); }
  await tf.ready();
}

// ---------- TFJS-TFLite ----------

async function ensureTFLite() {
  if (tfliteModel) return true;
  const exists = await resourceExists('/models/efficientdet_lite0.tflite');
  if (!exists) return false;
  const tfl = await import('@tensorflow/tfjs-tflite');
  await ensureTF();
  tfliteModel = await tfl.loadTFLiteModel('/models/efficientdet_lite0.tflite');
  return true;
}

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

  // Normalize to [-1, 1]; strip alpha
  const arr = Float32Array.from(resized.data, (v, i) => (i % 4 === 3 ? 0 : (v - 127.5) / 127.5));
  const t4 = tf.tensor4d(arr, [1, size, size, 4]).slice([0, 0, 0, 0], [1, size, size, 3]);
  return t4;
}

async function nms(boxes, scores, max = 10, iou = 0.5, thr = 0.5) {
  const keep = await tf.image.nonMaxSuppressionAsync(boxes, scores, max, iou, thr);
  const out = await keep.array();
  keep.dispose();
  return out;
}

function parseEffDetOutput(out) {
  // robust gegen Map/Array
  const output = {};
  if (Array.isArray(out)) out.forEach((t, i) => output[`out_${i}`] = t);
  else Object.assign(output, out);

  const keys = Object.keys(output);
  const boxesKey   = keys.find(k => /box/i.test(k)    && output[k].shape?.length === 3) || keys.find(k => /boxes/i.test(k));
  const scoresKey  = keys.find(k => /score/i.test(k)) || keys.find(k => /scores/i.test(k));
  const classesKey = keys.find(k => /class/i.test(k)) || keys.find(k => /classes/i.test(k));
  if (!boxesKey || !scoresKey) return [];

  const boxes  = output[boxesKey];   // [1,N,4] (ymin,xmin,ymax,xmax) normiert
  const scores = output[scoresKey];  // [1,N]
  const classes= classesKey ? output[classesKey] : null;

  const b = boxes.dataSync ? boxes.dataSync() : boxes;
  const s = scores.dataSync ? scores.dataSync() : scores;
  const n = s.length;
  const dets = [];
  for (let i = 0; i < n; i++) {
    dets.push({ box: [b[i*4], b[i*4+1], b[i*4+2], b[i*4+3]], score: s[i], cls: classes ? (classes[i]|0) : -1 });
  }
  return dets;
}

// ---------- Heuristiken ----------

function hintBlood(img) {
  const { data } = img;
  let red = 0, total = 0;
  for (let i = 0; i < data.length; i += 32) {
    const r = data[i], g = data[i+1], b = data[i+2];
    if (r > 150 && g < 110 && b < 110 && r > g + 40 && r > b + 40) red++;
    total++;
  }
  return (red / Math.max(total,1)) > 0.02;
}

function hintWarm(img) {
  const { data } = img;
  let warm = 0, total = 0;
  for (let i = 0; i < data.length; i += 64) {
    const r = data[i], g = data[i+1], b = data[i+2];
    if (r > 160 && g > 90 && b < 90) warm++;
    total++;
  }
  return (warm / Math.max(total,1)) > 0.01;
}

function hintAED(img) {
  const { data } = img;
  let green = 0, total = 0;
  for (let i = 0; i < data.length; i += 32) {
    const r = data[i], g = data[i+1], b = data[i+2];
    if (g > 150 && g > r + 20 && g > b + 20) green++;
    total++;
  }
  return (green / Math.max(total,1)) > 0.015;
}

// ---------- MediaPipe / ONNX Hooks (optional, derzeit no-op) ----------

async function initMediaPipe() {
  if (mpObjectDetector || mpReady) return;
  const taskUrl = '/models/mediapipe/object_detector.task';
  if (!(await resourceExists(taskUrl))) { mpReady = true; return; }
  try {
    const vision = await import('@mediapipe/tasks-vision');
    const fileset = await vision.FilesetResolver.forVisionTasks('/models/mediapipe/');
    mpObjectDetector = await vision.ObjectDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: taskUrl },
      scoreThreshold: 0.5,
    });
    mpReady = true;
  } catch { mpObjectDetector = null; mpReady = true; }
}

async function initOnnx() {
  if (onnxReady || onnxSession) return;
  const url = '/models/onnx/model.onnx';
  if (!(await resourceExists(url))) { onnxReady = true; return; }
  try {
    const ort = await import('onnxruntime-web');
    onnxSession = await ort.InferenceSession.create(url, { executionProviders: ['wasm'] });
    try {
      const res = await fetch('/models/onnx/labels.txt', { cache: 'no-store' });
      if (res.ok) onnxLabels = (await res.text()).split('\n').map(s=>s.trim()).filter(Boolean);
    } catch {}
    onnxReady = true;
  } catch { onnxSession = null; onnxReady = true; }
}

// ---------- Main ----------

let frameCount = 0;

self.onmessage = async (e) => {
  const { type, data } = e.data || {};
  if (type === 'init') {
    // Optionales Vorladen
    await Promise.allSettled([ensureTFLite(), initMediaPipe(), initOnnx()]);
    return;
  }
  if (type !== 'frame' || !data) return;

  const img = data;
  const hints = new Set();

  // Heuristiken
  try { if (hintBlood(img)) hints.add('blood_suspected'); } catch {}
  try { if (hintWarm(img))  hints.add('smoke_fire'); } catch {}
  try { if (hintAED(img))   hints.add('aed_icon'); } catch {}

  // Platzhalter-Sturz
  frameCount++; if (frameCount % 180 === 0) hints.add('fall_detected');

  // Optional: TFJS-TFLite
  try {
    const ready = await ensureTFLite();
    if (ready && tfliteModel) {
      await ensureTF();
      const x = imageDataToTensor(img, 320);
      const out = await tfliteModel.predict(x);
      const dets = parseEffDetOutput(out);
      if (dets.length) {
        const boxes = tf.tensor2d(dets.map(d => d.box));
        const scores= tf.tensor1d(dets.map(d => d.score));
        const keep  = await nms(boxes, scores, 10, 0.5, 0.5);
        // Beispiel: hier könnten künftige Labels → Hints gemappt werden
        boxes.dispose(); scores.dispose();
        // (Wir lassen Hints aktuell konservativ bei den Heuristiken.)
      }
      if (out && out.dispose) out.dispose();
      x.dispose();
    }
  } catch {}

  if (hints.size) self.postMessage({ type: 'hint', hints: Array.from(hints) });
};
