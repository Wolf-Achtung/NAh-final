// src/lib/voicePilot.js
//
// Simple voice co‑pilot.  Starts a Web Worker with a keyword spotter that
// detects a wake word (e.g. "NAH") and notifies the caller.  It also exposes
// a basic interface to stop the pilot.

export async function startPilot(onWake) {
  const worker = new Worker(new URL('../workers/voiceKWS.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    if (e.data && e.data.type === 'wake') {
      onWake?.(e.data.keyword);
    }
  };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const media = new MediaRecorder(stream);
    media.ondataavailable = (ev) => {
      ev.data.arrayBuffer().then(buf => {
        worker.postMessage({ type: 'audio-chunk', buffer: buf }, [buf]);
      });
    };
    media.start(250);
    return { worker, media, stream };
  } catch {
    return null;
  }
}

export function stopPilot(controller) {
  if (!controller) return;
  controller.media?.stop();
  controller.stream?.getTracks().forEach(t => t.stop());
  controller.worker?.terminate();
}