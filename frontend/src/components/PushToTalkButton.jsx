// src/components/PushToTalkButton.jsx
//
// React component for a push‑to‑talk button. Uses the voice helper
// to capture speech via SpeechRecognition or MediaRecorder fallback.
// iOS browsers do not support continuous speech recognition, so the
// fallback will be used. The component visually reflects the
// recording state and provides accessible labels.

import React, { useEffect, useState } from 'react';
import { createVoice } from '../lib/voice';

const PushToTalkButton = ({ onTranscript, onPartial, onError }) => {
  const [active, setActive] = useState(false);
  const [voice, setVoice] = useState(null);
  useEffect(() => {
    const opts = {
      onPartial: (t) => {
        if (onPartial) onPartial(t);
      },
      onFinal: (t) => {
        onTranscript(t);
      },
      onError: (e) => {
        if (onError) onError(e);
      }
    };
    setVoice(createVoice(opts));
  }, [onTranscript, onPartial, onError]);
  const handlePress = () => {
    if (!voice) return;
    setActive(true);
    voice.start();
  };
  const handleRelease = () => {
    if (!voice) return;
    setActive(false);
    voice.stop();
  };
  return (
    <button
      type="button"
      className={`w-full max-w-xs py-4 px-6 rounded-full shadow-md transition-colors ${
        active ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'
      }`}
      onMouseDown={handlePress}
      onMouseUp={handleRelease}
      onTouchStart={(e) => {
        e.preventDefault();
        handlePress();
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        handleRelease();
      }}
      aria-pressed={active}
    >
      {active ? 'Aufnahme läuft…' : 'Zum Sprechen halten'}
    </button>
  );
};

export default PushToTalkButton;