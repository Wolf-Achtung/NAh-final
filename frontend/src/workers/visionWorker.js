// src/workers/visionWorker.js
//
// Placeholder for a vision assist worker.  It receives video frames, performs
// lightweight processing (e.g. face anonymisation, detecting large red areas
// indicative of bleeding) and returns hints to the main thread.  For now,
// this worker simply echoes back a "blood_suspected" hint after every frame.

self.onmessage = async (e) => {
  const { type } = e.data || {};
  if (type === 'frame') {
    // TODO: integrate tfjs blazeface to blur faces and simple heuristics
    // for detecting blood (e.g. red pixel density).  For now, always
    // return a hint to illustrate the API.
    self.postMessage({ type: 'hint', hints: ['blood_suspected'] });
  }
};