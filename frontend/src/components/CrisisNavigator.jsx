import React, { useState } from 'react';

/**
 * CrisisNavigator ist ein smarter Fragen-Dialog für User,
 * die ihre Gefahrensituation nicht konkret benennen können.
 */
const CrisisNavigator = ({ onComplete, lang = 'de' }) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});

  const questions = [
    {
      key: 'smoke',
      question: {
        de: 'Siehst du Rauch oder Feuer?',
        en: 'Do you see smoke or fire?',
        fr: 'Voyez-vous de la fumée ou du feu ?',
        es: '¿Ves humo o fuego?',
        it: 'Vedi fumo o fuoco?'
      }
    },
    {
      key: 'power',
      question: {
        de: 'Funktionieren Strom und Wasser?',
        en: 'Are electricity and water working?',
        fr: "L'électricité et l'eau fonctionnent-elles ?",
        es: '¿Funcionan la electricidad y el agua?',
        it: 'Funzionano elettricità e acqua?'
      }
    },
    {
      key: 'crowd',
      question: {
        de: 'Sind viele Menschen in Panik oder laut?',
        en: 'Are people around panicking or loud?',
        fr: 'Les gens paniquent-ils autour de vous ?',
        es: '¿La gente alrededor está en pánico o alterada?',
        it: 'Le persone intorno a te sono in panico o agitate?'
      }
    }
  ];
  const handleAnswer = (value) => {
    const key = questions[step].key;
    const updated = { ...answers, [key]: value };
    setAnswers(updated);

    if (step + 1 < questions.length) {
      setStep(step + 1);
    } else {
      // Einfache Logik zur Ableitung einer wahrscheinlichen Gefahrenlage
      // Wenn Rauch oder Feuer gesehen wird → brand_feuer,
      // wenn Strom/Wasser nicht funktionieren → strom_infrastruktur,
      // wenn Menschen panisch sind → krisen_konflikte,
      // ansonsten unklare_gefahr.
      let result = null;
      if (updated.smoke === true) {
        result = 'brand_feuer';
      } else if (updated.power === false) {
        result = 'strom_infrastruktur';
      } else if (updated.crowd === true) {
        result = 'krisen_konflikte';
      }
      onComplete(result || 'unklare_gefahr');
    }
  };

  const q = questions[step];

  return (
    <div className="crisis-navigator">
      <h2>Ich weiß nicht, was los ist…</h2>
      <p>{q.question[lang]}</p>
      <div className="navigator-buttons">
        <button onClick={() => handleAnswer(true)}>Ja</button>
        <button onClick={() => handleAnswer(false)}>Nein</button>
      </div>
    </div>
  );
};

export default CrisisNavigator;
