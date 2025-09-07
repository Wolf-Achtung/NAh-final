// src/lib/assist.ts
//
// Helper functions for text‑to‑speech and haptic feedback. These can
// operate offline using the Web Speech API when available. For
// critical prompts such as calling emergency services, a fallback
// audio file can be played. Haptic feedback (vibration) helps
// maintain compression rhythm during CPR.

/** Speak a given text. Returns true if speech synthesis was used. */
export function speak(text: string, lang = 'de-DE'): boolean {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
    return true;
  }
  // Fallback: play a preloaded audio file (e.g. call-112.mp3)
  const audio = new Audio('/audio/call-112.mp3');
  audio.play().catch(() => {});
  return false;
}

let cprTimer: any = null;

/** Start vibrations at the given BPM. For example, 110 BPM for CPR. */
export function startCprHaptics(bpm = 110) {
  if (!('vibrate' in navigator)) return;
  const interval = Math.round(60000 / bpm);
  stopCprHaptics();
  cprTimer = setInterval(() => {
    navigator.vibrate([50]);
  }, interval);
}

/** Stop ongoing vibration feedback. */
export function stopCprHaptics() {
  if (cprTimer) clearInterval(cprTimer);
  cprTimer = null;
}