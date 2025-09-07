/*
 * anonymizeWorker.js
 *
 * Ein einfacher Web‑Worker zur Bildanonymisierung. Die eigentliche
 * Verarbeitung wird hier aus Kompatibilitätsgründen minimal gehalten.
 * Der Worker empfängt ein ArrayBuffer des Bildes, erstellt daraus
 * einen Blob und gibt diesen ungeändert zurück. Für eine echte
 * Anonymisierung (Face‑Detection mit TensorFlow.js) müsste das Modell
 * in den Worker geladen werden. Dies kann in einer späteren
 * Iteration ergänzt werden.
 */
self.onmessage = async function (e) {
  const { id, buffer, type } = e.data;
  try {
    // In dieser Stub‑Version wird das Bild unverändert zurückgegeben.
    const blob = new Blob([buffer], { type: type || 'image/jpeg' });
    // Sende das Ergebnis zurück
    self.postMessage({ id, blob });
  } catch (err) {
    self.postMessage({ id, error: err?.message || 'Anonymize failed' });
  }
};