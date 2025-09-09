// CameraAssist.jsx
//
// Simple component to start an anonymised camera assist session.  When activated,
// it sends video frames to a Web Worker (visionWorker.js) that returns hints
// such as 'blood_suspected'.  The hints are then passed to a callback.

import React, { useEffect, useRef, useState } from 'react';

export default function CameraAssist({ onHint }) {
  const videoRef = useRef(null);
  const workerRef = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (active && !workerRef.current) {
      workerRef.current = new Worker(new URL('../workers/visionWorker.js', import.meta.url), { type: 'module' });
      workerRef.current.onmessage = (e) => {
        if (e.data && e.data.type === 'hint') {
          onHint?.(e.data.hints);
        }
      };
    }
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [active, onHint]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      // Periodically send frames to the worker
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const tick = () => {
        if (!videoRef.current || !active) return;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        workerRef.current?.postMessage({ type: 'frame', data: imageData }, [imageData.data.buffer]);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch {
      // handle camera error
    }
  };

  return (
    <div>
      {!active ? (
        <button onClick={startCamera} className="bg-blue-500 text-white px-3 py-1 rounded">
          Kamera starten
        </button>
      ) : (
        <video ref={videoRef} className="hidden" />
      )}
    </div>
  );
}