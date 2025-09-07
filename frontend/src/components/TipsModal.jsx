import React from 'react';

/**
 * TipsModal
 *
 * Zeigt eine Liste von Tipps für eine bestimmte Gefahrenkategorie an.
 * Die Tipps werden als Array von Zeichenketten übergeben. Das Modal
 * schließt sich, wenn der Nutzer außerhalb klickt oder auf "Schließen" klickt.
 *
 * Props:
 * - open: boolean — Ob das Modal angezeigt wird.
 * - tips: string[] — Die Tipps, die angezeigt werden sollen.
 * - onClose: () => void — Wird aufgerufen, wenn das Modal geschlossen werden soll.
 */
export default function TipsModal({ open, tips = [], onClose }) {
  if (!open) return null;
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
          maxWidth: '600px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Tipps</h3>
          <button
            onClick={() => onClose?.()}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
        <ul style={{ marginTop: '1rem', paddingLeft: '1.5rem' }}>
          {tips.map((tip, idx) => (
            <li key={idx} style={{ marginBottom: '0.75rem', lineHeight: '1.4' }}>{tip}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}