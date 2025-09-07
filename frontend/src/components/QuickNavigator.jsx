import React, { useState, useRef } from 'react';

/**
 * QuickNavigator ist ein erweiterter Notfall‑Navigator, der mit
 * automatischer Vorauswahl arbeitet und anschließend gezielte
 * Ja/Nein‑Fragen stellt. Er kann die vordefinierten Gefahrenlagen
 * weitgehend ersetzen, indem er zunächst einen Auto‑Vorschlag zeigt
 * (z. B. Stromausfall oder Unwetter, wenn entsprechende Hinweise
 * erkannt wurden) und danach systematisch durch die wichtigsten
 * Entscheidungsfragen navigiert. Bei jedem Schritt werden nur
 * einfache Schaltflächen angezeigt, um den Nutzer schnell zur
 * passenden Kategorie zu führen. Das Ergebnis wird als Objekt mit
 * einem Feld ``slug`` und den gesammelten ``answers`` an die
 * Callback‑Funktion ``onComplete`` übergeben.
 */
const QuickNavigator = ({ autoSlug = null, hazardMeta = {}, lang = 'de', onComplete, deviceLocation = null }) => {
  // Die aktuelle Frage. Wenn autoSlug gesetzt ist, starten wir bei
  // Schritt 0 und bieten dem Nutzer an, den automatischen Vorschlag
  // anzunehmen. Ansonsten starten wir bei Schritt 1.
  const [step, setStep] = useState(autoSlug ? 0 : 1);
  // Antworten des Nutzers (true/false) für die einzelnen Fragen.
  const [answers, setAnswers] = useState({});

  // Sprachverarbeitung: Referenz für die SpeechRecognition-Instanz und Listening-Status.
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState(null);

  /**
   * Startet die Spracherkennung und wertet die Antwort aus.  Erkennt einfache
   * Ja/Nein/Überspringen‑Antworten in der aktuellen Sprache.  Falls der
   * Browser die Web‑Speech‑API nicht unterstützt, wird eine Fehlermeldung
   * angezeigt.
   */
  const handleVoice = () => {
    // Prüfe Unterstützung der API
    if (typeof window === 'undefined' || (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window))) {
      setVoiceError(
        lang === 'de'
          ? 'Spracherkennung wird in diesem Browser nicht unterstützt.'
          : lang === 'en'
          ? 'Speech recognition is not supported in this browser.'
          : ''
      );
      return;
    }
    // Wenn bereits eine Aufnahme läuft: stoppe sie
    if (listening) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = lang === 'de' ? 'de-DE' : lang === 'en' ? 'en-US' : 'de-DE';
    recognition.interimResults = false;
    recognition.onstart = () => {
      setListening(true);
      setVoiceError(null);
    };
    recognition.onend = () => {
      setListening(false);
    };
    recognition.onerror = (event) => {
      setVoiceError(
        lang === 'de'
          ? 'Fehler bei der Spracherkennung.'
          : lang === 'en'
          ? 'Speech recognition error.'
          : ''
      );
      setListening(false);
    };
    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      transcript = transcript.trim().toLowerCase();
      if (!transcript) return;
      // Entscheide anhand des Transkripts, ob "Ja", "Nein" oder "Überspringen"
      const yesWords = lang === 'de' ? ['ja'] : ['yes'];
      const noWords = lang === 'de' ? ['nein'] : ['no'];
      const skipWords = lang === 'de' ? ['überspringen', 'skip'] : ['skip'];
      const contains = (arr) => arr.some((w) => transcript.includes(w));
      if (contains(yesWords)) {
        handleAnswer(true);
      } else if (contains(noWords)) {
        handleAnswer(false);
      } else if (contains(skipWords)) {
        handleAnswer(null);
      } else {
        setVoiceError(
          lang === 'de'
            ? `Unklar: Bitte antworte mit "Ja", "Nein" oder "Überspringen".`
            : lang === 'en'
            ? 'Unknown response: please answer with "yes", "no" or "skip".'
            : ''
        );
      }
    };
    try {
      recognition.start();
    } catch (err) {
      setVoiceError(
        lang === 'de'
          ? 'Spracherkennung konnte nicht gestartet werden.'
          : lang === 'en'
          ? 'Could not start speech recognition.'
          : ''
      );
    }
  };

  // Fragenkatalog: Der Navigator stellt eine Reihe von Fragen, um die Situation zu
  // erfassen. Wir starten bewusst mit der Verletzten‑Frage, da bereits eine
  // einzige verletzte Person einen medizinischen Notfall auslöst und alle
  // weiteren Fragen überflüssig machen. Anschließend folgen der Aufenthaltsort
  // und die Frage nach mehreren Personen. Danach werden die gefahrenbezogenen
  // Fragen gestellt.
  const questions = [
    {
      key: 'injury',
      question: {
        de: 'Gibt es verletzte Personen?',
        en: 'Are there injured persons?',
        fr: 'Y a‑t‑il des personnes blessées ?',
        es: '¿Hay personas heridas?',
        it: 'Ci sono persone ferite?'
      }
    },
    {
      key: 'inside',
      question: {
        de: 'Befindest du dich in einem Gebäude?',
        en: 'Are you in a building?',
        fr: 'Es‑tu dans un bâtiment ?',
        es: '¿Estás dentro de un edificio?',
        it: 'Sei in un edificio?'
      }
    },
    {
      key: 'vehicle',
      question: {
        de: 'Bist du in einem Fahrzeug oder unter der Erde (Tunnel, U‑Bahn, Keller)?',
        en: 'Are you in a vehicle or underground (tunnel, subway, basement)?',
        fr: 'Es‑tu dans un véhicule ou sous terre (tunnel, métro, cave) ?',
        es: '¿Estás en un vehículo o bajo tierra (túnel, metro, sótano)?',
        it: 'Sei in un veicolo o sottoterra (tunnel, metropolitana, cantina)?'
      }
    },
    {
      key: 'multiple',
      question: {
        de: 'Sind mehrere Personen betroffen?',
        en: 'Are multiple people affected?',
        fr: 'Plusieurs personnes sont‑elles concernées ?',
        es: '¿Hay varias personas afectadas?',
        it: 'Ci sono più persone coinvolte?'
      }
    },
    {
      key: 'smoke',
      question: {
        de: 'Siehst du Flammen oder Rauch?',
        en: 'Do you see flames or smoke?',
        fr: 'Voyez‑vous des flammes ou de la fumée ?',
        es: '¿Ves llamas o humo?',
        it: 'Vedi fiamme o fumo?'
      }
    },
    {
      key: 'water',
      question: {
        de: 'Gibt es starke Regenfälle, Sturm oder Hochwasser?',
        en: 'Are there heavy rains, storms or flooding?',
        fr: 'Y a‑t‑il de fortes pluies, des tempêtes ou des inondations ?',
        es: '¿Hay lluvias fuertes, tormentas o inundaciones?',
        it: 'Ci sono piogge intense, tempeste o inondazioni?'
      }
    },
    {
      key: 'hazmat',
      question: {
        // Frage nach Gefahrstoffen: Chemikalien, Gas, giftige Stoffe. Die Hitze/UV-Frage folgt separat.
        de: 'Handelt es sich um Chemikalien, Gas oder andere giftige Stoffe?',
        en: 'Is it about chemicals, gas or other toxic substances?',
        fr: 'S’agit‑il de produits chimiques, de gaz ou d’autres substances toxiques ?',
        es: '¿Se trata de productos químicos, gas u otras sustancias tóxicas?',
        it: 'Si tratta di sostanze chimiche, gas o altre sostanze tossiche?'
      }
    },
    {
      key: 'heat',
      question: {
        de: 'Ist es sehr heiß oder herrscht starke UV‑Strahlung (Hitze, UV, Dürre)?',
        en: 'Is it unusually hot or is there strong UV radiation (heat, UV, drought)?',
        fr: 'Fait‑il anormalement chaud ou y a‑t‑il une forte radiation UV (chaleur, UV, sécheresse) ?',
        es: '¿Hace un calor inusual o hay una radiación UV fuerte (calor, UV, sequía)?',
        it: 'Fa insolitamente caldo o c’è una forte radiazione UV (caldo, UV, siccità)?'
      }
    },
    {
      key: 'smell',
      question: {
        de: 'Riechst du Gas, Chemikalien oder verbrannte Stoffe?',
        en: 'Do you smell gas, chemicals or burning substances?',
        fr: 'Sens‑tu du gaz, des produits chimiques ou des substances brûlées ?',
        es: '¿Hueles gas, productos químicos o sustancias quemadas?',
        it: 'Senti odore di gas, sostanze chimiche o materiali bruciati?'
      }
    },
    {
      key: 'panic',
      question: {
        de: 'Hörst du Schüsse, Explosionen oder panische Menschen?',
        en: 'Do you hear shots, explosions or panicking people?',
        fr: 'Entendez‑vous des coups de feu, des explosions ou des gens en panique ?',
        es: '¿Oyes disparos, explosiones o gente en pánico?',
        it: 'Senti spari, esplosioni o persone in preda al panico?'
      }
    },
    {
      key: 'power',
      question: {
        de: 'Funktionieren Strom und Licht?',
        en: 'Are electricity and lights working?',
        fr: "L'électricité et les lumières fonctionnent‑elles ?",
        es: '¿Funcionan la electricidad y las luces?',
        it: 'Funzionano elettricità e luci?'
      }
    },
    {
      key: 'accident',
      question: {
        de: 'Ist ein Unfall oder technischer Defekt passiert?',
        en: 'Has an accident or technical failure occurred?',
        fr: 'Y a‑t‑il eu un accident ou une panne technique ?',
        es: '¿Ha ocurrido un accidente o un fallo técnico?',
        it: 'È avvenuto un incidente o un guasto tecnico?'
      }
    },
    {
      key: 'pandemic',
      question: {
        de: 'Geht es um eine Epidemie, Pandemie oder Krankheit?',
        en: 'Is it about an epidemic, pandemic or disease?',
        fr: 'S’agit‑il d’une épidémie, d’une pandémie ou d’une maladie ?',
        es: '¿Se trata de una epidemia, pandemia o enfermedad?',
        it: 'Si tratta di un’epidemia, pandemia o malattia?'
      }
    },
    {
      key: 'psych',
      question: {
        de: 'Hat jemand eine Panikattacke oder extreme Angst?',
        en: 'Is someone having a panic attack or extreme anxiety?',
        fr: 'Quelqu’un souffre‑t‑il d’une crise de panique ou d’une anxiété extrême ?',
        es: '¿Alguien tiene un ataque de pánico o ansiedad extrema?',
        it: 'Qualcuno ha un attacco di panico o un’ansia estrema?'
      }
    }
  ];

  /**
   * Der Handler speichert die Antwort, versucht nach jeder Antwort sofort eine Kategorie zu bestimmen
   * und bricht ggf. die Befragung vorzeitig ab. Die gesammelten Antworten werden mitgegeben,
   * damit sie in handleNavigatorComplete an GPT übergeben werden können.
   */
  const handleAnswer = (value) => {
    // Schritt 0: automatischer Vorschlag
    if (step === 0) {
      // Bei einer vorgeschlagenen Kategorie: 'Ja' akzeptieren, 'Nein' oder 'Überspringen' ignorieren.
      if (value === true && autoSlug) {
        onComplete({ slug: autoSlug });
        return;
      }
      // Wechsle zum nächsten Schritt, ohne eine Antwort zu speichern.
      setStep(1);
      return;
    }
    const key = questions[step - 1].key;
    // Wenn der Nutzer auf "Überspringen" klickt (value === null), speichern wir keine Antwort
    let updated;
    if (value === null) {
      // Entferne die aktuelle Antwort, damit undefined/fehlende Werte nicht ausgewertet werden
      const { [key]: removed, ...rest } = answers;
      updated = { ...rest };
    } else {
      updated = { ...answers, [key]: value };
    }
    setAnswers(updated);
    // Versuche, sofort eine Kategorie zu bestimmen, wenn eine eindeutige Antwort vorliegt
    const slugNow = determineResult(updated);
    if (slugNow && slugNow !== 'unklare_gefahr') {
      onComplete({ slug: slugNow, answers: updated });
      return;
    }
    // Weiter zur nächsten Frage, sofern welche übrig sind
    if (step < questions.length) {
      setStep(step + 1);
    } else {
      onComplete({ slug: slugNow, answers: updated });
    }
  };

  /**
   * Liefert basierend auf den Antworten eine geschätzte Gefahrenlage. Es wird lediglich der Slug
   * zurückgegeben.
   */
  /**
   * Ermittelt anhand der vom Nutzer gegebenen Antworten eine möglichst
   * wahrscheinliche Gefahrenlage. Die Prioritäten sind nach
   * Dringlichkeit sortiert, damit offensichtliche Gefahren (z. B.
   * Rauch oder Stromausfall) gegenüber weniger schwerwiegenden
   * Symptomen bevorzugt erkannt werden. Falls mehrere Bedingungen
   * zutreffen, wird die erste in der Reihenfolge gewählt. Sollten
   * keine Antworten vorliegen oder nichts passen, wird "unklare_gefahr"
   * zurückgegeben.
   */
  const determineResult = (resp) => {
    // Defensive: falls resp nicht gesetzt ist, unklare Gefahr annehmen
    if (!resp) return 'unklare_gefahr';
    // Sichtbares Feuer oder Rauch → Feuer/Explosion
    if (resp.smoke === true) return 'brand_feuer';
    // Stromausfall (Lights off) → Strom- & Infrastrukturausfall
    if (resp.power === false) return 'strom_infrastruktur';
    // Schüsse/Explosionen/Panische Menschen → Krisen & Konflikte
    if (resp.panic === true) return 'krisen_konflikte';
    // Starker Geruch nach Gas, Chemikalien oder verbranntem Stoff → Gefahrstoffe & Umwelt
    // Der Geruch nach Gas, Chemikalien oder verbrannten Stoffen deutet häufig auf Lecks
    // oder versteckte Feuer hin und sollte priorisiert werden. Deshalb prüfen wir
    // smell vor Wasser- oder Gefahrstoff-Indizien.
    if (resp.smell === true) return 'gefahrstoffe_umwelt';
    // Wasser, Sturm oder Hochwasser → Wassergefahren
    if (resp.water === true) return 'wassergefahren';
    // Chemikalien, Gas oder giftige Stoffe → Gefahrstoffe & Umwelt
    if (resp.hazmat === true) return 'gefahrstoffe_umwelt';
    // Extreme Hitze, UV-Strahlung oder Dürre → Hitze, UV & Dürre
    if (resp.heat === true) return 'hitze_uv_duerre';
    // Unfall oder technischer Defekt → Unfall & Technikversagen
    if (resp.accident === true) return 'unfall';
    // Pandemie/Krankheit → Gesundheitliche Bedrohung
    if (resp.pandemic === true) return 'pandemie';
    // Verletzte Personen → Medizinischer Notfall
    if (resp.injury === true) return 'medizinischer_notfall';
    // Panikattacke oder extreme Angst → Psychische Krise
    if (resp.psych === true) return 'psychische_krise';
    // Default: unklare Gefahr
    return 'unklare_gefahr';
  };

  // Hilfsfunktion, um den Namen eines Slugs in der aktuellen Sprache abzurufen.
  const getSlugName = (slug) => {
    const meta = hazardMeta && hazardMeta[slug];
    if (meta && meta.name && meta.name[lang]) {
      return meta.name[lang];
    }
    return slug;
  };

  // Aktuelle Frage ermitteln. Wenn step == 0, zeigen wir den Auto‑Vorschlag an.
  let currentQuestion = null;
  if (step === 0 && autoSlug) {
    currentQuestion = {
      prompt: `Wir haben Anzeichen für “${getSlugName(autoSlug)}”. Trifft das zu?`,
    };
  } else {
    const idx = step - 1;
    const q = questions[idx];
    currentQuestion = {
      prompt: q.question[lang] || q.question['de'],
    };
  }

  // Fortschrittsanzeige: Gesamtzahl der Fragen.  Wenn ein automatischer
  // Vorschlag aktiv ist, wird ein zusätzlicher Schritt gezählt, da der
  // Nutzer erst den Vorschlag annehmen oder verwerfen kann, bevor die
  // eigentlichen Fragen beginnen.  Die Anzeige startet immer bei 1, um
  // Verwirrung zu vermeiden – auch wenn intern step bei 0 beginnen sollte.
  const totalSteps = questions.length + (autoSlug ? 1 : 0);
  const currentStepNum = (() => {
    // Wenn ein Auto‑Vorschlag aktiv ist und der aktuelle Schritt 0 ist, soll
    // die Fortschrittsanzeige "1" anzeigen.  Ansonsten entspricht sie dem
    // aktuellen step‑Wert.
    if (autoSlug && step === 0) return 1;
    return step;
  })();

  return (
    <div className="quick-navigator">
      <h2 style={{ marginBottom: '0.25rem' }}>
        {lang === 'de'
          ? 'Schnell‑Navigator'
          : lang === 'fr'
          ? 'Navigateur rapide'
          : lang === 'es'
          ? 'Navegador rápido'
          : lang === 'it'
          ? 'Navigatore rapido'
          : 'Quick Navigator'}
      </h2>
      {/* Fortschrittsanzeige */}
      <p style={{ marginBottom: '0.25rem', fontSize: '0.85rem', color: '#666' }}>
        {lang === 'de'
          ? `Frage ${currentStepNum} von ${totalSteps}`
          : lang === 'fr'
          ? `Question ${currentStepNum} sur ${totalSteps}`
          : lang === 'es'
          ? `Pregunta ${currentStepNum} de ${totalSteps}`
          : lang === 'it'
          ? `Domanda ${currentStepNum} di ${totalSteps}`
          : `Question ${currentStepNum} of ${totalSteps}`}
      </p>
      {/* Hinweis bei erkannter Aufenthaltsposition: Wenn die Sensorik einen Aufenthaltsort
          liefert (car/outside/home), geben wir dem Nutzer einen Hinweis. Die
          "inside"‑Frage ist eine der ersten Fragen (key "inside"). Dieser
          Hinweis soll helfen, das richtige Ja/Nein zu wählen, kann aber
          übergangen werden. */}
      {deviceLocation && questions[step - 1] && questions[step - 1].key === 'inside' && (
        <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '-0.5rem' }}>
          {(() => {
            const locLabel = (() => {
              switch (deviceLocation) {
                case 'home':
                  return lang === 'de'
                    ? 'im Gebäude'
                    : lang === 'fr'
                    ? 'dans un bâtiment'
                    : lang === 'es'
                    ? 'en un edificio'
                    : lang === 'it'
                    ? 'in un edificio'
                    : 'in a building';
                case 'outside':
                  return lang === 'de'
                    ? 'im Freien'
                    : lang === 'fr'
                    ? 'à l’extérieur'
                    : lang === 'es'
                    ? 'al aire libre'
                    : lang === 'it'
                    ? 'all’aperto'
                    : 'outdoors';
                case 'car':
                  return lang === 'de'
                    ? 'im Auto'
                    : lang === 'fr'
                    ? 'en voiture'
                    : lang === 'es'
                    ? 'en el coche'
                    : lang === 'it'
                    ? 'in auto'
                    : 'in the car';
                default:
                  return deviceLocation;
              }
            })();
            return lang === 'de'
              ? ``
              : lang === 'fr'
              ? ``
              : lang === 'es'
              ? ``
              : lang === 'it'
              ? ``
              : ``;
          })()}
        </p>
      )}
      {/* Frage in auffälligem Rot hervorheben. Eine kräftige rote Farbe lenkt die
          Aufmerksamkeit auf die aktuelle Frage und hebt sie vom restlichen Text ab. */}
      <p style={{ marginBottom: '1rem', color: '#c30000', fontWeight: '600' }}>{currentQuestion.prompt}</p>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {/* Für alle Antwort‑Buttons wird ein einheitliches Grundlayout verwendet.
            Der Stil orientiert sich am bisherigen "Nein"‑Button (weißer
            Hintergrund, blauer Rahmen).  Durch CSS wird ein aktiver
            Tastendruck kurz blau hervorgehoben, ohne dass zusätzliche
            JavaScript‑Logik nötig ist. */}
        {/* Sprachbutton: startet die Spracherkennung, um "Ja"/"Nein"/"Überspringen" zu erfassen. */}
        <button
          onClick={handleVoice}
          style={{
            padding: '0.6rem 1.2rem',
            backgroundColor: listening ? '#004080' : '#fff',
            color: listening ? '#fff' : '#004080',
            border: '2px solid #004080',
            borderRadius: '4px',
            fontSize: '1rem',
            minWidth: '80px',
            transition: 'background-color 0.1s, color 0.1s'
          }}
          title={lang === 'de' ? 'Spracherkennung starten' : 'Start speech recognition'}
        >
          {listening
            ? lang === 'de'
              ? 'Höre …'
              : 'Listening…'
            : lang === 'de'
            ? 'Sprache'
            : 'Voice'}
        </button>
        <button
          onClick={() => handleAnswer(true)}
          style={{
            padding: '0.6rem 1.2rem',
            backgroundColor: '#fff',
            color: '#004080',
            border: '2px solid #004080',
            borderRadius: '4px',
            fontSize: '1rem',
            minWidth: '80px',
            transition: 'background-color 0.1s, color 0.1s'
          }}
        >
          {lang === 'de'
            ? 'Ja'
            : lang === 'fr'
            ? 'Oui'
            : lang === 'es'
            ? 'Sí'
            : lang === 'it'
            ? 'Sì'
            : 'Yes'}
        </button>
        <button
          onClick={() => handleAnswer(false)}
          style={{
            padding: '0.6rem 1.2rem',
            backgroundColor: '#fff',
            color: '#004080',
            border: '2px solid #004080',
            borderRadius: '4px',
            fontSize: '1rem',
            minWidth: '80px',
            transition: 'background-color 0.1s, color 0.1s'
          }}
        >
          {lang === 'de'
            ? 'Nein'
            : lang === 'fr'
            ? 'Non'
            : lang === 'es'
            ? 'No'
            : lang === 'it'
            ? 'No'
            : 'No'}
        </button>
        <button
          onClick={() => handleAnswer(null)}
          style={{
            padding: '0.6rem 1.2rem',
            backgroundColor: '#fff',
            color: '#004080',
            border: '2px solid #004080',
            borderRadius: '4px',
            fontSize: '1rem',
            minWidth: '80px',
            transition: 'background-color 0.1s, color 0.1s'
          }}
        >
          {lang === 'de'
            ? 'Überspringen'
            : lang === 'fr'
            ? 'Sauter'
            : lang === 'es'
            ? 'Saltar'
            : lang === 'it'
            ? 'Salta'
            : 'Skip'}
        </button>
      </div>
      {/* Fehlermeldung bei Spracherkennung */}
      {voiceError && (
        <p style={{ marginTop: '0.5rem', color: '#c30000', fontSize: '0.8rem' }}>{voiceError}</p>
      )}
    </div>
  );
};

export default QuickNavigator;