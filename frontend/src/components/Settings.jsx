import React, { useState, useEffect } from 'react';

/**
 * Settings
 *
 * Ein Modal, das allgemeine App‑Einstellungen bietet. Nutzer können
 * hohe Kontraste, große Schrift und die Sensor‑Erkennung ein‑ oder
 * ausschalten. Einstellungen werden in localStorage gespeichert und
 * beim Laden der App angewendet.
 *
 * Props:
 * - open: boolean — Ob das Modal angezeigt wird.
 * - onClose: () => void — Schließt das Modal.
 * - onToggleSensors: (enabled: boolean) => void — Callback zur Aktivierung/Deaktivierung der Sensoren.
 */
export default function Settings({ open, onClose, onToggleSensors }) {
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [sensorsEnabled, setSensorsEnabled] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined' && open) {
      const hc = localStorage.getItem('highContrast') === 'true';
      const lt = localStorage.getItem('largeText') === 'true';
      const se = localStorage.getItem('sensorsEnabled') !== 'false';
      setHighContrast(hc);
      setLargeText(lt);
      setSensorsEnabled(se);
    }
  }, [open]);

  // Anwenden der Klassen
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('high-contrast', highContrast);
      document.body.classList.toggle('large-text', largeText);
    }
  }, [highContrast, largeText]);

  const toggleHighContrast = () => {
    const value = !highContrast;
    setHighContrast(value);
    localStorage.setItem('highContrast', String(value));
  };
  const toggleLargeText = () => {
    const value = !largeText;
    setLargeText(value);
    localStorage.setItem('largeText', String(value));
  };
  const toggleSensors = () => {
    const value = !sensorsEnabled;
    setSensorsEnabled(value);
    localStorage.setItem('sensorsEnabled', String(value));
    onToggleSensors?.(value);
  };

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
          maxWidth: '400px',
          padding: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Einstellungen</h3>
          <button
            onClick={() => onClose?.()}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span>Hoher Kontrast</span>
            <input type="checkbox" checked={highContrast} onChange={toggleHighContrast} />
          </label>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span>Große Schrift</span>
            <input type="checkbox" checked={largeText} onChange={toggleLargeText} />
          </label>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span>Sensorerkennung aktiv</span>
            <input type="checkbox" checked={sensorsEnabled} onChange={toggleSensors} />
          </label>
        </div>
      </div>
    </div>
  );
}