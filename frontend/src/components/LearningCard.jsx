import React, { useState } from 'react';

/**
 * LearningCard
 *
 * Dieses Overlay zeigt interaktive Lernkarten an, die kurze
 * Schritt‑für‑Schritt‑Anleitungen oder Videos enthalten können.  Die
 * Karten werden über die cards‑Prop übergeben. Jede Karte hat die
 * Eigenschaften title, body und optional videoSrc oder imgSrc.  Es
 * wird ein einfacher Next/Previous‑Navigationsmechanismus bereit
 * gestellt.  Wenn der Browser kein Video abspielen kann, wird
 * fallbackmässig der Text dargestellt.
 *
 * Props:
 * - cards: Array<{ title: string, body: string, videoSrc?: string, imgSrc?: string }>
 * - onClose: Funktion zum Schließen des Overlays
 */
export default function LearningCard({ cards = [], onClose }) {
  const [index, setIndex] = useState(0);
  if (!cards || cards.length === 0) return null;
  const card = cards[index];
  const hasPrev = index > 0;
  const hasNext = index < cards.length - 1;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 4000,
      }}
      onClick={(e) => {
        // Close when clicking outside the card
        if (e.target === e.currentTarget) {
          onClose?.();
        }
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
          <h3 style={{ margin: 0 }}>{card.title || 'Lernkarte'}</h3>
          <button onClick={() => onClose?.()} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ marginTop: '1rem' }}>
          {/* Video, Bild oder nur Text anzeigen */}
          {card.videoSrc ? (
            <video
              controls
              style={{ width: '100%', borderRadius: '4px', marginBottom: '1rem' }}
            >
              <source src={card.videoSrc} type="video/mp4" />
              Ihr Browser unterstützt das Videoformat nicht.
            </video>
          ) : card.imgSrc ? (
            <img
              src={card.imgSrc}
              alt=""
              style={{ width: '100%', borderRadius: '4px', marginBottom: '1rem' }}
            />
          ) : null}
          {card.body && (
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{card.body}</div>
          )}
        </div>
        {/* Navigation buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
          <button
            onClick={() => hasPrev && setIndex(index - 1)}
            disabled={!hasPrev}
            style={{ padding: '0.5rem 1rem', background: hasPrev ? '#004080' : '#ccc', color: '#fff', border: 'none', borderRadius: '4px', cursor: hasPrev ? 'pointer' : 'default' }}
          >
            ‹ {card.prevLabel || 'Zurück'}
          </button>
          <button
            onClick={() => hasNext ? setIndex(index + 1) : onClose?.()}
            style={{ padding: '0.5rem 1rem', background: '#004080', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {hasNext ? (card.nextLabel || 'Weiter') : (card.closeLabel || 'Fertig')}
          </button>
        </div>
      </div>
    </div>
  );
}