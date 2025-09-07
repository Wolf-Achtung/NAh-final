// src/lib/voice.ts
//
// Simple voice helper for the NAh‑final app. This module wraps the
// native Web Speech API when available and falls back to a local
// push‑to‑talk recording that is sent to a speech‑to‑text backend.
//
// The fallback mechanism uses the MediaRecorder API to capture audio
// and POST it to `/api/stt` as a FormData payload. The server side
// route should handle WebM audio and transcribe it with a model such
// as Whisper. See server/routes/stt.ts for a sample implementation.
//
// Usage example:
//
// import { createVoice } from "@/lib/voice";
// const voice = createVoice({
//   onPartial: (text) => console.log("partial", text),
//   onFinal: (text) => console.log("final", text),
//   onError: (err) => console.error(err)
// });
// button.addEventListener('pointerdown', voice.start);
// button.addEventListener('pointerup', voice.stop);

export interface VoiceOptions {
  /** Called with partial transcripts when using the built‑in SpeechRecognition */
  onPartial?: (text: string) => void;
  /** Called when a final transcript is available */
  onFinal: (text: string) => void;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
}

export function createVoice(opts: VoiceOptions) {
  // Check if the browser provides the Web Speech API. Some mobile
  // browsers (iOS Safari/Chrome) do not support it, in which case we
  // fall back to a simple push‑to‑talk recording.
  const hasSpeechRec = typeof (window as any).SpeechRecognition !== 'undefined' ||
    typeof (window as any).webkitSpeechRecognition !== 'undefined';

  let rec: any = null;
  let mediaRec: MediaRecorder | null = null;
  let chunks: BlobPart[] = [];
  let stopped = true;

  async function start() {
    stopped = false;
    // Native SpeechRecognition path
    if (hasSpeechRec) {
      try {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        rec = new SR();
        rec.lang = document.documentElement.lang || 'de-DE';
        rec.interimResults = true;
        rec.continuous = true;
        rec.onresult = (e: any) => {
          const result = e.results[e.results.length - 1];
          const transcript = result[0].transcript.trim();
          if (result.isFinal) {
            opts.onFinal(transcript);
          } else {
            opts.onPartial?.(transcript);
          }
        };
        rec.onerror = (e: any) => {
          // On error, stop recognition and forward the error
          try {
            rec.stop();
          } catch {
            /* noop */
          }
          opts.onError?.(new Error(e.error || 'speech-recognition-error'));
        };
        rec.start();
        return;
      } catch (err: any) {
        // If starting SpeechRecognition fails, fall back to media recording
        opts.onError?.(err);
      }
    }
    // Fallback push‑to‑talk: record audio and send to server
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      mediaRec = new MediaRecorder(stream);
      chunks = [];
      mediaRec.ondataavailable = (ev: BlobEvent) => {
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
        } catch (e: any) {
          opts.onError?.(e);
        }
      };
      mediaRec.start();
    } catch (e: any) {
      opts.onError?.(e);
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