import React, { useState } from 'react';

/**
 * ShareLocationButton – Ermöglicht dem Nutzer, seinen aktuellen Standort
 * unkompliziert an einen Notfallkontakt zu übermitteln. Der Kontakt kann
 * eine Telefonnummer oder eine E‑Mail‑Adresse sein. Die Komponente
 * verwendet die Geolocation‑API, um die aktuelle Position zu ermitteln,
 * und öffnet dann je nach Kontakt entweder eine SMS‑ oder Mail‑App mit
 * vorgefertigtem Text. Unterstützt Browser‑Sharing via navigator.share,
 * sofern verfügbar.
 *
 * Props:
 * - defaultContact: Vorbelegung für das Kontaktfeld (z. B. Buddy‑Kontakt aus App)
 * - lang: 'de' | 'en' – steuert die Textausgabe
 */
export default function ShareLocationButton({ defaultContact = '', lang = 'de' }) {
  const [contact, setContact] = useState(defaultContact || '');
  const [status, setStatus] = useState('');

  const share = () => {
    if (!contact) {
      setStatus(lang === 'de' ? 'Bitte Kontakt eingeben.' : 'Please enter a contact.');
      return;
    }
    if (!navigator.geolocation) {
      setStatus(lang === 'de' ? 'Standort nicht verfügbar.' : 'Geolocation not supported.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const locUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
        const msgDe = `Notfall! Hier ist mein Standort: ${locUrl}`;
        const msgEn = `Emergency! Here is my location: ${locUrl}`;
        const body = encodeURIComponent(lang === 'de' ? msgDe : msgEn);
        let link;
        if (contact.includes('@')) {
          const subject = encodeURIComponent(lang === 'de' ? 'Notfallstandort' : 'Emergency location');
          link = `mailto:${contact}?subject=${subject}&body=${body}`;
        } else {
          link = `sms:${contact}?body=${body}`;
        }
        if (navigator.share) {
          navigator
            .share({ title: lang === 'de' ? 'Notfallstandort' : 'Emergency location', text: lang === 'de' ? msgDe : msgEn, url: locUrl })
            .then(() => {
              setStatus(lang === 'de' ? 'Standort geteilt.' : 'Location shared.');
            })
            .catch(() => {
              window.open(link, '_blank');
              setStatus(lang === 'de' ? 'Standort-Link geöffnet.' : 'Opened share link.');
            });
        } else {
          window.open(link, '_blank');
          setStatus(lang === 'de' ? 'Standort-Link geöffnet.' : 'Opened share link.');
        }
      },
      () => {
        setStatus(lang === 'de' ? 'Standort nicht verfügbar.' : 'Could not get location.');
      }
    );
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }} htmlFor="contact-input">
        {lang === 'de' ? 'Notfallkontakt' : 'Emergency contact'}
      </label>
      <input
        id="contact-input"
        type="text"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        placeholder={lang === 'de' ? 'Telefonnummer oder E-Mail …' : 'Phone number or email…'}
        style={{ width: '100%', padding: '0.5rem', borderRadius: 4, border: '1px solid #cbd5e1', marginBottom: '0.5rem' }}
      />
      <button
        onClick={share}
        style={{ width: '100%', padding: '0.5rem 1rem', backgroundColor: '#0a3a72', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
      >
        {lang === 'de' ? 'Standort teilen' : 'Share location'}
      </button>
      {status && (
        <div style={{ marginTop: '0.5rem', color: '#065f46', fontSize: '0.875rem' }}>{status}</div>
      )}
    </div>
  );
}
