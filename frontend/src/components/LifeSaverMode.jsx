import React, { useState, useEffect } from 'react';

/**
 * LifeSaverMode – Schritt-für-Schritt-Anzeige des Entscheidungsbaums mit
 * großen Schaltflächen und optionaler Text‑to‑Speech.  Die Komponente
 * zeigt nacheinander die Texte der Knoten an und erlaubt das
 * Weiterschalten per Button oder optional per Lautstärketaste (nicht
 * implementiert).  Bei Erreichen des Endes kann die Ansicht
 * geschlossen werden.
 *
 * Props:
 * - tree: Entscheidungsbaum als Objekt (siehe API)
 * - onClose: Callback zum Schließen
 * - lang: 'de' | 'en' | ... (optional)
 */
export default function LifeSaverMode({ tree, onClose, lang = 'de' }) {
  const [currentId, setCurrentId] = useState(null);
  const [path, setPath] = useState([]);

  // Starte bei Root
  useEffect(() => {
    if (tree && tree.root) {
      setCurrentId(tree.root.id || 'root');
      setPath([tree.root.id || 'root']);
    }
  }, [tree]);

  if (!tree || !currentId) return null;

  const node = tree[currentId] || (currentId === 'root' ? tree.root : null);
  if (!node) return null;
  const text = node.text || node.text_simplified || '';
  const options = node.options || [];

  const handleNext = () => {
    // Wähle die erste Option als Standardpfad
    if (options && options.length > 0) {
      const nextId = options[0].nextId;
      if (nextId) {
        setCurrentId(nextId);
        setPath((prev) => [...prev, nextId]);
        return;
      }
    }
    // Kein nächster Schritt: schließe den Modus
    onClose?.();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(255, 255, 255, 0.98)',
        zIndex: 5000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: '600px', width: '100%', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>
          {lang === 'de' ? 'Schritt für Schritt' : 'Step by Step'}
        </h2>
        <div
          style={{
            fontSize: '1.5rem',
            lineHeight: '1.4',
            marginBottom: '1.5rem',
            color: '#111827',
          }}
        >
          {text}
        </div>
        <button
          onClick={handleNext}
          style={{
            padding: '1rem 2rem',
            fontSize: '1.2rem',
            background: '#0a3a72',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            marginBottom: '1rem',
          }}
        >
          {options && options.length > 0
            ? lang === 'de'
              ? 'Weiter'
              : 'Next'
            : lang === 'de'
            ? 'Beenden'
            : 'Finish'}
        </button>
        <button
          onClick={() => onClose?.()}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '1rem',
            background: '#e5e7eb',
            color: '#1f2937',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          {lang === 'de' ? 'Schließen' : 'Close'}
        </button>
      </div>
    </div>
  );
}