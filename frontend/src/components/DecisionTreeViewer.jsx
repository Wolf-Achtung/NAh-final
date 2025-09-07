
import React, { useState } from 'react';

/**
 * Zeigt interaktiv einen Entscheidungsbaum an.  Der Nutzer sieht immer nur den
 * aktuellen Knoten (z. B. "root") und wählt aus den verfügbaren Optionen
 * (Buttons), um weiter in die Tiefe zu navigieren.  Ein Breadcrumb zeigt den
 * bisherigen Pfad an.  Über die Zurück‑Schaltfläche kann der Nutzer einen
 * Schritt zurückgehen oder ganz zur Übersicht wechseln.
 */
const DecisionTreeViewer = ({ tree, onBack, hideRootText = false }) => {
  // ID des aktuell angezeigten Knotens. Start ist immer 'root'.
  const [currentId, setCurrentId] = useState('root');
  // Verlauf der besuchten Knoten, um zurück navigieren zu können.
  const [history, setHistory] = useState([]);

  // Wenn der Baum leer ist, fällt der Viewer mit einer Meldung aus.
  if (!tree || Object.keys(tree).length === 0) {
    return <p>Kein Inhalt verfügbar.</p>;
  }

  const node = tree[currentId];
  if (!node) {
    return <p>Unbekannter Knoten: {currentId}</p>;
  }

  const handleOptionClick = (nextId) => {
    setHistory([...history, currentId]);
    setCurrentId(nextId);
  };

  const handleBack = () => {
    if (history.length === 0) {
      // Wenn es keinen vorherigen Knoten gibt, zurück zur Übersichtsseite.
      onBack();
    } else {
      const prev = history[history.length - 1];
      setHistory(history.slice(0, -1));
      setCurrentId(prev);
    }
  };

  return (
    <div className="tree-container">
      <button onClick={handleBack} className="back-btn">
        {history.length === 0 ? '← Zurück zur Übersicht' : '← Zurück'}
      </button>
      {/* Breadcrumb zeigt den Pfad durch den Baum. 'root' wird nicht angezeigt, um interne IDs zu verbergen */}
      <div className="breadcrumb">
        {history
          .filter((id) => id !== 'root')
          .map((id) => {
            const breadcrumbNode = tree[id];
            const label = breadcrumbNode?.text ? breadcrumbNode.text.slice(0, 30) : id;
            return (
              <span key={id} className="breadcrumb-item">
                {label} &raquo;{' '}
              </span>
            );
          })}
        <span className="breadcrumb-current">
          {node.text ? node.text.slice(0, 30) : ''}
        </span>
      </div>
      <div className="tree-node">
        {/* Überschrift: zeige die eigentliche Frage oder Anweisung statt der Knotennummer.
            Wenn hideRootText gesetzt ist und wir uns am Wurzelknoten befinden,
            wird die Frage ausgeblendet (z. B. im Online‑Modus). */}
        <div className="tree-content">
          {!(hideRootText && currentId === 'root') && <p>{node.text}</p>}
        </div>
      </div>
      <div className="tree-options">
        {node.options && node.options.length > 0 ? (
          node.options.map((opt) => (
            <button
              key={opt.nextId}
              onClick={() => handleOptionClick(opt.nextId)}
              className="option-btn"
            >
              {opt.label}
            </button>
          ))
        ) : (
          <p>Keine weiteren Optionen – Ende des Entscheidungsbaums.</p>
        )}
      </div>
    </div>
  );
};

export default DecisionTreeViewer;
