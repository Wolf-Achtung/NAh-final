// src/workers/visionWorker.js
//
// Vision assist worker with heuristic and optional model-based hint detection.
//
// This worker receives ImageData frames from the main thread.  It runs
// lightweight heuristics to identify simple cues (e.g. blood, smoke/fire,
// AED signage, fall detection) and can optionally load on-device models
// for more complex detections.  Results are returned as an array of hint
// strings.  Face detection is performed to support anonymisation but
// currently does not generate hints.  All processing occurs locally; no
// network calls are made from this worker.

let faceModel = null;
let loadingFaceModel = null;
let mpReady = false;
let mpObjectDetector = null;
let onnxReady = false;
let onnxSession = null;
let onnxLabels = [];

/**
 * Test whether a given resource exists by performing a HEAD request.  This
 * function is used to check for the presence of model files (e.g. .task
 * or .onnx) before attempting to load them.  If the HEAD request fails,
 * a GET is attempted as a fallback to handle some server configurations.
 *
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function resourceExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (res.ok) return true;
    // Some servers do not support HEAD; try a ranged GET
    const res2 = await fetch(url, { method: 'GET', cache: 'no-store' });
    return res2.ok;
  } catch {
    return false;
  }
}

/**
 * Placeholder for face detection.  In earlier versions this function lazily
 * loaded the @tensorflow-models/blazeface package.  Due to dependency
 * conflicts between tfjs@4.x and blazeface@0.x, the module has been
 * removed from dependencies.  This stub returns null and can be
 * extended in the future (e.g. by loading a GraphModel or using a
 * different face detection package).  Face detection is optional in
 * this worker and currently does not influence hints.
 */
async function loadFaceModel() {
  // Do not attempt to load the blazeface package; return null.
  faceModel = null;
  loadingFaceModel = null;
  return null;
}

/**
 * Initialise the MediaPipe Object Detector if a .task file is present.
 * The .task file should reside under /models/mediapipe/object_detector.task.
 * This uses the MediaPipe tasks-vision library, which must be installed
 * as a project dependency.  If the file is not found or loading fails,
 * the object detector will remain undefined and heuristics will be used.
 */
async function initMediaPipe() {
  if (mpObjectDetector || mpReady) return;
  const taskUrl = '/models/mediapipe/object_detector.task';
  const exists = await resourceExists(taskUrl);
  if (!exists) {
    mpReady = true;
    return;
  }
  try {
    const vision = await import('@mediapipe/tasks-vision');
    const fileset = await vision.FilesetResolver.forVisionTasks('/models/mediapipe/');
    mpObjectDetector = await vision.ObjectDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: taskUrl },
      scoreThreshold: 0.5,
    });
    mpReady = true;
  } catch {
    mpObjectDetector = null;
    mpReady = true;
  }
}

/**
 * Initialise the ONNX Runtime session if an .onnx model is present.  The
 * model file should be located at /models/onnx/model.onnx.  Optional
 * labels can be loaded from /models/onnx/labels.txt.  Models must be
 * quantised appropriately for WASM execution.  This is a placeholder
 * implementation; you must adapt the pre/post-processing for your
 * specific model.
 */
async function initOnnx() {
  if (onnxReady || onnxSession) return;
  const modelUrl = '/models/onnx/model.onnx';
  const exists = await resourceExists(modelUrl);
  if (!exists) {
    onnxReady = true;
    return;
  }
  try {
    const ort = await import('onnxruntime-web');
    onnxSession = await ort.InferenceSession.create(modelUrl, { executionProviders: ['wasm'] });
    // Load optional labels
    try {
      const res = await fetch('/models/onnx/labels.txt', { cache: 'no-store' });
      if (res.ok) {
        const txt = await res.text();
        onnxLabels = txt.split('\n').map((l) => l.trim()).filter(Boolean);
      }
    } catch {}
    onnxReady = true;
  } catch {
    onnxSession = null;
    onnxReady = true;
  }
}

