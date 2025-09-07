import React, { useState, useEffect } from 'react';

/**
 * PersonalInfoToolkit
 *
 * Ein einfaches Formular zur Erfassung wichtiger persönlicher Gesundheitsinformationen.
 * Die eingegebenen Daten werden lokal im Browser gespeichert, so dass sie offline
 * verfügbar sind. Nutzer können Allergien, Medikamente und Notfallkontakte
 * eintragen. Die Informationen können über die Zwischenablage geteilt werden.
 *
 * Props:
 * - open: boolean — Ob das Toolkit angezeigt werden soll.
 * - onClose: () => void — Funktion zum Schließen des Toolkits.
 */
export default function PersonalInfoToolkit({ open, onClose }) {
  const [name, setName] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medications, setMedications] = useState('');
  const [notes, setNotes] = useState('');

  // Beim Mount vorhandene Daten laden
  useEffect(() => {
    if (typeof window !== 'undefined' && open) {
      try {
        const saved = JSON.parse(localStorage.getItem('personalInfo') || '{}');
        setName(saved.name || '');
        setAllergies(saved.allergies || '');
        setMedications(saved.medications || '');
        setNotes(saved.notes || '');
      } catch {
        /* ignore */
      }
    }
  }, [open]);

  const handleSave = () => {
    const data = { name, allergies, medications, notes };
    localStorage.setItem('personalInfo', JSON.stringify(data));
    onClose?.();
  };

  const handleShare = () => {
    const data = {
      Name: name,
      Allergien: allergies,
      Medikamente: medications,
      Hinweise: notes,
    };
    const text = Object.entries(data)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    if (navigator.share) {
      navigator
        .share({
          title: 'Notfallinformationen',
          text,
        })
        .catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
      alert('Informationen in die Zwischenablage kopiert');
    }
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
          maxWidth: '600px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Persönliche Notfall‑Infos</h3>
          <button
            onClick={() => onClose?.()}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Name (optional)
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Allergien
            <textarea
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              rows={2}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Medikamente
            <textarea
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
              rows={2}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Weitere Hinweise
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
            />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
          <button
            onClick={handleSave}
            style={{ padding: '0.5rem 1rem', background: '#004080', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Speichern
          </button>
          <button
            onClick={handleShare}
            style={{ padding: '0.5rem 1rem', background: '#0066aa', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Teilen / Kopieren
          </button>
        </div>
      </div>
    </div>
  );
}