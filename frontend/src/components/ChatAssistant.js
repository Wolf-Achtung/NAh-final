import React, { useMemo, useState, useEffect, useRef } from 'react';

/**
 * ChatAssistant – kompakte, barrierearme Notfallhilfe.
 *
 * Diese Komponente zeigt vor dem ersten Chatkontakt kurze, klare
 * Sofort-Anweisungen für die erkannte Gefahrensituation. Die
 * Anweisungen sind bewusst im Imperativ gehalten und nummeriert,
 * damit auch Kinder, Senioren oder Menschen mit Handicap sie
 * verstehen und befolgen können. Statt langer Vorschlagslisten
 * werden maximal drei kurze Handlungsanweisungen angezeigt. Über
 * das Eingabefeld können anschließend individuelle Fragen an den
 * Assistenten gestellt werden.
 *
 * Props:
 * - slug: aktuelle Gefahrenkategorie (z.B. 'krisen_konflikte')
 * - onClose: Funktion zum Schließen des Fensters
 * - suggestions: nicht verwendet (bleibt für Kompatibilität)
 * - context: optionaler Kontextstring (z.B. Aufenthaltsort-Persona)
 * - lang: Sprache (derzeit nur de/en unterstützt)
 */
const ChatAssistant = ({
  slug,
  onClose,
  suggestions = [],
  context = null,
  lang = 'de',
  ttsEnabled = false,
  onLifeSaver = null,
  // Risiko-Einstufung (low|medium|high). Bei hoher Stufe wird ein CTA zum Notruf angezeigt.
  riskLevel = 'medium',
  // Optional hinterlegter Buddy-Kontakt (z. B. Telefonnummer). Wird für Buddy-Ping genutzt.
  buddy = '',
  // Callback, um Buddy-Kontakt zu speichern (wird in App verwaltet)
  onBuddyChange = null,
  // Optionale Unterkategorien für medizinische Notfälle. Wenn gesetzt und der slug 'medizinischer_notfall' ist,
  // werden diese Optionen als Buttons angezeigt, bevor der Chat startet.  Jede Option ist ein Objekt mit slug und name.
  subHazards = [],
  // Callback, das aufgerufen wird, wenn der Nutzer eine Unterkategorie auswählt.
  onSelectHazard = null,
}) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Referenz auf den aktuellen EventSource-Stream (für SSE).  Dies ermöglicht
  // das Abbrechen des Streams, wenn der Nutzer eine neue Anfrage stellt.
  const eventSourceRef = useRef(null);
  // Sprachverarbeitung: Referenz für die SpeechRecognition-Instanz und Listening-Status
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);

  // Lokaler Input für Buddy-Telefonnummer. Wenn ein Buddy vorhanden ist, wird dieser vorbelegt.
  const [buddyInput, setBuddyInput] = useState(buddy || '');

  // Sendet eine Benachrichtigung an den Buddy via SMS/Telefon. Öffnet die Telefon-App oder den SMS-Client.
  const handleBuddyPing = () => {
    if (!buddy) return;
    try {
      // Formatiere Nachricht. Wir verwenden tel: oder sms:-Link, je nach Browser. SMS funktioniert auf den meisten Geräten.
      const msg = encodeURIComponent(
        lang === 'de'
          ? 'Hilfe benötigt! Ich befinde mich in einer Notfallsituation. Bitte ruf mich schnellstmöglich an.'
          : 'Emergency! I need help. Please call me as soon as possible.'
      );
      // Wenn SMS-Protokoll verfügbar, verwenden wir sms:, ansonsten tel:
      const url = `sms:${buddy}?body=${msg}`;
      window.open(url, '_blank');
    } catch {
      // Fallback: Telefonnummer kopieren
      navigator.clipboard?.writeText(buddy).catch(() => {});
    }
  };

  // Soforthilfe-Mapping: nummerierte Anweisungen für jede Gefahr.
  const compactAdvice = useMemo(() => {
    const t = (de, en) => (lang === 'de' ? de : en);
    return {
      krisen_konflikte: [
        // Kriegerische Konflikte & Terror: Deckung suchen, Behörden informieren, geordnet flüchten
        t('Sofort Deckung hinter festen Wänden oder Möbeln suchen und ruhig bleiben.', 'Immediately seek cover behind solid walls or furniture and stay calm.'),
        t('112 anrufen, Standort und Geschehen kurz schildern.', 'Dial 112, state your location and describe what is happening.'),
        t('Wenn möglich, das Gebiet über sichere Fluchtwege zügig verlassen.', 'If possible, leave the area quickly via safe escape routes.'),
      ],
      brand_feuer: [
        // Feuer & Explosion: geordnet evakuieren, Brand melden, Rauch meiden
        t('Gebäude geordnet verlassen, alle Türen hinter sich schließen.', 'Leave the building in an orderly manner, closing all doors behind you.'),
        t('Notruf 112 wählen und den Brand melden.', 'Call the emergency number 112 and report the fire.'),
        t('Keine Aufzüge benutzen, Rauch meiden und tief unten bleiben.', 'Do not use elevators; avoid smoke and stay low.'),
      ],
      medizinischer_notfall: [
        // Medizinischer Notfall: Unfallstelle sichern, Notruf wählen, Erste Hilfe leisten
        t('Unfallstelle sichern (Warnblinker, Warndreieck).', 'Secure the accident scene (hazard lights, warning triangle).'),
        t('Notruf 112 wählen.', 'Call the emergency number 112.'),
        t('Erste Hilfe leisten, falls möglich.', 'Provide first aid if possible.'),
      ],
      strom_infrastruktur: [
        // Strom- und Infrastrukturausfall: Ruhe bewahren, nur bei Verletzten wählen, Ressourcen sparen
        t('Ruhig bleiben und eine sichere Stelle aufsuchen.', 'Stay calm and find a safe spot.'),
        t('Notruf nur bei Verletzten wählen.', 'Call emergency services only if there are injuries.'),
        t('Vorräte und Lichtquellen sparsam nutzen.', 'Use supplies and light sources sparingly.'),
      ],
      wassergefahren: [
        // Hochwasser & Unwetter: höher gelegene Orte, Strom abschalten, Warnungen beachten
        t('Höher gelegene und trockene Bereiche aufsuchen.', 'Seek higher, dry areas.'),
        t('Strom abstellen.', 'Turn off power.'),
        t('Offizielle Warnmeldungen beachten.', 'Follow official warnings.'),
      ],
      gefahrstoffe_umwelt: [
        // Gefahrstoffe & Umwelt: Abstand halten, in geschlossene Räume gehen, Notruf informieren
        t('Abstand halten.', 'Keep your distance.'),
        t('In geschlossene Räume gehen und Türen/Fenster schließen.', 'Go indoors and close doors/windows.'),
        t('Notruf 112 informieren.', 'Inform emergency services 112.'),
      ],
      naturkatastrophen: [
        // Naturkatastrophen: ruhig bleiben, Schutz suchen, danach geordnet ins Freie
        t('Ruhig bleiben und Schutz unter stabilen Möbeln suchen.', 'Stay calm and seek protection under sturdy furniture.'),
        t('Nach dem Ereignis geordnet ins Freie.', 'After the event, orderly go outside.'),
        t('Notruf 112 wählen, falls nötig.', 'Call 112 if necessary.'),
      ],
      unfall: [
        // Unfall & Technikversagen: Unfallstelle sichern, Notruf wählen, Erste Hilfe
        t('Unfallstelle sichern (Warnblinker, Warndreieck).', 'Secure the accident scene (hazard lights, warning triangle).'),
        t('Notruf 112 wählen.', 'Call the emergency number 112.'),
        t('Erste Hilfe leisten, falls möglich.', 'Provide first aid if possible.'),
      ],
      pandemie: [
        // Pandemie: Hygienemaßnahmen, Distanz, ärztlichen Rat einholen
        t('Abstand halten und Mund‑Nasen‑Schutz tragen.', 'Keep your distance and wear a mask.'),
        t('Hände häufig waschen oder desinfizieren.', 'Wash or disinfect hands frequently.'),
        t('Bei Symptomen zu Hause bleiben und ärztlichen Rat einholen.', 'If symptomatic, stay at home and seek medical advice.'),
      ],
      psychische_krise: [
        // Psychische Krise: Ruhe, Hilfe holen, professionelle Unterstützung
        t('Ruhig atmen und einen sicheren Ort aufsuchen.', 'Breathe calmly and find a safe place.'),
        t('Hilfe in der Nähe rufen.', 'Call for help nearby.'),
        t('Bei anhaltenden Symptomen professionelle Hilfe kontaktieren.', 'If symptoms persist, contact professional help.'),
      ],
      unklare_gefahr: [
        // Unklare Gefahr: Schutz suchen, Notruf bei Verletzten, Abstand zu Gefahrenquellen
        t('Schütze dich vor unmittelbaren Gefahren.', 'Protect yourself from immediate dangers.'),
        t('Notruf 112 wählen, wenn Menschen verletzt sind.', 'Call 112 if people are injured.'),
        t('Halte Abstand zu potenziellen Gefahrenquellen.', 'Keep your distance from potential hazards.'),
      ],
      hitze_uv_duerre: [
        // Hitze, UV & Dürre: Schatten, Flüssigkeit, leichte Kleidung
        t('Schatten aufsuchen und ausreichend trinken.', 'Seek shade and drink plenty of fluids.'),
        t('Leichte, helle Kleidung tragen.', 'Wear light, light‑coloured clothing.'),
        t('Bei Hitzekollaps Notruf 112 wählen.', 'Call 112 in case of heat collapse.'),
      ],
    }[slug] || [];
  }, [slug, lang]);

  const sendMessage = async (question = null) => {
    const textToSend = question ?? input;
    if (!textToSend.trim()) return;
    setLoading(true);
    setError(null);
    // Füge die aktuelle Benutzerfrage zur Unterhaltung hinzu
    const newMessages = [...messages, { role: 'user', content: textToSend }];

    // 1) Klassifikation für freie Beschreibungen
    // Wenn keine konkrete Kategorie ausgewählt wurde oder die Kategorie zu den unspezifischen Slugs gehört
    // (unklare_gefahr, medizinischer_notfall, unfall), versuche anhand der Beschreibung eine Kategorie zu ermitteln.
    // Schritt 1: heuristischer /api/auto-navigate Aufruf
    // Schritt 2: fallback auf GPT-basierte Klassifikation /api/gpt-classify, wenn der Heuristik keine neue Kategorie findet.
    const classifySlugs = ['unklare_gefahr', 'medizinischer_notfall', 'unfall'];
    if ((slug == null || classifySlugs.includes(slug)) && typeof onSelectHazard === 'function') {
      const baseUrl = process.env.REACT_APP_BACKEND_URL || '';
      let detectedSlug = null;
      try {
        const resp = await fetch(`${baseUrl}/api/auto-navigate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: textToSend }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.slug && data.slug !== 'unklare_gefahr') {
            detectedSlug = data.slug;
          }
        }
      } catch {
        // Ignoriere Fehler der Heuristik
      }
      // Fallback: GPT-basierte Klassifikation nur, wenn noch keine neue Kategorie gefunden wurde
      if (!detectedSlug) {
        try {
          const resp2 = await fetch(`${baseUrl}/api/gpt-classify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: textToSend, lang }),
          });
          if (resp2.ok) {
            const data2 = await resp2.json();
            if (data2 && data2.slug && data2.slug !== 'unklare_gefahr') {
              detectedSlug = data2.slug;
            }
          }
        } catch {
          // Ignoriere Fehler der GPT-Klassifikation und fahre normal fort
        }
      }
      // Wenn eine andere Gefahrenkategorie erkannt wurde und diese nicht der aktuellen entspricht, lade den Baum
      if (detectedSlug && detectedSlug !== slug) {
        try {
          onSelectHazard(detectedSlug);
        } catch {}
        // Automatisches Öffnen des Life-Saver-Modus
        if (typeof onLifeSaver === 'function') {
          onLifeSaver();
        }
        // Belasse die Eingabe, damit der Nutzer sie erneut senden kann
        setInput(textToSend);
        setLoading(false);
        return;
      }
    }
    try {
      const baseUrl = process.env.REACT_APP_BACKEND_URL || '';
      let url;
      let payload;
      // Bestimme, ob wir den Grounded-Endpunkt verwenden (slug vorhanden)
      if (slug) {
      // Prüfe, ob wir Streaming (Server‑Sent Events) nutzen können. iOS/Safari unterstützt SSE nur eingeschränkt, daher fallback auf HTTP.
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
      const isIOS = /iP(hone|od|ad)/.test(ua) || /Safari/.test(ua) && !/Chrome/.test(ua);
      const supportsSSE = typeof window !== 'undefined' && 'EventSource' in window && !isIOS;
        // Beende einen eventuell noch laufenden Stream
        if (eventSourceRef.current) {
          try {
            eventSourceRef.current.close();
          } catch {}
          eventSourceRef.current = null;
        }
        // Wir verwenden SSE-Streaming für slug-basierte Konversationen.  Füge einen leeren
        // Assistentenplatzhalter hinzu, damit das UI sofort reagiert.
        const assistantPlaceholder = { role: 'assistant', content: '' };
        setMessages([...newMessages, assistantPlaceholder]);
        // Generiere eine Anfrage-ID zur Nachverfolgbarkeit
        const requestId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      // Baue URL mit Query-Parametern (slug, question, lang, context)
      const qs = new URLSearchParams({
        slug,
        question: textToSend,
        lang,
        context: context || '',
      }).toString();
      if (supportsSSE) {
        const urlStream = `${baseUrl}/api/grounded-answer-stream?${qs}`;
        const es = new EventSource(urlStream, { withCredentials: false });
        eventSourceRef.current = es;
        es.onmessage = (event) => {
          const token = event.data;
          // Append token to the last assistant message
          setMessages((prev) => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
              updated[lastIndex] = { ...updated[lastIndex], content: (updated[lastIndex].content || '') + token };
            }
            return updated;
          });
        };
        es.addEventListener('meta', (event) => {
          try {
            const meta = JSON.parse(event.data || '{}');
            // Sende Telemetrie, wenn Knoten vorhanden
            if (meta.used_nodes) {
              const metric = {
                slug: slug || null,
                used_nodes: meta.used_nodes,
                online: typeof navigator !== 'undefined' ? navigator.onLine : null,
                lang,
                request_id: requestId,
                timestamp: Date.now(),
              };
              fetch(`${baseUrl}/api/telemetry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(metric),
              }).catch(() => {});
            }
          } catch {}
          // Stream ist beendet
          setLoading(false);
          if (question === null) setInput('');
          // Schließe den Stream
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
        });
        es.addEventListener('error', (event) => {
          // Beim Error versuchen wir, einen Fallback auf HTTP zu machen
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
          // Fallback auf Nicht-Streaming
          fallbackGroundedAnswer(slug, textToSend, lang, context, newMessages, requestId);
        });
        return;
      } else {
        // Kein SSE oder iOS: nutze Fallback
        fallbackGroundedAnswer(slug, textToSend, lang, context, newMessages, requestId);
        return;
      }
      } else {
        // Klassischer Chat-Endpunkt ohne slug oder für unklare Gefahren
        url = `${baseUrl}/api/chat`;
        // Systemprompt definieren: extrem kurze, klare Anweisungen im Imperativ.
        const systemMsg = {
          role: 'system',
          content:
            'Du bist ein Notfall-Assistent. Antworte extrem kurz, klar und im Imperativ. Vermeide Floskeln und liefere konkrete, sofort ausführbare Anweisungen (maximal zwei Sätze).',
        };
        const messagesToSend = [systemMsg, ...newMessages];
        payload = { messages: messagesToSend, slug, context };
      }
      // Wenn kein slug: HTTP-POST mit Retry
      const requestId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const fetchWithRetry = async (attempt = 0) => {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-request-id': requestId,
            },
            body: JSON.stringify(payload),
          });
          if (!response.ok) {
            let errMsg = 'Fehler bei der Chat‑Anfrage';
            try {
              const errData = await response.json();
              errMsg = errData.detail || errData.error || errMsg;
            } catch {}
            throw new Error(errMsg);
          }
          return response;
        } catch (err) {
          if (attempt >= 3) throw err;
          const delay = Math.pow(2, attempt) * 500;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return fetchWithRetry(attempt + 1);
        }
      };
      const response = await fetchWithRetry();
      const contentType = response.headers.get('content-type') || '';
      let data;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { content: text };
      }
      const content = data.answer || data.content || data.answer;
      if (!content) {
        throw new Error('Antwort konnte nicht gelesen werden');
      }
      const botMessage = { role: 'assistant', content };
      setMessages([...newMessages, botMessage]);
      if (question === null) setInput('');
      if (data.used_nodes) {
        try {
          const metric = {
            slug: slug || null,
            used_nodes: data.used_nodes,
            online: typeof navigator !== 'undefined' ? navigator.onLine : null,
            lang,
            request_id: requestId,
            timestamp: Date.now(),
          };
          fetch(`${baseUrl}/api/telemetry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(metric),
          }).catch(() => {});
        } catch {}
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fallback-Funktion für den Fall, dass Server‑Sent Events nicht verfügbar sind oder
   * die Verbindung fehlschlägt.  Sie sendet eine POST‑Anfrage an den
   * /api/grounded-answer‑Endpunkt und fügt die Antwort in den Chat ein.
   *
   * @param {string} slugSlug Die aktuelle Gefahrenkategorie
   * @param {string} textFrage Die Benutzerfrage
   * @param {string} sprache Sprachcode
   * @param {string|null} kontext Kontextinformationen (z. B. Aufenthaltsort)
   * @param {Array} newMessages Die aktuellen Nachrichten (inkl. Nutzerfrage)
   * @param {string} reqId Eine zufällig generierte Request‑ID
   */
  async function fallbackGroundedAnswer(slugSlug, textFrage, sprache, kontext, newMessages, reqId) {
    try {
      const baseUrl = process.env.REACT_APP_BACKEND_URL || '';
      const response = await fetch(`${baseUrl}/api/grounded-answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': reqId,
        },
        body: JSON.stringify({ slug: slugSlug, question: textFrage, lang: sprache, context: kontext }),
      });
      if (!response.ok) {
        let errMsg = 'Fehler bei der Chat‑Anfrage';
        try {
          const errData = await response.json();
          errMsg = errData.detail || errData.error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }
      const data = await response.json();
      const answer = data.answer || '';
      const botMessage = { role: 'assistant', content: answer };
      setMessages([...newMessages, botMessage]);
      setLoading(false);
      // Leere Input nur, wenn die Frage aus dem Eingabefeld stammt
      if (textFrage === input) setInput('');
      // Telemetrie senden, wenn Knoten vorliegen
      if (data.used_nodes) {
        try {
          const metric = {
            slug: slugSlug || null,
            used_nodes: data.used_nodes,
            online: typeof navigator !== 'undefined' ? navigator.onLine : null,
            lang: sprache,
            request_id: reqId,
            timestamp: Date.now(),
          };
          fetch(`${baseUrl}/api/telemetry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(metric),
          }).catch(() => {});
        } catch {}
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /**
   * Startet oder stoppt die Sprachaufnahme.  Wenn der Browser die
   * Web‑Speech‑API unterstützt, wird ein SpeechRecognition‑Objekt
   * instanziiert, die Sprache auf Deutsch oder Englisch gesetzt und
   * nach der Transkription automatisch eine Frage an den Chat gestellt.
   * Wenn bereits aufgenommen wird, beendet ein erneuter Klick die
   * Aufnahme.
   */
  const handleVoice = () => {
    // Prüfe Unterstützung der API
    if (typeof window === 'undefined' || (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window))) {
      setError(lang === 'de' ? 'Spracherkennung wird in diesem Browser nicht unterstützt.' : 'Speech recognition is not supported in this browser.');
      return;
    }
    // Wenn bereits eine Aufnahme läuft, abbrechen
    if (listening) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = lang === 'de' ? 'de-DE' : 'en-US';
    recognition.interimResults = false;
    recognition.onstart = () => {
      setListening(true);
      setError(null);
    };
    recognition.onend = () => {
      setListening(false);
    };
    recognition.onerror = (event) => {
      setError(lang === 'de' ? 'Fehler bei der Spracherkennung.' : 'Speech recognition error.');
      setListening(false);
    };
    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      transcript = transcript.trim();
      if (transcript) {
        setInput(transcript);
        // Frage direkt absenden
        sendMessage(transcript);
      }
    };
    try {
      recognition.start();
    } catch (err) {
      // Kann z.B. auftreten, wenn schon eine Erkennung läuft
      setError(lang === 'de' ? 'Spracherkennung konnte nicht gestartet werden.' : 'Could not start speech recognition.');
    }
  };

  // Text‑to‑Speech: Lies die Sofortanweisungen oder die letzte Antwort vor.
  useEffect(() => {
    // Wenn der Browser keine Sprachsynthese unterstützt, nichts tun
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    // Wenn noch keine Unterhaltung geführt wurde und es Sofortanweisungen gibt
    if (!ttsEnabled) return;
    if (messages.length === 0 && compactAdvice.length > 0) {
      const text = compactAdvice.join('. ');
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'de' ? 'de-DE' : 'en-US';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } else if (messages.length > 0) {
      // Lies nur die letzte Bot‑Nachricht vor
      const last = messages[messages.length - 1];
      if (last && last.role === 'assistant') {
        const utterance = new SpeechSynthesisUtterance(last.content);
        utterance.lang = lang === 'de' ? 'de-DE' : 'en-US';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [messages, compactAdvice, lang, ttsEnabled]);

  return (
    <div className="chat-assistant">
      <div className="chat-header">
        <h3>Chat‑Assistent</h3>
        <button onClick={onClose}>×</button>
      </div>
      {/* Risiko-Hinweis und Buddy-Optionen */}
      {riskLevel && riskLevel !== 'low' && (
        <div
          style={{
            backgroundColor: riskLevel === 'high' ? '#c30000' : '#d97706',
            color: '#fff',
            padding: '0.5rem',
            borderRadius: '4px',
            marginBottom: '0.5rem',
          }}
        >
          <div style={{ fontWeight: '700' }}>
            {riskLevel === 'high'
              ? lang === 'de'
                ? 'Lebensbedrohliche Gefahr!'
                : 'Life-threatening emergency!'
              : lang === 'de'
              ? 'Achtung – ernste Gefahr!'
              : 'Caution – serious danger!'}
          </div>
          <div style={{ marginTop: '0.25rem' }}>
            {riskLevel === 'high'
              ? lang === 'de'
                ? 'Bitte sofort den Notruf 112 wählen.'
                : 'Please dial 112 immediately.'
              : lang === 'de'
              ? 'Bitte beobachte die Situation genau und wähle bei Verschlechterung 112.'
              : 'Monitor the situation and call emergency services if it deteriorates.'}
          </div>
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* CTA: Notruf anrufen */}
            {riskLevel === 'high' && (
              <a
                href="tel:112"
                style={{
                  backgroundColor: '#004080',
                  color: '#fff',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  fontWeight: '600',
                }}
              >
                {lang === 'de' ? '112 anrufen' : 'Call 112'}
              </a>
            )}
            {/* Buddy-Ping: falls ein Buddy vorhanden, Button zum Benachrichtigen */}
            {riskLevel === 'high' && buddy && (
              <button
                onClick={handleBuddyPing}
                style={{
                  backgroundColor: '#006600',
                  color: '#fff',
                  padding: '0.4rem 0.8rem',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {lang === 'de' ? 'Buddy benachrichtigen' : 'Notify buddy'}
              </button>
            )}
            {/* Eingabe zur Buddy-Hinterlegung */}
            {riskLevel === 'high' && !buddy && onBuddyChange && (
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  value={buddyInput}
                  onChange={(e) => setBuddyInput(e.target.value)}
                  placeholder={lang === 'de' ? 'Buddy-Telefon…' : 'Buddy phone…'}
                  style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }}
                />
                <button
                  onClick={() => onBuddyChange?.(buddyInput)}
                  style={{
                    backgroundColor: '#006600',
                    color: '#fff',
                    padding: '0.4rem 0.8rem',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {lang === 'de' ? 'Buddy speichern' : 'Save buddy'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Unterkategorien für medizinische Notfälle: wenn der slug 'medizinischer_notfall' ist, zeigen wir Auswahloptionen an. */}
      {slug === 'medizinischer_notfall' && subHazards && subHazards.length > 0 && onSelectHazard && (
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.5rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: '#f9f9f9',
          }}
        >
          <p style={{ marginBottom: '0.5rem', fontWeight: '600' }}>
            {lang === 'de'
              ? 'Bitte wähle die Art des medizinischen Notfalls:'
              : 'Please select the type of medical emergency:'}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {subHazards.map((item) => (
              <button
                key={item.slug}
                onClick={() => onSelectHazard(item.slug)}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.4rem 0.8rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="chat-messages">
        {/* Wenn keine Unterhaltung geführt wurde, Soforthilfe anzeigen */}
        {messages.length === 0 && compactAdvice.length > 0 && (
          <div className="chat-placeholder">
            {compactAdvice.map((line, idx) => (
              <div key={idx} style={{ margin: '6px 0', fontWeight: '600' }}>
                {idx + 1}. {line}
              </div>
            ))}
            {/* Hinweis für Freitextbeschreibung und Datenschutz. */}
            <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#555' }}>
              {lang === 'de'
                ? 'Du kannst die Situation kurz beschreiben, um weitere Hilfe zu erhalten. Bitte keine Fotos – das könnte die Privatsphäre der Betroffenen verletzen.'
                : 'You can briefly describe the situation for further guidance. Please do not send photos – this could violate the privacy of those involved.'}
            </p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={msg.role === 'user' ? 'chat-message user' : 'chat-message bot'}
          >
            <strong>{msg.role === 'user' ? (lang === 'de' ? 'Du' : 'You') : (lang === 'de' ? 'Assistent' : 'Assistant')}:</strong>{' '}
            {msg.content}
          </div>
        ))}
        {loading && <div className="chat-message bot">…</div>}
        {error && <div className="chat-error">{error}</div>}
      </div>
      {/* Keine Vorschlagsbuttons – direkte Soforthilfe genügt */}
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={lang === 'de' ? 'Deine Frage…' : 'Your question…'}
        rows={3}
      ></textarea>
      {/* Eingabe-Controls: Mikrofon und Senden */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        {/* Mikrofon-Button: nur anzeigen, wenn Spracherkennung verfügbar */}
        {typeof window !== 'undefined' && (('SpeechRecognition' in window) || ('webkitSpeechRecognition' in window)) && (
          <button
            onClick={handleVoice}
            disabled={loading}
            style={{
              flex: '0 0 auto',
              backgroundColor: listening ? '#d97706' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '0.5rem 0.75rem',
              cursor: 'pointer',
            }}
          >
            {listening
              ? lang === 'de'
                ? 'Höre…'
                : 'Listening…'
              : lang === 'de'
              ? 'Sprache'
              : 'Voice'}
          </button>
        )}
        <button
          onClick={() => sendMessage()}
          disabled={loading}
          style={{
            flex: '0 0 auto',
            backgroundColor: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
          }}
        >
          {lang === 'de' ? 'Senden' : 'Send'}
        </button>
      </div>
      {/* Life‑Saver‑Modus: Zeige Button, wenn Callback vorhanden und ein slug gesetzt ist */}
      {onLifeSaver && slug && (
        <button
          onClick={() => onLifeSaver?.()}
          disabled={loading}
          style={{ marginTop: '0.5rem' }}
        >
          {lang === 'de' ? 'Schritt‑für‑Schritt' : 'Life‑Saver Mode'}
        </button>
      )}
    </div>
  );
};

export default ChatAssistant;