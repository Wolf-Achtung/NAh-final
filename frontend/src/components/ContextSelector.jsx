import React from 'react';
import './ContextSelector.css';

/**
 * Kontextauswahl‑Komponente.  Zeigt dem Nutzer eine Auswahl an Situationen
 * (im Gebäude, draußen/helfend, im Auto), bevor der Chat gestartet wird.
 * Bei Auswahl wird der entsprechende Kontext zurückgegeben.
 */
/**
 * Kontextauswahl‑Komponente.
 *
 * Je nach `type` zeigt sie entweder die Auswahl des Aufenthaltsortes
 * ("location") oder die persönliche Situation/den Personentyp ("persona").
 */
/**
 * Kontextauswahl‑Komponente.
 *
 * Zeigt dem Nutzer eine Auswahl an Situationen (z. B. Aufenthaltsort oder
 * Personentyp) an.  Die Standardkonfiguration für "location" und
 * "persona" kann durch Übergabe eines eigenen options‑Arrays überschrieben
 * werden.  Wenn `options` gesetzt ist, werden diese Werte direkt
 * verwendet; ansonsten greift die vordefinierte Konfiguration.
 */
export default function ContextSelector({ type = 'location', onSelect, options: customOptions, title: customTitle, description: customDescription }) {
  // Konfiguration für die beiden Standard‑Auswahlschritte.  Der Modus
  // "location" fragt nach dem Aufenthaltsort, während "persona" nach dem
  // Personentyp fragt.  Beschreibungen und Optionen können leicht
  // erweitert werden.
  const config = {
    location: {
      title: 'Wo befindest du dich?',
      description:
        'Bitte wähle deine aktuelle Situation aus, damit dir die passende Hilfe angezeigt werden kann.',
      options: [
        { value: 'indoor', label: 'Ich bin im Gebäude' },
        { value: 'outdoor', label: 'Ich bin draußen / helfe' },
        { value: 'car', label: 'Ich bin im Auto' }
      ]
    },
    persona: {
      title: 'Wer bist du?',
      description:
        'Durch deine persönliche Situation können sich die Empfehlungen ändern.',
      options: [
        { value: 'adult', label: 'Erwachsener' },
        { value: 'senior', label: 'Senior' },
        { value: 'child', label: 'Kind' },
        { value: 'handicap', label: 'Person mit Handicap' }
        ,
        // Option für Menschen, die sich vorrangig um andere kümmern oder
        // als Ersthelfer tätig sind. Diese Wahl beeinflusst die
        // Priorität der Empfehlungen, indem der Fokus auf
        // Unterstützung und Fremdhilfe gelegt wird.
        { value: 'helper', label: 'Ich helfe anderen' }
      ]
    }
  };
  const conf = config[type] || config.location;
  const title = customTitle || conf.title;
  const description = customDescription || conf.description;
  const options = Array.isArray(customOptions) && customOptions.length > 0 ? customOptions : conf.options;
  return (
    <div className="context-selector">
      <div className="context-selector-box">
        <h3>{title}</h3>
        <p>{description}</p>
        <div className="context-buttons">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSelect(opt.value)}
              className="context-btn"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}