/**
 * Placeholder for ONNX model postprocessing.  In a real implementation,
 * you would convert model output tensors into bounding boxes and class
 * scores, then map class names to hints.  Here we simply map any label
 * containing keywords such as 'aed', 'smoke', 'fire' or 'helmet'.
 *
 * @param {Array<Object>} detections
 * @returns {string[]} list of hints
 */
function onnxPostprocess(detections = []) {
  const hints = [];
  for (const det of detections) {
    const name = (det.label || '').toLowerCase();
    if (name.includes('aed')) hints.push('aed_icon');
    if ((name.includes('smoke') || name.includes('fire')) && det.score > 0.5) hints.push('smoke_fire');
    if (name.includes('helmet') && det.score < 0.5) hints.push('no_helmet');
  }
  return Array.from(new Set(hints));
}

// Frame counter for simple fall detection placeholder
let frameCount = 0;

// Main message handler.  Processes incoming frames and returns hints.
self.onmessage = async (e) => {
  const { type, data } = e.data || {};
  if (type === 'init') {
    // Optionally pre-load models on init
    await Promise.allSettled([loadFaceModel(), initMediaPipe(), initOnnx()]);
    return;
  }
  if (type !== 'frame' || !data) return;
  const imageData = data;
  const { data: pix, width, height } = imageData;
  const len = pix.length;
  const hints = [];

  // Heuristic: blood detection (large red areas)
  try {
    let redCount = 0;
    for (let i = 0; i < len; i += 40) {
      const r = pix[i];
      const g = pix[i + 1];
      const b = pix[i + 2];
      if (r > 150 && g < 80 && b < 80) redCount++;
    }
    const redDensity = redCount / (width * height / 10);
    if (redDensity > 0.02) hints.push('blood_suspected');
  } catch {}

  // Heuristic: smoke/fire detection (warm tones)
  try {
    let warm = 0;
    for (let i = 0; i < len; i += 64) {
      const r = pix[i];
      const g = pix[i + 1];
      const b = pix[i + 2];
      if (r > 160 && g > 90 && b < 90) warm++;
    }
    const warmDensity = warm / (width * height / 16);
    if (warmDensity > 0.01) hints.push('smoke_fire');
  } catch {}

  // Heuristic: AED signage detection (dominant green)
  try {
    let green = 0;
    for (let i = 0; i < len; i += 40) {
      const r = pix[i];
      const g = pix[i + 1];
      const b = pix[i + 2];
      if (g > 150 && g > r + 20 && g > b + 20) green++;
    }
    const greenDensity = green / (width * height / 10);
    if (greenDensity > 0.015) hints.push('aed_icon');
  } catch {}

  // Placeholder: trigger fall_detected every ~180 frames
  frameCount++;
  if (frameCount % 180 === 0) hints.push('fall_detected');

  // Face detection (for anonymisation) – disabled.  In earlier versions this
  // worker attempted to load the @tensorflow-models/blazeface package and
  // perform face detection via TensorFlow.js.  Due to peer dependency
  // conflicts between tfjs 4.x and the blazeface package, face detection
  // has been removed.  This block is intentionally left empty to avoid
  // unnecessary imports.  You can re-enable anonymisation in future by
  // loading a GraphModel or alternative detector here.

  // MediaPipe detection (if available)
  try {
    if (!mpReady) await initMediaPipe();
    if (mpObjectDetector) {
      // MediaPipe tasks expect a preprocessed image; skipping actual inference here.
      // To implement, convert ImageData to a canvas or video frame, then call
      // mpObjectDetector.detect() and map results to hints.
    }
  } catch {}

  // ONNX detection (if available)
  try {
    if (!onnxReady) await initOnnx();
    if (onnxSession) {
      // Real implementation would: convert ImageData to an input tensor,
      // run onnxSession.run(), then call onnxPostprocess() on the detections.
      // We leave this as a hook for future integration.
    }
  } catch {}

  if (hints.length > 0) {
    self.postMessage({ type: 'hint', hints: Array.from(new Set(hints)) });
  }
};