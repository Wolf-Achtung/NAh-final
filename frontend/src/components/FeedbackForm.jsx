import React, { useState } from 'react';
import { logEvent } from '../lib/telemetry';

/**
 * FeedbackForm
 *
 * Ein kleines Formular, um Feedback von Nutzern zu sammeln. Nutzer können
 * eine Bewertung (1–5 Sterne) abgeben und optional einen Kommentar
 * hinterlassen. Beim Absenden wird das Feedback als Telemetrie‑Event
 * gespeichert.
 *
 * Props:
 * - open: boolean — Ob das Formular angezeigt wird.
 * - onClose: () => void — Wird aufgerufen, wenn das Formular geschlossen wird.
 */
export default function FeedbackForm({ open, onClose }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  if (!open) return null;

  const submit = () => {
    logEvent('feedback', { rating, comment });
    onClose?.();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '8px',
          width: '90%',
          maxWidth: '500px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Feedback</h3>
          <button
            onClick={() => onClose?.()}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <label>Deine Bewertung:</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            {[1, 2, 3, 4, 5].map((num) => (
              <span
                key={num}
                onClick={() => setRating(num)}
                style={{
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: num <= rating ? '#ffaa00' : '#ccc',
                }}
              >
                ★
              </span>
            ))}
          </div>
          <textarea
            placeholder="Dein Kommentar (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
          />
        </div>
        <button
          onClick={submit}
          style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#004080', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Absenden
        </button>
      </div>
    </div>
  );
}