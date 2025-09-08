// src/lib/voice.js
//
// Simple voice helper for the NAh‑final app. This module wraps the
// native Web Speech API when available and falls back to a local
// push‑to‑talk recording that is sent to a speech‑to‑text backend.
//
// The fallback mechanism uses the MediaRecorder API to capture audio
// and POST it to `/api/stt` as a FormData payload. The server side
// route should handle WebM audio and transcribe it with a model such
// as Whisper. See server/routes/stt.ts for a sample implementation.

/**
 * Create a voice recorder interface. The returned object has start()
 * and stop() methods. Options may include callbacks for partial
 * transcripts, final transcripts and errors.
 *
 * @param {Object} opts
 * @param {function(string):void} [opts.onPartial] - Called with partial results.
 * @param {function(string):void} opts.onFinal - Called with the final transcript.
 * @param {function(Error):void} [opts.onError] - Called on error.
 */
export function createVoice(opts) {
  // Check if the browser provides the Web Speech API. Some mobile
  // browsers (iOS Safari/Chrome) do not support it, in which case we
  // fall back to a simple push‑to‑talk recording.
  const hasSpeechRec =
    typeof window.SpeechRecognition !== 'undefined' ||
    typeof window.webkitSpeechRecognition !== 'undefined';

  let rec = null;
  let mediaRec = null;
  let chunks = [];
  let stopped = true;

  async function start() {
    stopped = false;
    // Native SpeechRecognition path
    if (hasSpeechRec) {
      try {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        rec = new SR();
        rec.lang = document.documentElement.lang || 'de-DE';
        rec.interimResults = true;
        rec.continuous = true;
        rec.onresult = (e) => {
          const result = e.results[e.results.length - 1];
          const transcript = result[0].transcript.trim();
          if (result.isFinal) {
            opts.onFinal(transcript);
          } else if (opts.onPartial) {
            opts.onPartial(transcript);
          }
        };
        rec.onerror = (e) => {
          try {
            rec.stop();
          } catch {
            /* noop */
          }
          if (opts.onError) opts.onError(new Error(e.error || 'speech-recognition-error'));
        };
        rec.start();
        return;
      } catch (err) {
        // If starting SpeechRecognition fails, fall back to media recording
        if (opts.onError) opts.onError(err);
      }
    }
    // Fallback push‑to‑talk: record audio and send to server
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false
      });
      mediaRec = new MediaRecorder(stream);
      chunks = [];
      mediaRec.ondataavailable = (ev) => {
        chunks.push(ev.data);
      };
      mediaRec.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const fd = new FormData();
          fd.append('file', blob, 'voice.webm');
          fd.append('lang', document.documentElement.lang || 'de');
          const res = await fetch('/api/stt', { method: 'POST', body: fd });
          const json = await res.json();
          const text = (json.text || '').trim();
          if (!stopped) {
            opts.onFinal(text);
          }
        } catch (e) {
          if (opts.onError) opts.onError(e);
        }
      };
      mediaRec.start();
    } catch (e) {
      if (opts.onError) opts.onError(e);
    }
  }

  function stop() {
    stopped = true;
    if (hasSpeechRec && rec) {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      rec = null;
      return;
    }
    if (mediaRec && mediaRec.state !== 'inactive') {
      mediaRec.stop();
    }
  }

  return { start, stop };
}