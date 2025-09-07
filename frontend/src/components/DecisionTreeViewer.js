import React, { useState, useEffect } from 'react';

function DecisionTreeViewer({
  hazards,
  hazardMeta,
  locationLabels,
  lang,
  setLang,
  simpleText,
  setSimpleText,
  tree,
  setTree,
  currentSlug,
  setCurrentSlug,
  summary,
  setSummary
}) {
  const [currentStep, setCurrentStep] = useState(null);

  useEffect(() => {
    if (currentSlug) {
      fetch(`/api/tree/${currentSlug}?lang=${lang}`)
        .then(res => res.json())
        .then(data => {
          setTree(data);
          setCurrentStep(data.steps?.[0] || null);
          setSummary(hazardMeta[currentSlug]?.description?.[lang] || '');
        });
    }
  }, [currentSlug, lang]);

  const handleAnswerClick = (nextId) => {
    const nextStep = tree.steps.find(s => s.id === nextId);
    setCurrentStep(nextStep || null);
  };

  return (
    <div className="tree-viewer">
      <h2>Offline-Notfallhilfe</h2>
      {!currentSlug ? (
        <div className="hazard-select">
          <p>Bitte wählen Sie eine Gefahrenlage:</p>
          <ul>
            {hazards.map((h) => (
              <li key={h}>
                <button onClick={() => setCurrentSlug(h)}>
                  {hazardMeta[h]?.name?.[lang] || h}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="tree-content">
          <h3>{hazardMeta[currentSlug]?.name?.[lang]}</h3>
          <p className="hazard-summary">{summary}</p>

          {currentStep ? (
            <div className="tree-step">
              <p>{currentStep.text}</p>
              <div className="answers">
                {currentStep.answers.map((answer, idx) => (
                  <button key={idx} onClick={() => handleAnswerClick(answer.next_step_id)}>
                    {answer.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p>Keine weiteren Schritte vorhanden.</p>
          )}

          <button onClick={() => {
            setCurrentSlug(null);
            setTree(null);
            setCurrentStep(null);
          }}>
            Zurück zur Auswahl
          </button>
        </div>
      )}
    </div>
  );
}

export default DecisionTreeViewer;
