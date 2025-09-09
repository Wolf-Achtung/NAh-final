// src/workers/voiceKWS.js
//
// A tiny placeholder keyword spotter.  It increments a counter for each audio
// chunk and simulates a wake event every N chunks.  Replace this with a
// real keyword spotting model (e.g. Porcupine or Silero) for production use.

let counter = 0;
self.onmessage = (e) => {
  if (e.data && e.data.type === 'audio-chunk') {
    counter++;
    // Fire a wake event roughly every 120 chunks (~30 s at 250 ms chunk rate)
    if (counter % 120 === 0) {
      self.postMessage({ type: 'wake', keyword: 'NAH' });
    }
  }
};