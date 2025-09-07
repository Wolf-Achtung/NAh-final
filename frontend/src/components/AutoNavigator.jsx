import React, { useState, useRef } from 'react';

/**
 * AutoNavigator – erkennt anhand einer freien Beschreibung, welche
 * Gefahrenkategorie am besten passt, und ruft onNavigate mit dem
 * ermittelten Slug auf.  Dadurch kann der Nutzer in Stresssituationen
 * ohne Suche schnell in den passenden Entscheidungsbaum springen.
 *
 * Props:
 * - onNavigate(slug: string): Callback zum Öffnen des Baums
 * - lang: 'de' | 'en' | ... (optional)
 */
export default function AutoNavigator({ onNavigate, lang = 'de' }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // State for voice recognition.  When true, we are currently listening.
  const [listening, setListening] = useState(false);
  // Keep a reference to the recognition instance so it can be stopped
  const recognitionRef = useRef(null);

  const handleAuto = async () => {
    const desc = text.trim();
    if (!desc) return;
    setLoading(true);
    setError(null);
    const baseUrl = process.env.REACT_APP_BACKEND_URL || '';
    try {
      const resp = await fetch(`${baseUrl}/api/auto-navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        const msg = data.detail || data.error || (lang === 'de' ? 'Fehler beim Auto-Navigator' : 'Auto navigator error');
        throw new Error(msg);
      }
      const slug = data.slug;
      if (slug) {
        onNavigate?.(slug);
      } else {
        setError(lang === 'de' ? 'Keine passende Kategorie gefunden.' : 'No matching category found.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Start voice recognition using the Web Speech API.  The recognised
   * phrase will be written into the input field and die
   * Auto‑Navigator wird danach automatisch ausgeführt.  Wenn der
   * Browser die SpeechRecognition API nicht unterstützt, wird
   * listening nicht aktiviert und das Feature bleibt ohne Effekt.
   */
  const handleVoice = () => {
    // If we're already listening, ignore the click
    if (listening) {
      return;
    }
    // Check for browser support
    const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SpeechRecognition) {
      setError(lang === 'de' ? 'Spracherkennung wird von diesem Browser nicht unterstützt.' : 'Speech recognition is not supported by this browser.');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = lang === 'de' ? 'de-DE' : 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;
      setListening(true);
      setError(null);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setText(transcript);
        // Execute auto navigation with the recognised text
        setTimeout(() => {
          handleAuto();
        }, 100);
      };
      recognition.onend = () => {
        setListening(false);
      };
      recognition.onerror = (event) => {
        setListening(false);
        setError(event.error || (lang === 'de' ? 'Fehler bei der Spracherkennung' : 'Speech recognition error'));
      };
      recognition.start();
    } catch (err) {
      setListening(false);
      setError(err.message);
    }
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={lang === 'de' ? 'Gefahr beschreiben…' : 'Describe the hazard…'}
        style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
      />
      {/* Mikrofon-Schaltfläche für Spracherkennung.  Aktiviert die
          Web‑Speech‑API, wenn verfügbar.  Während der Erkennung
          wird der Button deaktiviert und zeigt eine andere Farbe an. */}
      <button
        onClick={handleVoice}
        disabled={loading || listening}
        title={lang === 'de' ? 'Spracheingabe starten' : 'Start voice input'}
        style={{ marginTop: '0.5rem', marginLeft: '0.5rem', padding: '0.5rem', border: 'none', borderRadius: '6px', background: listening ? '#6b7280' : '#10b981', color: '#fff', cursor: 'pointer' }}
      >
        {listening ? (lang === 'de' ? 'Höre…' : 'Listening…') : '🎙️'}
      </button>
      <button
        onClick={handleAuto}
        disabled={loading}
        style={{ marginTop: '0.5rem', padding: '0.5rem 1rem', background: '#0a3a72', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
      >
        {loading ? (lang === 'de' ? 'Suche…' : 'Searching…') : (lang === 'de' ? 'Auto‑Navigator' : 'Auto Navigator')}
      </button>
      {error && <div style={{ color: 'red', marginTop: '0.5rem' }}>{error}</div>}
    </div>
  );
}