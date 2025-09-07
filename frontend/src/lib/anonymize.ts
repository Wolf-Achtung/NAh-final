// src/lib/anonymize.ts
//
// Provides functionality to anonymise faces in user‑captured photos. The
// implementation uses TensorFlow.js and the BlazeFace model to
// identify faces and applies a mosaic blur over them. The model
// files must be hosted locally under /models/blazeface and
// precached by the service worker. All processing happens on the
// client; images are not uploaded to the server.

import * as blazeface from '@tensorflow-models/blazeface';
import '@tensorflow/tfjs-backend-webgl';

/**
 * Show a consent dialog. Returns true if the user accepts.
 */
export async function ensureConsent(): Promise<boolean> {
  return await new Promise((resolve) => {
    const ok = window.confirm('Foto von Verletzten nur mit deren Einverständnis. Fortfahren?');
    resolve(ok);
  });
}

/**
 * Apply a pixelated mosaic over a rectangular region in a canvas.
 * @param ctx Canvas context
 * @param x X position of region
 * @param y Y position of region
 * @param w Width of region
 * @param h Height of region
 * @param size Pixel block size
 */
function mosaic(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, size = 16) {
  const imageData = ctx.getImageData(x, y, w, h);
  const { data, width, height } = imageData;
  for (let yy = 0; yy < height; yy += size) {
    for (let xx = 0; xx < width; xx += size) {
      const i = ((yy * width) + xx) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      for (let dy = 0; dy < size && yy + dy < height; dy++) {
        for (let dx = 0; dx < size && xx + dx < width; dx++) {
          const j = (((yy + dy) * width) + (xx + dx)) * 4;
          data[j] = r;
          data[j + 1] = g;
          data[j + 2] = b;
        }
      }
    }
  }
  ctx.putImageData(imageData, x, y);
}

/**
 * Anonymise faces in an image file. Returns a JPEG blob of the
 * anonymised image. Images are processed locally and never uploaded.
 */
export async function anonymizeFile(file: File): Promise<Blob> {
  // Prüfe Einverständnis
  if (!(await ensureConsent())) {
    throw new Error('no-consent');
  }
  // Wenn Web Worker unterstützt wird, nutze ihn als Offload‑Mechanismus
  if (typeof window !== 'undefined' && 'Worker' in window) {
    try {
      return await new Promise((resolve, reject) => {
        // Worker dynamisch laden. Der Pfad wird vom Bundler angepasst.
        let worker: Worker;
        try {
          // Versuche, den Worker per URL‑Konstruktor zu laden (Webpack / Vite)
          // @ts-ignore
          worker = new Worker(new URL('../workers/anonymizeWorker.js', import.meta.url), { type: 'module' });
        } catch {
          // Fallback: statischer Stringpfad
          worker = new Worker('/src/workers/anonymizeWorker.js');
        }
        const id = Date.now();
        worker.onmessage = (ev) => {
          const { id: msgId, blob, error } = ev.data;
          if (msgId !== id) return;
          worker.terminate();
          if (error) reject(new Error(error));
          else resolve(blob);
        };
        worker.onerror = (err) => {
          worker.terminate();
          reject(err);
        };
        file.arrayBuffer().then((buf) => {
          worker.postMessage({ id, buffer: buf, type: file.type }, [buf]);
        });
      });
    } catch {
      // Wenn Worker fehlschlägt, falle zurück auf Hauptthread
    }
  }
  // Fallback: Verarbeitung im Hauptthread mit TensorFlow.js
  const img = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const model = await blazeface.load({ modelUrl: '/models/blazeface/model.json' });
  const predictions = await model.estimateFaces(canvas, false);
  predictions.forEach((p) => {
    const [x, y] = p.topLeft as [number, number];
    const [x2, y2] = p.bottomRight as [number, number];
    const w = x2 - x;
    const h = y2 - y;
    const padX = w * 0.15;
    const padY = h * 0.2;
    const mx = Math.max(0, x - padX);
    const my = Math.max(0, y - padY);
    const mw = Math.min(canvas.width - mx, w + 2 * padX);
    const mh = Math.min(canvas.height - my, h + 2 * padY);
    mosaic(ctx, mx, my, mw, mh, 20);
  });
  return await new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9);
  });
}