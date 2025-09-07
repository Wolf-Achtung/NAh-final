import React, { useEffect, useState } from 'react';
import './App.css';
// Adaptive UI styles to adjust font sizes and contrasts based on persona
import './adaptive.css';
import DecisionTreeViewer from './components/DecisionTreeViewer';
import ChatAssistant from './components/ChatAssistant';
import AutoNavigator from './components/AutoNavigator';
import LifeSaverMode from './components/LifeSaverMode';
import FirstAidTabs from './components/FirstAidTabs';
import LearningCard from './components/LearningCard';
import ShareLocationButton from './components/ShareLocationButton';
import PersonalInfoToolkit from './components/PersonalInfoToolkit';
import TipsModal from './components/TipsModal';
import FeedbackForm from './components/FeedbackForm';
import Settings from './components/Settings';
import { ContextEngine } from './lib/contextEngine';
import { logEvent } from './lib/telemetry';
// Import the offline map component which will be displayed in a modal
// when the user completes the emergency navigator. This component
// receives a list of POI types and shows the nearest relevant
// facilities on a map.
import OfflineMap from './components/OfflineMap';
import ContextSelector from './components/ContextSelector';
// CrisisNavigator ist die ältere Version des Navigators. Da er nur drei
// Fragen stellt, ersetzt ihn der neue QuickNavigator, der mehr
// Kontextfragen und eine klarere Priorisierung beinhaltet.
import QuickNavigator from './components/QuickNavigator.jsx';

// Emoji‑Mapping für die neuen Gefahrenkategorien.  Jede Kategorie erhält
// ein passendes Symbol, das intuitiv für die jeweilige Gefahr steht.  Die
// alten Schlüssel aus der vorherigen Version (unwetter, blackout etc.)
// wurden entfernt, da sie nun in übergeordnete Kategorien integriert
// wurden.
const icons = {
  strom_infrastruktur: '⚡',        // Strom- & Infrastrukturausfall
  brand_feuer: '🔥',               // Feuer & Explosion
  naturkatastrophen: '🌍',         // Erdbeben, Lawinen etc.
  gefahrstoffe_umwelt: '☣️',        // Chemikalien
  wassergefahren: '🌊',            // Hochwasser & Unwetter
  krisen_konflikte: '🚨',          // Kriegerische Konflikte, Terror, Evakuierung
  pandemie: '🦠',                  // Gesundheitliche Bedrohung
  unfall: '🚑',                    // Unfall & Technikversagen
  unklare_gefahr: '❓',            // Unklare Gefahrensituation
  medizinischer_notfall: '🩺',      // Medizinischer Notfall
  psychische_krise: '🧠',         // Psychische Krise
  hitze_uv_duerre: '☀️',         // Hitze, UV & Dürre

  // Neue Gefahrenkategorien
  blutung_stark: '🩸',            // Starke Blutung
  stabile_seitenlage: '🛌',       // Stabile Seitenlage
  unfall_sofortmassnahmen: '🚨',  // Unfall – Sofortmaßnahmen
  notruf: '📞',                   // Notruf 112
  lawine: '🏔️',                   // Lawinenwarnung
  

};

// Lernkarten für alle Gefahrenkategorien.  Jede Kategorie enthält eine
// Liste von Karten mit Titel und Text. Diese Anweisungen sind bewusst
// kompakt gehalten und können später durch professionelle Videos ersetzt
// werden.
const learningCards = {
  stabile_seitenlage: [
    {
      title: 'Stabile Seitenlage – Schritt 1',
      body: 'Knie dich seitlich neben die Person. Strecke den nahen Arm nach oben über den Kopf und stelle das ferne Bein mit dem Knie auf.',
      // Zeige ein Symbol, das die stabile Lage verdeutlicht. Dieses Bild wird offline
      // mit dem Service Worker gecached und unter /media/children_symbol.png bereitgestellt.
      imgSrc: '/media/children_symbol.png'
    },
    { title: 'Stabile Seitenlage – Schritt 2', body: 'Greife die ferne Hand, lege sie an die Wange der Person und halte sie dort. Greife dann das ferne Bein am Knie und ziehe die Person behutsam zu dir.' },
    { title: 'Stabile Seitenlage – Schritt 3', body: 'Lege den Kopf leicht nach hinten, damit die Atemwege frei bleiben. Überprüfe regelmäßig die Atmung, bis der Rettungsdienst eintrifft.' },
  ],
  blutung_stark: [
    {
      title: 'Starke Blutung – Druck ausüben',
      body: 'Ziehe wenn möglich Einmalhandschuhe an. Drücke mit einem Verbandstuch oder sauberen Tuch direkt auf die Wunde.',
      imgSrc: '/media/emergency_symbol.png'
    },
    { title: 'Starke Blutung – Hochlagern', body: 'Lagere die verletzte Extremität hoch. Fixiere den Druckverband fest mit einer Binde oder einem Schal und kontrolliere regelmäßig, ob die Blutung nachlässt.' },
  ],
  herzstillstand: [
    {
      title: 'Herzdruckmassage',
      body: 'Lege die übereinander gelegten Handballen in die Mitte des Brustkorbs. Drücke kräftig 100–120 Mal pro Minute etwa 5–6 cm tief. Nach 30 Kompressionen zwei Beatmungen, falls möglich.',
      imgSrc: '/media/emergency_symbol.png'
    },
    { title: 'Defibrillator nutzen', body: 'Ist ein automatisierter externer Defibrillator (AED) verfügbar, schalte ihn ein und folge den gesprochenen Anweisungen.' },
  ],
  schlaganfall: [
    {
      title: 'FAST‑Schema',
      body: 'F – Face: Bitten Sie die Person zu lächeln. Hängt ein Mundwinkel?\nA – Arms: Kann sie beide Arme heben?\nS – Speech: Ist die Sprache verwaschen?\nT – Time: Zeit ist entscheidend – sofort 112 wählen!',
      imgSrc: '/media/emergency_symbol.png'
    },
    { title: 'Ruhe bewahren', body: 'Beruhige die Person, notiere den Zeitpunkt der ersten Symptome und bleibe bei ihr, bis der Rettungsdienst kommt.' },
  ],
  herzinfarkt: [
    {
      title: 'Anzeichen erkennen',
      body: 'Druck oder Enge in der Brust, ausstrahlende Schmerzen in Arm, Kiefer oder Rücken, Luftnot oder kalter Schweiß können auf einen Herzinfarkt hinweisen.',
      imgSrc: '/media/emergency_symbol.png'
    },
    { title: 'Richtig handeln', body: 'Setze die Person aufrecht, öffne beengende Kleidung und wähle sofort 112. Bei Bewusstlosigkeit und fehlender Atmung Wiederbelebung beginnen.' },
  ],
  hypoglykaemie: [
    {
      title: 'Hypoglykämie erkennen',
      body: 'Anzeichen für einen niedrigen Blutzucker sind Zittern, Schweißausbruch, Heißhunger, Unruhe oder Verwirrtheit. Wenn vorhanden, Blutzucker messen.',
      imgSrc: '/media/emergency_symbol.png'
    },
    { title: 'Schnelle Hilfe', body: 'Gib dem Betroffenen schnell wirkende Kohlenhydrate wie Traubenzucker, Saft oder süßen Tee. Bei Bewusstlosigkeit stabile Seitenlage, keinen Zucker einflößen und 112 rufen.' },
  ],
  krampfanfall: [
    {
      title: 'Krampfanfall – Sicherheit',
      body: 'Räume gefährliche Gegenstände weg und schütze den Kopf der Person mit einer weichen Unterlage. Halte sie nicht fest und versuche nicht, den Mund zu öffnen.',
      imgSrc: '/media/children_symbol.png'
    },
    { title: 'Nach dem Anfall', body: 'Überprüfe Atmung, lege die Person in stabile Seitenlage. Rufe 112, wenn der Anfall länger als 5 Minuten dauert oder wiederholt auftritt.' },
  ],
  atemnot: [
    {
      title: 'Atemnot – Ruhe bewahren',
      body: 'Setze die Person aufrecht hin, öffne enge Kleidung und sorge für frische Luft. Beruhige sie und vermeide Anstrengung.',
      imgSrc: '/media/emergency_symbol.png'
    },
    { title: 'Notruf absetzen', body: 'Rufe 112, wenn die Atemnot stark ausgeprägt ist, plötzlich auftritt oder mit Schmerzen in der Brust verbunden ist.' },
  ],
  anaphylaxie: [
    {
      title: 'Anaphylaxie erkennen',
      body: 'Symptome eines allergischen Schocks sind Schwellungen im Gesicht, Atemnot, Hautausschlag oder Kreislaufprobleme. Die Situation ist lebensbedrohlich.',
      imgSrc: '/media/emergency_symbol.png'
    },
    { title: 'Sofortmaßnahmen', body: 'Rufe umgehend 112. Verwende einen Adrenalin‑Autoinjektor (EpiPen), falls vorhanden, und hilf der Person, stabil zu sitzen oder zu liegen.' },
  ],
  unfall_sofortmassnahmen: [
    {
      title: 'Unfall – Absicherung',
      body: 'Sichere die Unfallstelle mit Warnblinker und Warndreieck. Ziehe eine Warnweste an und behalte die Situation im Blick.',
      imgSrc: '/media/emergency_symbol.png'
    },
    { title: 'Notruf und Erste Hilfe', body: 'Wähle 112 und schildere kurz, was passiert ist. Leiste Erste Hilfe: befreie die Atemwege, stille Blutungen und überwache die Person bis Hilfe eintrifft.' },
  ],
  notruf: [
    {
      title: 'Notruf 112',
      body: 'Bleibe ruhig, nenne deinen Namen, den Ort des Geschehens und beschreibe knapp die Situation. Beantworte Rückfragen und lege nicht auf, bis die Leitstelle auflegt.',
      imgSrc: '/media/emergency_symbol.png'
    },
  ],
  lawine: [
    {
      title: 'Lawinenunfall – Erstmaßnahmen',
      body: 'Beobachte die Schneemassen und merke dir den letzten Punkt, an dem du die verschüttete Person gesehen hast. Markiere die Stelle.',
      imgSrc: '/media/emergency_symbol.png'
    },
    { title: 'Alarmieren und bergen', body: 'Wähle sofort 112 und beginne, die verschüttete Person freizulegen. Arbeite schnell und vorsichtig, halte die Atemwege frei und halte die Person warm.' },
  ],
  brand_feuer: [
    {
      title: 'Brand – Evakuierung',
      body: 'Verlasse das Gebäude sofort, schließe Türen hinter dir und benutze keine Aufzüge. Warne andere und hilf bei der Evakuierung.',
      imgSrc: '/media/emergency_symbol.png'
    },
    { title: 'Notruf absetzen', body: 'Rufe 112, nenne deinen Standort und beschreibe den Brand. Versuche nicht, große Brände selbst zu löschen.' },
  ],
  strom_infrastruktur: [
    {
      title: 'Stromausfall – Ruhe bewahren',
      body: 'Bleibe ruhig und überprüfe, ob der Ausfall nur deine Wohnung betrifft. Schalte elektrische Geräte aus, um Schäden zu vermeiden.',
      imgSrc: '/media/emergency_symbol.png'
    },
    { title: 'Information und Hilfe', body: 'Höre Radio oder nutze dein Smartphone, um Informationen zu erhalten. Bei Verletzten wähle 112.' },
  ],
  krisen_konflikte: [
    {
      title: 'Krisen & Konflikte – Deckung suchen',
      body: 'Bringe dich hinter festen Wänden oder Möbeln in Sicherheit und bleibe ruhig.',
      imgSrc: '/media/emergency_symbol.png'
    },
    { title: 'Behörden informieren', body: 'Rufe 112, nenne deinen Standort und beschreibe die Situation. Verlasse den Gefahrenbereich nur auf sichere Weise.' },
  ],
  wassergefahren: [
    {
      title: 'Hochwasser – Höhe suchen',
      body: 'Begebe dich sofort in höher gelegene Bereiche und meide überflutete Straßen oder Unterführungen.',
      imgSrc: '/media/emergency_symbol.png'
    },
    { title: 'Strom abschalten', body: 'Schalte den Strom im Haus ab, um Stromschläge zu vermeiden. Beachte offizielle Warnungen.' },
  ],
  gefahrstoffe_umwelt: [
    {
      title: 'Gefahrstoffe – Abstand halten',
      body: 'Halte Abstand zu der Gefahrenquelle, vermeide Rauch oder Dämpfe. Bringe dich in geschlossene Räume und schließe Fenster und Türen.',
      imgSrc: '/media/emergency_symbol.png'
    },
    { title: 'Notruf', body: 'Informiere die Feuerwehr unter 112 und bleibe auf Abstand, bis die Gefahr gebannt ist.' },
  ],
  naturkatastrophen: [
    {
      title: 'Naturkatastrophe – Schutz suchen',
      body: 'Suche Schutz unter stabilen Möbeln oder an einer tragenden Wand. Bedecke Kopf und Nacken.',
      imgSrc: '/media/emergency_symbol.png'
    },
    { title: 'Nach dem Ereignis', body: 'Verlasse das Gebäude vorsichtig, meide beschädigte Bereiche und achte auf offizielle Anweisungen.' },
  ],
  pandemie: [
    {
      title: 'Pandemie – Hygiene',
      body: 'Halte Abstand, trage einen Mund‑Nasen‑Schutz und wasche regelmäßig deine Hände.',
      imgSrc: '/media/emergency_symbol.png'
    },
    { title: 'Symptome beachten', body: 'Bleibe bei Symptomen zu Hause, kontaktiere einen Arzt und folge offiziellen Gesundheitsanweisungen.' },
  ],
  psychische_krise: [
    {
      title: 'Psychische Krise – Ruhe',
      body: 'Atme ruhig, suche einen sicheren Ort und sprich mit einer vertrauten Person.',
      imgSrc: '/media/emergency_symbol.png'
    },
    { title: 'Hilfe holen', body: 'Bei anhaltenden Symptomen kontaktiere einen Krisendienst, einen Arzt oder vertraue dich jemandem an. Wähle 112 bei unmittelbarer Gefahr.' },
  ],
  hitze_uv_duerre: [
    {
      title: 'Hitze – Abkühlung',
      body: 'Suche Schatten, trinke ausreichend Wasser und vermeide direkte Sonne.',
      imgSrc: '/media/emergency_symbol.png'
    },
    { title: 'UV‑Schutz', body: 'Trage helle Kleidung, Hut und Sonnencreme. Bei starken Symptomen wie Hitzschlag 112 anrufen.' },
  ],
  unfall: [
    {
      title: 'Unfall – Absicherung',
      body: 'Sichere die Unfallstelle mit Warndreieck und Warnblinker. Verschaffe dir einen Überblick.',
      imgSrc: '/media/emergency_symbol.png'
    },
    { title: 'Erste Hilfe', body: 'Leiste Erste Hilfe, stille Blutungen und überwache die Person. Rufe 112, wenn Verletzungen vorliegen.' },
  ],
  medizinischer_notfall: [
    {
      title: 'Medizinischer Notfall – Notruf',
      body: 'Rufe sofort 112, schildere den Zustand der Person und befolge die Anweisungen der Leitstelle.',
      imgSrc: '/media/emergency_symbol.png'
    },
    { title: 'Erste Hilfe', body: 'Sichere die Person, prüfe Atmung und Vitalzeichen und leiste Erste Hilfe nach Bedarf.' },
  ],
  unklare_gefahr: [
    {
      title: 'Unklare Gefahr – Sicherheit',
      body: 'Bringe dich und andere in Sicherheit, halte Abstand zu potenziellen Gefahrenquellen.',
      imgSrc: '/media/emergency_symbol.png'
    },
    { title: 'Information einholen', body: 'Verfolge offizielle Meldungen und rufe 112, wenn Menschen verletzt sind oder akute Gefahr besteht.' },
  ],
};

function App() {
  const [hazards, setHazards] = useState([]);
      const [tree, setTree] = useState(null);
      // Kurzbeschreibung (Summary) der gewählten Gefahr
      const [summary, setSummary] = useState(null);
  const [currentSlug, setCurrentSlug] = useState(null);
  const [lang, setLang] = useState('de');
  const [simpleText, setSimpleText] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
       const [chatOpen, setChatOpen] = useState(false);
       const [context, setContext] = useState(null);

  // Metadaten über die Gefahren (Name, Beschreibung, Synonyme, gültige Aufenthaltsorte)
  const [hazardMeta, setHazardMeta] = useState({});

  // Buddy-Kontakt: Telefonnummer oder andere Erreichbarkeit, die der Nutzer hinterlegen kann.
  const [buddy, setBuddy] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('buddyContact') || '';
    }
    return '';
  });

  // Risiko-Einstufung für die aktuell gewählte Kategorie. Kann "low", "medium" oder "high" sein.
  const [risk, setRisk] = useState('medium');

  // Modal visibility states
  const [infoOpen, setInfoOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tipsForHazard, setTipsForHazard] = useState([]);

  // Context engine reference to manage sensors
  const contextRef = React.useRef(null);

  // Initialize context engine and sensor preference on mount
  useEffect(() => {
    const ce = new ContextEngine();
    contextRef.current = ce;
    const sensorsEnabled = (typeof localStorage !== 'undefined') ? localStorage.getItem('sensorsEnabled') !== 'false' : true;
    if (sensorsEnabled) ce.enable();
    return () => {
      ce.disable();
    };
  }, []);

  // Mapping von Slug zu Risiko-Stufe. Kategorien mit potenziell lebensbedrohlicher Gefahr erhalten "high".
  const riskLevels = {
    // Hohe Gefahr: unverzüglich Notruf, da unmittelbare Lebensgefahr besteht
    brand_feuer: 'high',
    krisen_konflikte: 'high',
    medizinischer_notfall: 'high',
    unfall: 'high',
    blutung_stark: 'high',
    stabile_seitenlage: 'high',
    unfall_sofortmassnahmen: 'high',
    notruf: 'high',
    lawine: 'high',
    herzstillstand: 'high',
    herzinfarkt: 'high',
    schlaganfall: 'high',
    anaphylaxie: 'high',
    atemnot: 'high',
    krampfanfall: 'high',
    hypoglykaemie: 'high',
    psychische_krise: 'medium',
    wassergefahren: 'medium',
    gefahrstoffe_umwelt: 'medium',
    naturkatastrophen: 'medium',
    strom_infrastruktur: 'medium',
    pandemie: 'medium',
    hitze_uv_duerre: 'medium',
    unklare_gefahr: 'medium',
    // Default: medium für alle weiteren
  };

  // Lade Tipps, wenn sich der aktuelle Slug ändert
  useEffect(() => {
    if (!currentSlug) {
      setTipsForHazard([]);
      return;
    }
    // Tipps aus dem JSON laden
    fetch('/data/tips.json')
      .then((r) => r.json())
      .then((data) => {
        setTipsForHazard(data[currentSlug] || []);
      })
      .catch(() => setTipsForHazard([]));
  }, [currentSlug]);

  // Speichert den Buddy-Kontakt in localStorage und im State
  const handleBuddyChange = (contact) => {
    setBuddy(contact);
    if (typeof window !== 'undefined') {
      localStorage.setItem('buddyContact', contact);
    }
  };

  // Liste der verfügbaren medizinischen Unterkategorien (z.B. Herzstillstand, Schlaganfall),
  // die angezeigt werden, wenn ein allgemeiner medizinischer Notfall erkannt wird.
  // Die Namen werden aus den Metadaten in der aktuellen Sprache entnommen.
  const medicalSubhazards = React.useMemo(() => {
    // Slugs für medizinische Notfälle – in der Reihenfolge der Dringlichkeit.
    const slugs = [
      'herzstillstand',
      'schlaganfall',
      'herzinfarkt',
      'hypoglykaemie',
      'krampfanfall',
      'atemnot',
      'anaphylaxie',
      'blutung_stark',
      'stabile_seitenlage',
    ];
    return slugs
      .filter((s) => hazardMeta && hazardMeta[s])
      .map((s) => {
        const meta = hazardMeta[s] || {};
        const name = meta.name && meta.name[lang] ? meta.name[lang] : s;
        return { slug: s, name };
      });
  }, [hazardMeta, lang]);

  // Labels für Aufenthaltsorte in verschiedenen Sprachen.  Diese
  // Übersetzungen ermöglichen es, dynamisch die passenden Buttons für
  // unterschiedliche Gefahren anzuzeigen.  Weitere Sprachen können
  // problemlos ergänzt werden.
  const locationLabels = {
    home: {
      de: 'Ich bin zu Hause / im Gebäude',
      en: 'I am at home / in a building',
      fr: 'Je suis chez moi / dans un bâtiment',
      es: 'Estoy en casa / en un edificio',
      it: 'Sono a casa / in un edificio'
    },
    outside: {
      de: 'Ich bin im Freien',
      en: 'I am outdoors',
      fr: 'Je suis dehors',
      es: 'Estoy afuera',
      it: 'Sono all\'aperto'
    },
    car: {
      de: 'Ich bin im Auto',
      en: 'I am in the car',
      fr: 'Je suis en voiture',
      es: 'Estoy en el coche',
      it: 'Sono in auto'
    },
    public_transport: {
      de: 'Ich bin in öffentlichen Verkehrsmitteln (Bus, Bahn, Tram)',
      en: 'I am in public transport (bus, train, tram)',
      fr: 'Je suis dans les transports en commun (bus, train, tram)',
      es: 'Estoy en transporte público (autobús, tren, tranvía)',
      it: 'Sono sui mezzi pubblici (autobus, treno, tram)'
    },
    facility: {
      de: 'Ich bin in einer Gemeinschaftseinrichtung (Schule, Klinik, Hotel, Halle)',
      en: 'I am in a facility (school, clinic, hotel, hall)',
      fr: 'Je suis dans un établissement (école, clinique, hôtel, hall)',
      es: 'Estoy en una instalación (escuela, clínica, hotel, sala)',
      it: 'Sono in una struttura (scuola, clinica, hotel, sala)'
    },
    underground: {
      de: 'Ich bin unter Tage (Tunnel, U-Bahn, Keller)',
      en: 'I am underground (tunnel, subway, basement)',
      fr: 'Je suis sous terre (tunnel, métro, cave)',
      es: 'Estoy bajo tierra (túnel, metro, sótano)',
      it: 'Sono sottoterra (tunnel, metropolitana, cantina)'
    },
    mountain_sea: {
      de: 'Ich bin im Gebirge / auf See',
      en: 'I am in the mountains / at sea',
      fr: 'Je suis en montagne / en mer',
      es: 'Estoy en la montaña / en el mar',
      it: 'Sono in montagna / in mare'
    },
    public_space: {
      de: 'Ich bin im öffentlichen Raum (Bahnhof, Flughafen, Einkaufszentrum, Veranstaltung)',
      en: 'I am in a public place (station, airport, mall, event)',
      fr: 'Je suis dans un lieu public (gare, aéroport, centre commercial, événement)',
      es: 'Estoy en un espacio público (estación, aeropuerto, centro comercial, evento)',
      it: 'Sono in un luogo pubblico (stazione, aeroporto, centro commerciale, evento)'
    }
  };

       // Bestimme, für welche Gefahren keine Kontextauswahl nötig ist. Bei
       // Strom- und Infrastrukturausfällen oder Pandemien ist der
       // Aufenthaltsort meist irrelevant, daher wird die Kontextauswahl
       // übersprungen und der Chat direkt geöffnet. Auch bei einer
       // psychischen Krise kann der Kontext entfallen.
  // Gefahren, für die keine Aufenthaltsort‑Auswahl erforderlich ist.  Wenn
  // eine dieser Kategorien gewählt wird, wird der Chat sofort geöffnet.
  // Neben Strom-/Infrastruktur, Pandemie und psychischer Krise fügen wir
  // hier auch Kategorien hinzu, für die noch kein vollwertiger
  // Entscheidungsbaum existiert.  Dadurch wird verhindert, dass die
  // Anwendung versucht, einen nicht vorhandenen Baum zu rendern.
  const hazardsNoContext = [
    'strom_infrastruktur',
    'pandemie',
    'psychische_krise',
    'wassergefahren',
    'brand_feuer',
    'gefahrstoffe_umwelt',
    'krisen_konflikte',
    'unfall',
    'medizinischer_notfall',
    'naturkatastrophen',
    'unklare_gefahr'
    , 'hitze_uv_duerre'
    // Neue Slugs, die keinen Aufenthaltsort benötigen
    , 'stabile_seitenlage'
    , 'blutung_stark'
    , 'unfall_sofortmassnahmen'
    , 'notruf'
    , 'lawine'
  ];

  // Suchbegriff für die Filterung der Gefahrenliste
  const [searchQuery, setSearchQuery] = useState('');
  // Liste der Favoriten (Slugs), wird aus localStorage geladen und dorthin gespeichert
  const [favorites, setFavorites] = useState(() => {
    try {
      const stored = localStorage.getItem('hazardFavorites');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Lokale Warnmeldung für den aktuellen Standort. Wird aus dem Wetter‑API
  // ermittelt und als Hinweis im Header angezeigt. Wenn null, wird nichts
  // angezeigt.
  const [localWarning, setLocalWarning] = useState(null);

  // Möglicherweise automatisch erkannter Aufenthaltsort ("indoor", "outdoor",
  // "car"). Dazu eine Suggestion‑Flag, um dem Nutzer eine Übernahme
  // vorzuschlagen.
  const [detectedLocation, setDetectedLocation] = useState(null);
  const [showLocationSuggest, setShowLocationSuggest] = useState(false);

  // Profil-Persona: Standard-Personentyp, der einmalig gespeichert wird (z. B.
  // "adult", "senior", "child", "handicap"). Wenn gesetzt, wird die zweite
  // Kontextauswahl automatisch gefüllt.
  const [profilePersona, setProfilePersona] = useState(() => {
    try {
      const stored = localStorage.getItem('profilePersona');
      return stored || '';
    } catch {
      return '';
    }
  });

  // Text‑to‑Speech‑Einstellung: wird aus localStorage gelesen und gespeichert.
  const [ttsEnabled, setTtsEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem('ttsEnabled');
      return stored ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });

  // Adaptive UI: wende CSS-Klassen basierend auf dem gewählten Profil an
  useEffect(() => {
    const modeMap = {
      senior: 'senior-mode',
      child: 'child-mode',
      handicap: 'handicap-mode',
    };
    const body = typeof document !== 'undefined' ? document.body : null;
    if (!body) return;
    // Entferne alte Klassen
    ['senior-mode', 'child-mode', 'handicap-mode'].forEach((cls) => body.classList.remove(cls));
    const cls = modeMap[profilePersona] || '';
    if (cls) {
      body.classList.add(cls);
    }
  }, [profilePersona]);

  // Flag für den KI‑gestützten Notfall‑Navigator. Wenn true, wird ein
  // Frage‑Dialog angezeigt, der anhand einfacher Antworten eine
  // Gefahrenlage identifiziert. Nach Abschluss wird onComplete
  // aufgerufen und der Navigator geschlossen.
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  // Einstellungen-Dialog ein-/ausblenden
  const [settingsOpen, setSettingsOpen] = useState(false);

  // -------------------------
  // State for the POI map overlay
  // -------------------------
  // If true, the map overlay with nearby points of interest is displayed.
  const [mapOpen, setMapOpen] = useState(false);
  // A list of point-of-interest types to filter on the map. These are
  // chosen based on the detected hazard and passed down to the
  // OfflineMap component. For example, 'police', 'hospital', etc.
  const [mapFilterTypes, setMapFilterTypes] = useState([]);

  // Mapping from hazard slugs to relevant POI categories. When a hazard
  // is identified (either directly from the QuickNavigator or via the
  // GPT classification fallback), the associated types are read from
  // this mapping and used to filter the map results. Feel free to
  // adjust or extend this mapping as more categories are added.
  const HAZARD_TO_POI = {
    // Krisen & Konflikte: nächstgelegene Polizei oder Schutzraum kann sinnvoll sein
    krisen_konflikte: ['police', 'shelter'],
    // Feuer & Explosion: keine Route, da Evakuierung im Vordergrund steht
    brand_feuer: [],
    // Medizinischer Notfall: Krankenhaus oder Apotheke
    medizinischer_notfall: ['hospital', 'pharmacy'],
    // Strom- & Infrastrukturausfall: keine Route nötig
    strom_infrastruktur: [],
    // Wassergefahren (Hochwasser, Sturm): meist nur Evakuierung nach oben – keine Route
    wassergefahren: [],
    // Gefährliche Stoffe & Umwelt: Abstand halten, keine Route
    gefahrstoffe_umwelt: [],
    // Naturkatastrophen (z. B. Erdbeben, Lawine): keine Route
    naturkatastrophen: [],
    // Unfall & Technikversagen: nächstgelegene Klinik oder Polizei
    unfall: ['hospital', 'police'],
    // Pandemie/Gesundheit: keine Route
    pandemie: [],
    // Psychische Krise: keine Route
    psychische_krise: [],
    // Unklare Gefahr: Polizei oder Schutzraum
    unklare_gefahr: ['police', 'shelter'],
    // Hitze, UV & Dürre: keine Route erforderlich
    hitze_uv_duerre: []
    ,
    // Neue Gefahrenkategorien: Zuordnung zu naheliegenden Einrichtungen
    blutung_stark: ['hospital', 'police'],
    stabile_seitenlage: ['hospital'],
    unfall_sofortmassnahmen: ['hospital', 'police'],
    notruf: [],
    lawine: []
  };

  // Überwachung von Beschleunigungsdaten, um aus Sensordaten (DeviceMotion)
  // abzuleiten, ob der Nutzer sich eher im Auto, draußen oder drinnen
  // befindet. Dies ergänzt die Geolokationserkennung und ermöglicht eine
  // intelligentere Kontext‑Erkennung. Wir speichern die abgeleitete
  // Kategorie in deviceLocation. Dieser Wert wird bei der Auswahl
  // einer Gefahr als Vorschlag verwendet.
  const [deviceLocation, setDeviceLocation] = useState(null);
  useEffect(() => {
    function handleMotion(event) {
      const ax = event.accelerationIncludingGravity?.x || 0;
      const ay = event.accelerationIncludingGravity?.y || 0;
      const az = event.accelerationIncludingGravity?.z || 0;
      const magnitude = Math.sqrt(ax * ax + ay * ay + az * az);
      let loc;
      // Grobe Schwellenwerte: starke Beschleunigungen deuten auf Auto,
      // mittlere auf Gehen/Laufen draußen, geringe auf indoor. Die
      // Schwellen wurden empirisch gewählt und können bei Bedarf
      // angepasst werden.
      if (magnitude > 15) {
        loc = 'car';
      } else if (magnitude > 3) {
        loc = 'outside';
      } else {
        loc = 'home';
      }
      setDeviceLocation(loc);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('devicemotion', handleMotion);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('devicemotion', handleMotion);
      }
    };
  }, []);

  // Wiederhole den Abruf der Warn-API alle 5 Minuten, um aktuelle
  // Gefahrenmeldungen zu erhalten. Wenn Meldungen vorliegen, wird
  // eine generische Warnung gesetzt. Fehler werden ignoriert.
  useEffect(() => {
    const intervalId = setInterval(() => {
      const baseUrl = process.env.REACT_APP_BACKEND_URL || '';
      fetch(`${baseUrl}/api/warnings`)
        .then((res) => res.json())
        .then((data) => {
          let count = 0;
          if (Array.isArray(data)) {
            count = data.length;
          } else if (data && Array.isArray(data.warnings)) {
            count = data.warnings.length;
          } else if (data && Array.isArray(data.features)) {
            count = data.features.length;
          }
          if (count > 0) {
            setLocalWarning('⚠️ Offizielle Warnmeldung: Es liegen aktuelle Gefahrenmeldungen vor. Bitte informiere dich bei den offiziellen Warn‑Apps.');
          }
        })
        .catch(() => {
          // Fehler bei der Warn-API ignorieren
        });
    }, 300000); // alle 5 Minuten (300.000 ms)
    return () => clearInterval(intervalId);
  }, []);

  // Favorit hinzufügen oder entfernen
  const toggleFavorite = (slug) => {
    setFavorites((prev) => {
      let next;
      if (prev.includes(slug)) {
        next = prev.filter((s) => s !== slug);
      } else {
        next = [...prev, slug];
      }
      try {
        localStorage.setItem('hazardFavorites', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // separate States für die zweistufige Kontextauswahl
  const [locationCtx, setLocationCtx] = useState(null);
  const [personaCtx, setPersonaCtx] = useState(null);
  // Zeigt den Life-Saver-Modus an (Schritt-für-Schritt-Overlay)
  const [lifeSaverOpen, setLifeSaverOpen] = useState(false);
  // Lernkarten‑Overlay: Steuerung der Anzeige und Auswahl des aktuellen Slugs
  const [learningOpen, setLearningOpen] = useState(false);
  const [learningSlug, setLearningSlug] = useState(null);

  // Merkt sich die Antworten aus dem QuickNavigator, um sie später
  // dem Chat‑Assistenten oder anderen Komponenten zur Verfügung
  // stellen zu können.  Diese Antworten enthalten alle Ja/Nein‑Angaben
  // des Nutzers während der Navigator‑Befragung.
  const [navigatorAnswers, setNavigatorAnswers] = useState(null);

  // Flag, ob das modale Overlay zur Aufenthaltsort‑Auswahl angezeigt
  // werden soll. Wenn true, werden weder Zusammenfassung noch
  // Entscheidungsbaum angezeigt, bis der Nutzer einen Aufenthaltsort
  // gewählt hat.
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  /**
   * Behandler für den Notfall‑Navigator.  Er wird aufgerufen, wenn der
   * Nutzer alle Fragen beantwortet hat.  Der Parameter slug enthält
   * entweder eine erkannte Gefahrenlage (z. B. 'brand_feuer') oder
   * null, wenn keine passende Zuordnung möglich war.  In diesem
   * Fall wird kein Entscheidungsbaum geladen, sondern der Nutzer
   * bleibt in der Detailansicht und kann bei Bedarf den Notruf
   * wählen.  Nach Abschluss wird der Navigator geschlossen.
   */
  /**
   * Wird aufgerufen, nachdem der Notfall‑Navigator alle Fragen gestellt hat.
   * result enthält ein optionales slug (erkannt durch Heuristik) und
   * die Antworten.  Wenn kein slug gefunden wurde und wir online sind,
   * versuchen wir, die Situation über GPT zu klassifizieren.  Ansonsten
   * laden wir den passenden Entscheidungsbaum oder zeigen einen
   * allgemeinen Hinweis an.
   */
  const handleNavigatorComplete = async (result) => {
    // Navigator schließen und Antworten speichern
    setNavigatorOpen(false);
    const { slug: detectedSlug, answers } = result || {};
    setNavigatorAnswers(answers);

    // Falls eine Gefahr eindeutig identifiziert wurde, lade den Entscheidungsbaum
    // und speichere die relevanten POI‑Typen, aber öffne die Karte nicht automatisch.
    // Die Karte wird erst auf Wunsch des Nutzers eingeblendet, damit sofort
    // Anleitungen sichtbar sind.
    if (detectedSlug) {
      const filterTypes = HAZARD_TO_POI[detectedSlug] || [];
      setMapFilterTypes(filterTypes);
      // Kartenoverlay zunächst geschlossen lassen. Der Nutzer kann es später über
      // einen Button öffnen. Dadurch werden die Schritt‑für‑Schritt‑Anweisungen
      // und der Chat nicht von der Karte verdeckt.
      setMapOpen(false);
      // Lade den Entscheidungsbaum für die erkannte Gefahr
      loadTree(detectedSlug);
      // Setze den Kontext auf "allgemein" und öffne den Chat sofort, damit
      // erste Anweisungen angezeigt werden. Location- und Persona-Context
      // werden vorerst zurückgesetzt; der Nutzer kann sie später ändern.
      setLocationCtx(null);
      setPersonaCtx(null);
      setContext('allgemein');
      setChatOpen(true);
      return;
    }

    // Wenn keine konkrete Gefahr erkannt wurde, aber wir online sind, lass GPT
    // eine Klassifizierung vornehmen und nimm ebenfalls die passenden POI-Typen.
    if (online) {
      try {
        const baseUrl = process.env.REACT_APP_BACKEND_URL || '';
        // Baue eine Beschreibung der Situation aus den Navigatorantworten.
        const descParts = [];
        const translate = (key, val) => {
          const yesNo = val === true ? 'ja' : 'nein';
          switch (key) {
            case 'smoke':
              return `Rauch/Feuer: ${yesNo}`;
            case 'power':
              return `Stromausfall: ${val === false ? 'ja' : 'nein'}`;
            case 'panic':
              return `Schüsse/Panik: ${yesNo}`;
            case 'injury':
              return `Verletzte: ${yesNo}`;
            case 'psych':
              return `psychische Krise: ${yesNo}`;
            case 'water':
              return `Wasser/Sturm: ${yesNo}`;
            case 'hazmat':
              return `Chemikalien/Giftstoffe: ${yesNo}`;
            case 'heat':
              return `Hitze/UV: ${yesNo}`;
            case 'smell':
              return `Gas/Chemie-Geruch: ${yesNo}`;
            case 'accident':
              return `Unfall/Defekt: ${yesNo}`;
            case 'pandemic':
              return `Pandemie/Krankheit: ${yesNo}`;
            case 'inside':
              return `Gebäude: ${yesNo}`;
            case 'multiple':
              return `Mehrere Personen betroffen: ${yesNo}`;
            case 'vehicle':
              return `Fahrzeug/unterirdisch: ${yesNo}`;
            default:
              return '';
          }
        };
        if (answers) {
          Object.entries(answers).forEach(([k, v]) => {
            const text = translate(k, v);
            if (text) descParts.push(text);
          });
        }
        const userMessage =
          descParts.length > 0
            ? `Ich befinde mich in einer unklaren Situation. ${descParts.join(', ')}. Um welche Gefahrenlage könnte es sich handeln? Bitte nenne die passendste Kategorie (z. B. Feuer, Stromausfall, Massenpanik, Hochwasser …).`
            : 'Ich weiß nicht, was los ist. Welche Gefahr könnte das sein?';
        const systemPrompt =
          'Du bist ein deutscher Notfall-Helfer. Ordne anhand der folgenden Beobachtungen die Situation einer der Gefahrenkategorien zu und nenne zusätzlich eine kurze erste Maßnahme auf Deutsch. Kategorien sind: Feuer & Explosion, Wassergefahren, Gefährliche Stoffe & Umwelt, Krisen & Konflikte, Unfall & Technikversagen, Strom- & Infrastrukturausfall, Gesundheitliche Bedrohung (Pandemie), Psychische Krise, Medizinischer Notfall, Naturkatastrophen, Unklare Gefahr. Beispiel: Beobachtungen: Rauch/Feuer: ja, Stromausfall: nein. Antwort: brand_feuer – verlasse sofort das Gebäude und rufe die Feuerwehr.';
        const response = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage }
            ],
            slug: 'navigator',
            context: 'navigator'
          })
        });
        const data = await response.json();
        const content = data.content || data.answer || '';
        let matchedSlug = null;
        Object.keys(hazardMeta).forEach((s) => {
          if (matchedSlug) return;
          const meta = hazardMeta && hazardMeta[s];
          const names = [];
          if (meta && meta.name) {
            Object.values(meta.name).forEach((n) => names.push(String(n).toLowerCase()));
          }
          const synonyms = [];
          if (meta && meta.synonyms) {
            Object.values(meta.synonyms).forEach((arr) =>
              arr.forEach((syn) => synonyms.push(String(syn).toLowerCase()))
            );
          }
          const patterns = [s.replace(/_/g, ' ').toLowerCase(), ...names, ...synonyms];
          const lowered = content.toLowerCase();
          if (patterns.some((p) => lowered.includes(p))) {
            matchedSlug = s;
          }
        });
        if (matchedSlug) {
          // Filter die Karte basierend auf der erkannten Gefahr
          const types = HAZARD_TO_POI[matchedSlug] || [];
          setMapFilterTypes(types);
          // Die Karte wird erst durch den Nutzer geöffnet, damit der Chat
          // unmittelbar sichtbar bleibt.
          setMapOpen(false);
          // Lade den Entscheidungsbaum für die ermittelte Gefahr
          loadTree(matchedSlug);
          // Setze Kontext auf allgemeines Profil und öffne den Chat sofort
          setLocationCtx(null);
          setPersonaCtx(null);
          setContext('allgemein');
          setChatOpen(true);
          return;
        }
      } catch (err) {
        console.error('Navigator GPT classification failed:', err);
      }
    }
    // Kein Ergebnis: zeige allgemeinen Hinweis
    setTree(null);
    setSummary(null);
    setCurrentSlug(null);
    setShowOverview(false);
    setContext(null);
    setChatOpen(false);
  };

  // Wenn sowohl Aufenthaltsort als auch Personentyp gewählt wurden, kombiniere
  // sie zu einem Kontextstring und öffne den Chat
  useEffect(() => {
    if (locationCtx && personaCtx) {
      const combined = `${locationCtx}-${personaCtx}`;
      setContext(combined);
      setChatOpen(true);
    }
  }, [locationCtx, personaCtx]);

  // Passe die Risiko-Stufe an, sobald ein neuer Slug ausgewählt wird.
  useEffect(() => {
    if (currentSlug) {
      setRisk(riskLevels[currentSlug] || 'medium');
    } else {
      setRisk('medium');
    }
  }, [currentSlug]);


  // Vorschlagsfragen für den Chat‑Assistenten je Gefahrenlage.  Die
  // Vorschläge fokussieren stets auf die Sicherheit von Menschen und
  // lebensrettende Maßnahmen, nicht auf Sachwerte.  Wenn keine
  // spezifischen Fragen definiert sind, wird eine generische Liste
  // verwendet.
  const suggestionsMap = {
    strom_infrastruktur: [
      'Wie verhalte ich mich bei einem Strom- oder Netzausfall, um mich und andere zu schützen?',
      'Wie kann ich Hilfe holen, wenn der Notruf nicht funktioniert?',
      'Wie kann ich Menschen unterstützen, die auf Technik angewiesen sind?'
    ],
    brand_feuer: [
      'Wie verlasse ich das Gebäude sicher?',
      'Wie helfe ich anderen, ohne mich zu gefährden?',
      'Soll ich die Feuerwehr rufen?'
    ],
    naturkatastrophen: [
      'Wie verhalte ich mich bei Erdbeben oder Lawinen?',
      'Wo finde ich Schutz?',
      'Wie organisiere ich Hilfe für andere?'
    ],
    gefahrstoffe_umwelt: [
      'Wie vermeide ich Kontakt mit Chemikalien oder giftigen Stoffen?',
      'Wie bringe ich mich und andere in Sicherheit?',
      'Wen muss ich informieren?'
    ],
    wassergefahren: [
      'Wie schütze ich mich vor Hochwasser oder Unwettern?',
      'Wie bringe ich mich und andere in Sicherheit?',
      'Wann ist es sicher, zurückzukehren?'
    ],
    krisen_konflikte: [
      'Wie finde ich den nächsten sicheren Ort?',
      'Wie verhalte ich mich während einer Evakuierung oder bei Terrorgefahr?',
      'Wie kann ich anderen helfen?'
    ],
    pandemie: [
      'Wie schütze ich mich und andere vor Ansteckung?',
      'Wie erkenne ich Symptome?',
      'Wie verhalte ich mich in der Öffentlichkeit?'
    ],
    unfall: [
      'Wie leiste ich Erste Hilfe?',
      'Wie sichere ich die Unfallstelle?',
      'Wie rufe ich Hilfe?'
    ],
    unklare_gefahr: [
      'Ich weiß nicht, was los ist – was soll ich tun?',
      'Welche ersten Schritte kann ich unternehmen?',
      'Wie finde ich heraus, was passiert?'
    ],
    medizinischer_notfall: [
      'Wie leiste ich Erste Hilfe bei einem medizinischen Notfall?',
      'Wann sollte ich den Notruf 112 rufen?',
      'Wie unterstütze ich eine bewusstlose Person?'
    ],
    psychische_krise: [
      'Wie kann ich mich beruhigen bei einer Panikattacke?',
      'Wie kann ich jemandem mit extremer Angst helfen?',
      'Wann sollte ich professionelle Hilfe kontaktieren?'
    ]
  };
  // Allgemeine Rückfragen, die an einen Notruf erinnern: Situation,
  // Verletzte, Gefahren.  Diese werden stets vor den
  // Gefahren‑spezifischen Vorschlägen angezeigt.
  // Allgemeine Hinweise, die vor den gefahrenspezifischen Tipps angezeigt werden. Da die 4‑W‑Fragen
  // bereits im Schnell‑Navigator gestellt werden, fokussieren sich diese Hinweise auf das Handeln
  // und die Informationsbeschaffung.
  const clarificationQuestions = [
    'Wie bringe ich mich und andere in Sicherheit?',
    'Welche ersten Schritte kann ich unternehmen?',
    'Wie finde ich heraus, was passiert?'
  ];
  const defaultSuggestions = [
    'Wie bringe ich mich und andere in Sicherheit?',
    'Wen soll ich informieren?',
    'Wie kann ich helfen?'
  ];
  const getSuggestions = (slug) => {
    const hazardSuggestions = suggestionsMap[slug] || defaultSuggestions;
    // Kombiniere die allgemeinen Klärungsfragen mit den
    // gefahrenspezifischen Vorschlägen.  Entferne dabei Duplikate und
    // führende/anhängende Leerzeichen.  Um die kognitive Last zu reduzieren,
    // begrenzen wir die Liste auf maximal fünf Elemente.
    const combined = [...clarificationQuestions, ...hazardSuggestions];
    const seen = new Set();
    const deduped = [];
    for (const q of combined) {
      const trimmed = (q || '').trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        deduped.push(trimmed);
      }
    }
    // Begrenze auf maximal 5 Vorschläge
    return deduped.slice(0, 5);
  };

  // Zeigt an, ob die Übersicht mit allen Gefahren angezeigt werden soll oder
  // ob der Nutzer bereits eine Gefahr ausgewählt hat. Sobald eine Gefahr
  // ausgewählt wird, wechseln wir in die Detailansicht und blenden die
  // Gefahrenliste aus.
  const [showOverview, setShowOverview] = useState(true);

  // Sobald eine Kurzbeschreibung (Summary) geladen wurde, lies sie laut vor.
  // Dies hilft insbesondere Kindern, Senioren und Personen mit Handicap,
  // die Anweisungen schneller zu erfassen. Die Sprachsynthese ist nur
  // aktiv, wenn der Browser sie unterstützt. Wird eine neue Summary
  // geladen, wird die vorherige Sprachausgabe gestoppt und die neue
  // Nachricht vorgelesen.
  useEffect(() => {
    // Lies die Kurzbeschreibung nur dann laut vor, wenn die Sprachausgabe aktiviert ist
    if (ttsEnabled && summary && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(summary);
      utterance.lang = lang === 'de' ? 'de-DE' : 'en-US';
      // Bestehende Sprachausgaben abbrechen, um Überlappungen zu vermeiden
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }, [summary, lang, ttsEnabled]);

  // Sobald die App online ist und die Übersicht noch angezeigt wird, öffnen wir
  // automatisch den QuickNavigator.  Dadurch wird die Listenansicht übersprungen
  // und der Nutzer landet direkt im Frage‑Dialog.  Wir prüfen, dass der
  // Navigator noch nicht offen ist, um eine Endlosschleife zu vermeiden.
  useEffect(() => {
    if (online && showOverview && !navigatorOpen) {
      setNavigatorOpen(true);
      setShowOverview(false);
    }
  }, [online, showOverview, navigatorOpen]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const baseUrl = process.env.REACT_APP_BACKEND_URL || '';
    fetch(`${baseUrl}/api/hazards`)
      .then(res => {
        if (!res.ok) throw new Error('Fehler beim Laden der Gefahrenliste');
        return res.json();
      })
      .then(data => {
        // Defensive: Akzeptiere nur Array von Strings
        let hazardsArr = [];
        if (Array.isArray(data?.hazards)) {
          hazardsArr = data.hazards;
        }
        setHazards(hazardsArr);
        // Lade die Metadaten der Gefahren parallel
        return fetch(`${baseUrl}/api/hazards_meta`)
          .then((res) => {
            if (!res.ok) throw new Error('Fehler beim Laden der Gefahren-Metadaten');
            return res.json();
          })
          .then((meta) => {
            setHazardMeta(meta || {});
            setLoading(false);
          })
          .catch((err) => {
            console.error(err);
            // Auch wenn Metadaten fehlen, soll die App weiter funktionieren
            setHazardMeta({});
            setLoading(false);
          });
      })
      .catch(err => {
        console.error(err);
        setError('Die Gefahrenliste konnte nicht geladen werden. Bitte versuchen Sie es später erneut.');
        setLoading(false);
      });
  }, []);

  // Beim ersten Laden der App versuchen, den Standort zu ermitteln und eine
  // einfache Warnmeldung über Open‑Meteo abzurufen. Die Warnung wird nur
  // einmal ermittelt und bleibt bestehen, solange die Seite geöffnet ist.
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        // Rufe die aktuellen Wetterbedingungen von Open‑Meteo ab
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=weathercode,wind_speed_10m`;
        fetch(url)
          .then((res) => res.json())
          .then((data) => {
            const weatherCode = data.current?.weathercode;
            const wind = data.current?.wind_speed_10m || 0;
            let warn = null;
            // Einfache Heuristik für Warnungen: Gewitter (>= 95) oder
            // starker Wind (> 40 km/h)
            if (typeof weatherCode === 'number') {
              if (weatherCode >= 95) {
                warn = '⚠️ Unwetterwarnung: Gewitter in deiner Region';
              } else if (weatherCode >= 80) {
                warn = '⚠️ Warnung: Starkregen oder Schneeschauer in deiner Region';
              }
            }
            if (wind > 40) {
              warn = '⚠️ Warnung: Sturm mit starken Windböen in deiner Region';
            }
            if (warn) setLocalWarning(warn);
          })
          .catch(() => {});
      },
      () => {
        /* Standort nicht verfügbar */
      },
      { timeout: 5000 }
    );
    // Zusätzlich versuchen wir, offizielle Warnmeldungen (z. B. über NINA/Katwarn) aus dem
    // bundesweiten Warnsystem zu laden. Diese API liefert Meldungen für
    // verschiedene Warnkanäle. Die Struktur der Daten ist nicht garantiert,
    // daher beschränken wir uns darauf zu prüfen, ob überhaupt Meldungen
    // vorliegen und zeigen dann einen allgemeinen Hinweis an. Wenn die
    // Anfrage scheitert oder keine Meldungen gefunden werden, bleibt der
    // lokale Wetterhinweis unverändert. Diese API benötigt keine
    // Authentifizierung. Weitere Filterung nach geografischer Nähe ist
    // möglich, wenn die Daten Strukturinformationen enthalten.
    // Rufe externe Warnmeldungen über unseren Backend‑Proxy ab. Dadurch
    // umgehen wir CORS‑Beschränkungen. Die Antwort kann je nach Quelle ein
    // Array oder Objekt mit Feldern wie "warnings" oder "features" sein.
    const baseUrl = process.env.REACT_APP_BACKEND_URL || '';
    fetch(`${baseUrl}/api/warnings`)
      .then((res) => res.json())
      .then((data) => {
        let count = 0;
        if (Array.isArray(data)) {
          count = data.length;
        } else if (data && Array.isArray(data.warnings)) {
          count = data.warnings.length;
        } else if (data && Array.isArray(data.features)) {
          count = data.features.length;
        }
        if (count > 0) {
          setLocalWarning('⚠️ Offizielle Warnmeldung: Es liegen aktuelle Gefahrenmeldungen vor. Bitte informiere dich bei den offiziellen Warn‑Apps.');
        }
      })
      .catch(() => {
        /* Ignoriere Fehler bei Abruf der Warn‑API */
      });
  }, []);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

      const loadTree = (slug) => {
        // Immer Details vom Backend abrufen, egal ob online oder offline –
        // sofern offline sind, könnte man einen lokalen Cache verwenden.
        setLoading(true);
        setError(null);
        setTree(null);
        setSummary(null);
        const modeParam = simpleText ? 'simple' : 'full';
        const baseUrl = process.env.REACT_APP_BACKEND_URL || '';
        const url = `${baseUrl}/api/hazards/${slug}?lang=${lang}${modeParam && modeParam !== 'full' ? `&mode=${modeParam}` : ''}`;
        fetch(url)
          .then(res => {
            if (!res.ok) throw new Error('Fehler beim Abrufen der Detailinformationen');
            return res.json();
          })
          .then(data => {
            // data.tree enthält den Entscheidungsbaum, data.summary eine Kurzbeschreibung
            if (data.tree) setTree(data.tree);
            if (data.summary) setSummary(data.summary);
            setCurrentSlug(slug);

            // Telemetrie: protokolliere das Laden eines Entscheidungsbaums. Dies hilft uns,
            // zu verstehen, welche Gefahren häufig ausgewählt werden. Die Daten werden
            // lokal gespeichert und können später anonymisiert ausgewertet werden.
            logEvent('load_tree', { slug });
            // Chat erst öffnen, wenn der Kontext ausgewählt wurde
            setChatOpen(false);
            setLoading(false);

                // Wenn für diese Gefahr keine Kontextauswahl nötig ist,
                // setze einen allgemeinen Kontext und öffne den Chat sofort
                // Prüfe anhand der Metadaten, ob Kontext benötigt wird.  Wenn
                // keine Aufenthaltsorte definiert sind, behandeln wir die
                // Gefahr als kontextfrei.  Andernfalls wird die
                // Aufenthaltsortauswahl gestartet.
                const meta = (hazardMeta && hazardMeta[slug]) || {};
                const needsContext = !hazardsNoContext.includes(slug) && Array.isArray(meta.locations) && meta.locations.length > 0;
                if (!needsContext || online) {
                  // Im Online‑Modus oder bei Gefahren ohne Kontextauswahl: direkt den Chat öffnen.
                  setLocationCtx(null);
                  setPersonaCtx(null);
                  setContext('allgemein');
                  setChatOpen(true);
                } else {
                  // Für Gefahren mit Kontextauswahl im Offline‑Modus: öffne das modale Overlay
                  setLocationCtx(null);
                  setPersonaCtx(null);
                  setLocationModalOpen(true);
                  // Wenn eine Profil-Persona gespeichert ist, setze sie als personaCtx,
                  // damit der Nutzer diesen Schritt nicht erneut auswählen muss
                  if (profilePersona) {
                    setPersonaCtx(profilePersona);
                  }
                  // Versuche anhand der Sensoren einen Aufenthaltsort vorzuschlagen
                  const suggestViaGps = () => {
                    if (!('geolocation' in navigator)) {
                      if (deviceLocation) {
                        setDetectedLocation(deviceLocation);
                        setShowLocationSuggest(true);
                      }
                      return;
                    }
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        const speed = position.coords.speed;
                        let loc = null;
                        if (speed != null && !Number.isNaN(speed)) {
                          if (speed > 3) {
                            loc = 'car';
                          } else if (speed > 0.5) {
                            loc = 'outside';
                          } else {
                            loc = 'home';
                          }
                        }
                        if (loc) {
                          setDetectedLocation(loc);
                          setShowLocationSuggest(true);
                        } else if (deviceLocation) {
                          setDetectedLocation(deviceLocation);
                          setShowLocationSuggest(true);
                        }
                      },
                      () => {
                        if (deviceLocation) {
                          setDetectedLocation(deviceLocation);
                          setShowLocationSuggest(true);
                        }
                      },
                      { timeout: 5000 }
                    );
                  };
                  // Starte die Ortung nur, wenn Meta vorliegt (damit locationModalOpen true gesetzt wird)
                  suggestViaGps();
                }
          })
          .catch(err => {
            console.error(err);
            setError('Die Detailinformationen konnten nicht geladen werden. Bitte versuchen Sie es später erneut.');
            setLoading(false);
          });

        // In die Detailansicht wechseln und Kontext zurücksetzen
        setShowOverview(false);
        setContext(null);
        setLocationCtx(null);
        setPersonaCtx(null);
      };

      const backToOverview = () => {
        setTree(null);
        setSummary(null);
        setChatOpen(false);
    setContext(null);
    setShowOverview(true);
    setLocationCtx(null);
    setPersonaCtx(null);
      };
  // --- Nur Rubriken für die aktuelle Sprache, nur EINMAL pro Slug ---
  const currentLang = lang || 'de';

  // Extrahiere alle Slugs für die aktuelle Sprache

  // Mache Slugs eindeutig
  const uniqueSlugs = [...new Set(hazards)];
  // --- Render-Funktion ---
  return (
    <div className="App">
      {/* Hinweis bei fehlender Internetverbindung */}
      {!online && (
        <div
          style={{
            backgroundColor: '#fffbeb',
            color: '#92400e',
            border: '1px solid #fcd34d',
            padding: '0.5rem',
            borderRadius: '6px',
            marginBottom: '1rem'
          }}
        >
          Du bist offline. Einige Funktionen, z. B. der Chat‑Assistent, stehen im
          Offline‑Modus nicht zur Verfügung. Sobald du wieder online bist,
          lade die Seite neu, um aktuelle Informationen zu erhalten.
        </div>
      )}

      {/* Permanente Notruf-Schaltfläche: ruft die europaweite Notrufnummer 112 an */}
      <div
        style={{
          position: 'fixed',
          bottom: '1rem',
          right: '1rem',
          zIndex: 1000
        }}
      >
        <a
          href="tel:112"
          style={{
            display: 'inline-block',
            padding: '0.75rem 1rem',
            backgroundColor: '#b91c1c',
            color: '#fff',
            borderRadius: '50%',
            textAlign: 'center',
            textDecoration: 'none',
            fontSize: '1.5rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}
          title="Notruf 112"
        >
          📞
        </a>
      </div>
      {/* Den Kopfbereich mit Titel und Spracheinstellungen nur in der Übersicht anzeigen */}
      {showOverview && (
        <>
          <header>
            <h1>🆘 Notfallhilfe</h1>
            <p>Schnelle Hilfe in jeder Lage. Für alle. Mehrsprachig.</p>
          </header>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            {/* Sprachauswahl */}
            <select value={lang} onChange={e => setLang(e.target.value)}>
              <option value="de">🇩🇪 DE</option>
              <option value="fr">🇫🇷 FR</option>
              <option value="en">🇬🇧 EN</option>
              <option value="es">🇪🇸 ES</option>
              <option value="it">🇮🇹 IT</option>
            </select>
            <button style={{ marginLeft: '1rem' }}>📍 Standort verwenden</button>
            {/* Einstellungen öffnen */}
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Einstellungen"
              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
            >
              ⚙️
            </button>
          </div>
      {/* Zusätzliche Utility-Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          onClick={() => setInfoOpen(true)}
          style={{ padding: '0.5rem 0.75rem', background: '#6b7280', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Notfall‑Info
        </button>
        {currentSlug && tipsForHazard.length > 0 && (
          <button
            onClick={() => setTipsOpen(true)}
            style={{ padding: '0.5rem 0.75rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Tipps
          </button>
        )}
        <button
          onClick={() => setFeedbackOpen(true)}
          style={{ padding: '0.5rem 0.75rem', background: '#65a30d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Feedback
        </button>
      </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>
              <input
                type="checkbox"
                checked={simpleText}
                onChange={e => setSimpleText(e.target.checked)}
              />
              Leicht verständlich
            </label>
          </div>
          {/* Lokale Warnmeldung anzeigen, falls vorhanden */}
          {localWarning && (
            <div
              style={{
                backgroundColor: '#fff7ed',
                color: '#b45309',
                border: '1px solid #fed7aa',
                padding: '0.5rem',
                borderRadius: '6px',
                marginBottom: '1rem'
              }}
            >
              {localWarning}
            </div>
          )}
        </>
      )}
      {/* Rubriken-Buttons */}
      {showOverview && (
        <>
          {loading && <div>Lade Rubriken…</div>}
          {error && <div style={{ color: 'red' }}>{error}</div>}
          {/* Auto‑Navigator: Freitextanalyse zur schnellen Auswahl des passenden Slugs */}
          <AutoNavigator onNavigate={(slug) => loadTree(slug)} lang={lang} />
          {/* Suchfeld für schnelle Filterung */}
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Gefahr suchen…"
              style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
            />
          </div>
          <div>
            {!loading && !error && uniqueSlugs.length === 0 && <div>Keine Rubriken gefunden.</div>}
            {/* Filtere und sortiere die Slugs: Favoriten zuerst, dann alphabetisch */}
            {!loading && !error && (() => {
              const q = searchQuery.toLowerCase();
              // Erweitere die Suche: Berücksichtige Slug, übersetzten Namen
              // und Synonyme der aktuellen Sprache.  So können Nutzer
              // deutschsprachig nach "Feuer" suchen und den Brand finden
              const filtered = uniqueSlugs.filter((s) => {
                const meta = (hazardMeta && hazardMeta[s]) || {};
                const names = [];
                if (meta.name) {
                  // prüfe alle Namensvarianten, nicht nur die aktuelle Sprache
                  Object.values(meta.name).forEach((n) => names.push(String(n).toLowerCase()));
                }
                const synonyms = [];
                if (meta.synonyms) {
                  // Synonyme der aktuellen Sprache berücksichtigen
                  const syns = meta.synonyms[lang] || [];
                  syns.forEach((syn) => synonyms.push(String(syn).toLowerCase()));
                }
                const targets = [s.toLowerCase(), ...names, ...synonyms];
                return targets.some((t) => t.includes(q));
              });
              const sorted = filtered.sort((a, b) => {
                const favA = favorites.includes(a);
                const favB = favorites.includes(b);
                if (favA && !favB) return -1;
                if (!favA && favB) return 1;
                // Sortiere nach lokalisiertem Namen, falls möglich
                const nameA = hazardMeta[a]?.name?.[lang] || a;
                const nameB = hazardMeta[b]?.name?.[lang] || b;
                return nameA.localeCompare(nameB);
              });
              return (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '0.75rem'
                  }}
                >
                  {sorted.map((slug) => {
                    const meta = (hazardMeta && hazardMeta[slug]) || {};
                    const label = meta?.name?.[lang] || slug.charAt(0).toUpperCase() + slug.slice(1).replace(/_/g, ' ');
                    const desc = meta?.description?.[lang];
                    const icon = icons[slug] || '⚠️';
                    const isFav = favorites.includes(slug);
                    return (
                      <div
                        key={slug}
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '0.75rem',
                          backgroundColor: '#fff',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        minHeight: '160px'
                        }}
                      >
                        <button
                          onClick={() => loadTree(slug)}
                          className="hazard-btn"
                          aria-label={`${label} auswählen`}
                          style={{
                            flex: 1,
                            fontSize: '1.2rem',
                            textAlign: 'left',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0
                          }}
                        >
                          <span role="img" aria-hidden="true" style={{ marginRight: '0.5rem', fontSize: '1.6em' }}>{icon}</span>
                          <span style={{ fontWeight: 500 }}>{label}</span>
                          {desc && (
                            <span
                              style={{
                                fontSize: '0.85rem',
                                color: '#4b5563',
                                marginTop: '0.25rem',
                                lineHeight: '1.2',
                                // vollständige Anzeige der Kurzbeschreibung ohne Zeilenbegrenzung
                                whiteSpace: 'normal'
                              }}
                            >
                              {desc}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => toggleFavorite(slug)}
                          aria-label={isFav ? 'Von Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
                          style={{
                            alignSelf: 'flex-end',
                            background: 'none',
                            border: 'none',
                            fontSize: '1.4rem',
                            cursor: 'pointer',
                            color: isFav ? '#f59e0b' : '#9ca3af'
                          }}
                        >
                          {isFav ? '★' : '☆'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          {/* Button für den KI‑gestützten Notfall‑Navigator. Dieser
             ermöglicht es Nutzern, eine Gefahrenlage zu finden, wenn
             sie nicht wissen, was passiert.  Er wird am Ende der
             Übersicht angezeigt. */}
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <button
              onClick={() => setNavigatorOpen(true)}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#004080',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              {lang === 'de'
                ? '❓ Ich weiß nicht, was los ist'
                : lang === 'fr'
                ? '❓ Je ne sais pas ce qui se passe'
                : lang === 'es'
                ? '❓ No sé lo que pasa'
                : lang === 'it'
                ? '❓ Non so cosa sta succedendo'
                : '❓ I don’t know what’s happening'}
            </button>
          </div>
        </>
      )}
           {/* Wenn eine Zusammenfassung vorliegt, anzeigen */}
      {/* Detailansicht: nach Auswahl einer Gefahr */}
      {!showOverview && (
        <>
          {/* Navigation zurück zur Übersicht */}
          <button onClick={backToOverview} className="back-btn" style={{ marginTop: '1rem' }}>
            ← Zurück zur Übersicht
          </button>
          {/* Überschrift der aktuellen Gefahr mit passendem Symbol */}
          {currentSlug && (
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center' }}>
              <span role="img" aria-hidden="true" style={{ marginRight: '0.5rem', fontSize: '1.6em' }}>
                {icons[currentSlug] || '⚠️'}
              </span>
              <h2 style={{ margin: 0 }}>{
                ((hazardMeta && hazardMeta[currentSlug]) && (hazardMeta && hazardMeta[currentSlug]).name && (hazardMeta && hazardMeta[currentSlug]).name[lang])
                  ? (hazardMeta && hazardMeta[currentSlug]).name[lang]
                  : currentSlug.charAt(0).toUpperCase() + currentSlug.slice(1).replace(/_/g, ' ')
              }</h2>
            </div>
          )}
          {/* Notruf-Schaltfläche wird global unten rechts angezeigt, daher nicht erneut anzeigen */}
                    {/* FIRSTAID TABS START — kontextbezogene Kurz-Anleitungen pro Gefahr */}
          {currentSlug === 'herzstillstand' && (
            <FirstAidTabs
              items={[
                {
                  title:
                    lang === 'de' ? 'Wie funktioniert die Beatmung?' :
                    lang === 'fr' ? 'Comment réaliser la ventilation ?' :
                    lang === 'es' ? '¿Cómo ventilar correctamente?' :
                    lang === 'it' ? 'Come si esegue la ventilazione?' :
                    'How to perform rescue breaths?',
                  body:
`So beatmen Sie eine Person richtig:
1. Kopf überstrecken (Hand an Stirn, Kinn anheben).
2. Nase zuhalten.
3. Mund öffnen, eigenen Mund dicht umschließen.
4. 2× je 1 Sekunde langsam und kontrolliert einblasen.
5. Brustkorb muss sich sichtbar heben.
6. Danach weiter Herzdruckmassage (30:2).
Wichtig: Nur beatmen, wenn sicher; sonst nur drücken!`
                },
                {
                  title:
                    lang === 'de' ? 'Wie lange muss ich drücken?' :
                    lang === 'fr' ? 'Combien de temps masser ?' :
                    lang === 'es' ? '¿Cuánto tiempo comprimir?' :
                    lang === 'it' ? 'Per quanto tempo comprimere?' :
                    'How long to compress?',
                  body:
`Herzdruckmassage – Dauer & Rhythmus:
• Frequenz: 100–120/Minute
• Tiefe: 5–6 cm (Erwachsene)
• Verhältnis: 30:2 (falls Beatmung sicher möglich)
• Hände mittig am Brustkorb, Arme gestreckt
• Helferwechsel ~ alle 2 Minuten
Nicht unterbrechen – durchdrücken, bis Hilfe übernimmt oder normale Atmung einsetzt.`
                },
                {
                  title:
                    lang === 'de' ? 'Bewusstlos – was tun?' :
                    lang === 'fr' ? 'Inconscient – que faire ?' :
                    lang === 'es' ? 'Inconsciente – ¿qué hacer?' :
                    lang === 'it' ? 'Incosciente – cosa fare?' :
                    'Unconscious – what to do?',
                  body:
`Bewusstlosigkeit:
1. Ansprechen, vorsichtig rütteln.
2. Atmung prüfen (sehen, hören, fühlen).
   • Atmet normal → Stabile Seitenlage, überwachen.
   • Atmet nicht normal → 112, Reanimation starten.`
                }
              ]}
            />
          )}

          {currentSlug === 'schlaganfall' && (
            <FirstAidTabs
              items={[
                {
                  title:
                    lang === 'de' ? 'FAST-Schema' :
                    lang === 'fr' ? 'Échelle FAST' :
                    lang === 'es' ? 'Prueba FAST' :
                    lang === 'it' ? 'Schema FAST' :
                    'FAST check',
                  body:
`FAST kurz:
F – Gesicht schief?
A – Arm sinkt ab?
S – Sprache gestört?
T – Time: Sofort 112 rufen!`
                },
                {
                  title:
                    lang === 'de' ? 'Erste Schritte' :
                    lang === 'fr' ? 'Premières actions' :
                    lang === 'es' ? 'Primeros pasos' :
                    lang === 'it' ? 'Prime azioni' :
                    'First actions',
                  body:
`1. Person beruhigen, nicht allein lassen.
2. Uhrzeit der Symptome notieren.
3. Nichts essen oder trinken lassen.
4. 112 rufen und FAST-Befund schildern.`
                }
              ]}
            />
          )}

          {currentSlug === 'herzinfarkt' && (
            <FirstAidTabs
              items={[
                {
                  title:
                    lang === 'de' ? 'Erkennen' :
                    lang === 'fr' ? 'Reconnaître' :
                    lang === 'es' ? 'Reconocer' :
                    lang === 'it' ? 'Riconoscere' :
                    'Recognize',
                  body:
`Warnzeichen:
• Druck/Enge/Schmerz in Brust
• Ausstrahlung Arm/Kiefer/Rücken
• Luftnot, Angst, kalter Schweiß, Übelkeit`
                },
                {
                  title:
                    lang === 'de' ? 'Sofortmaßnahmen' :
                    lang === 'fr' ? 'Mesures immédiates' :
                    lang === 'es' ? 'Acciones inmediatas' :
                    lang === 'it' ? 'Azioni immediate' :
                    'Immediate actions',
                  body:
`1. 112 rufen.
2. Oberkörper hoch lagern, enge Kleidung öffnen.
3. Beruhigen, warm halten.
4. Nichts essen/trinken.
5. Bei Bewusstlosigkeit/keine Atmung → Reanimation starten.`
                }
              ]}
            />
          )}

          {currentSlug === 'krampfanfall' && (
            <FirstAidTabs
              items={[
                {
                  title:
                    lang === 'de' ? 'Während der Krise' :
                    lang === 'fr' ? 'Pendant la crise' :
                    lang === 'es' ? 'Durante la crisis' :
                    lang === 'it' ? 'Durante la crisi' :
                    'During the seizure',
                  body:
`1. Umgebung sichern (harte/spitze Gegenstände entfernen).
2. Nicht festhalten, nichts in den Mund stecken.
3. Kopf sanft schützen.`
                },
                {
                  title:
                    lang === 'de' ? 'Nach der Krise' :
                    lang === 'fr' ? 'Après la crise' :
                    lang === 'es' ? 'Después de la crisis' :
                    lang === 'it' ? 'Dopo la crisi' :
                    'After the seizure',
                  body:
`1. Stabile Seitenlage.
2. Atmung prüfen, beruhigen.
3. >5 Minuten, Serienanfälle oder Verletzung → 112 rufen.`
                }
              ]}
            />
          )}

          {currentSlug === 'atemnot' && (
            <FirstAidTabs
              items={[
                {
                  title:
                    lang === 'de' ? 'Soforthilfe' :
                    lang === 'fr' ? 'Aide immédiate' :
                    lang === 'es' ? 'Ayuda inmediata' :
                    lang === 'it' ? 'Aiuto immediato' :
                    'Immediate help',
                  body:
`1. Aufrecht hinsetzen (Kutschersitz), beruhigen.
2. Enge Kleidung öffnen, frische Luft.
3. Eigenes Spray/Inhalator anwenden (falls vorhanden).
4. Keine Besserung → 112 rufen.`
                }
              ]}
            />
          )}

          {currentSlug === 'hypoglykaemie' && (
            <FirstAidTabs
              items={[
                {
                  title:
                    lang === 'de' ? 'Unterzuckerung handeln' :
                    lang === 'fr' ? 'Gérer l’hypoglycémie' :
                    lang === 'es' ? 'Manejar hipoglucemia' :
                    lang === 'it' ? 'Gestire ipoglicemia' :
                    'Manage hypoglycemia',
                  body:
`Bewusst:
• Schnell Zucker geben (Traubenzucker, Saft, Cola)
Bewusstlos:
• Nichts einflößen
• Stabile Seitenlage, 112 rufen`
                }
              ]}
            />
          )}

          {currentSlug === 'anaphylaxie' && (
            <FirstAidTabs
              items={[
                {
                  title:
                    lang === 'de' ? 'Sofortmaßnahmen' :
                    lang === 'fr' ? 'Mesures immédiates' :
                    lang === 'es' ? 'Acciones inmediatas' :
                    lang === 'it' ? 'Azioni immediate' :
                    'Immediate actions',
                  body:
`1. 112 rufen.
2. Adrenalin-Autoinjektor anwenden (falls vorhanden).
3. Lagerung:
   • Atemnot → Oberkörper hoch
   • Kreislaufproblem → flach + Beine hoch
4. Enge Kleidung öffnen, beruhigen.`
                }
              ]}
            />
          )}

          {currentSlug === 'blutung_stark' && (
            <FirstAidTabs
              items={[
                {
                  title:
                    lang === 'de' ? 'Blutung stoppen' :
                    lang === 'fr' ? 'Arrêter le saignement' :
                    lang === 'es' ? 'Detener la hemorragia' :
                    lang === 'it' ? 'Fermare l’emorragia' :
                    'Control bleeding',
                  body:
`1. 112 rufen.
2. Direkter Druck auf die Wunde (saubere Auflage).
3. Druckverband anlegen; blutet es durch → weitere Auflage obendrauf.
4. Hochlagern (wenn möglich), beruhigen, warm halten.`
                }
              ]}
            />
          )}

          {currentSlug === 'stabile_seitenlage' && (
            <FirstAidTabs
              items={[
                {
                  title:
                    lang === 'de' ? 'Schritt für Schritt' :
                    lang === 'fr' ? 'Étapes' :
                    lang === 'es' ? 'Pasos' :
                    lang === 'it' ? 'Passaggi' :
                    'Steps',
                  body:
`1. Ansprechen, Atmung prüfen.
2. Arm auf deiner Seite im rechten Winkel anwinkeln.
3. Gegenüberliegenden Arm über die Brust legen, Hand an die Wange.
4. Gegenüberliegendes Bein am Knie anwinkeln.
5. Person vorsichtig zu dir drehen.
6. Kopf überstrecken, Mund leicht öffnen.
7. Atmung überwachen – 112 rufen, falls noch nicht.`
                }
              ]}
            />
          )}

          {currentSlug === 'unfall_sofortmassnahmen' && (
            <FirstAidTabs
              items={[
                {
                  title:
                    lang === 'de' ? 'Die ersten 4 Schritte' :
                    lang === 'fr' ? 'Les 4 premières étapes' :
                    lang === 'es' ? 'Primeros 4 pasos' :
                    lang === 'it' ? 'Prime 4 fasi' :
                    'First 4 steps',
                  body:
`1. Unfallstelle sichern (Warnblinker, Weste, Warndreieck).
2. Erste Hilfe leisten – Verletzte betreuen.
3. 112/110 rufen, Lage schildern.
4. Eigene Sicherheit beachten.`
                }
              ]}
            />
          )}

          {currentSlug === 'notruf' && (
            <FirstAidTabs
              items={[
                {
                  title:
                    lang === 'de' ? 'Die 5 W-Fragen' :
                    lang === 'fr' ? 'Les 5 W' :
                    lang === 'es' ? 'Las 5 W' :
                    lang === 'it' ? 'Le 5 W' :
                    'The 5 Ws',
                  body:
`1. Wo ist es passiert?
2. Was ist passiert?
3. Wie viele Personen?
4. Welche Verletzungen?
5. Warten auf Rückfragen, nicht auflegen.`
                },
                {
                  title:
                    lang === 'de' ? 'Vorlage' :
                    lang === 'fr' ? 'Modèle' :
                    lang === 'es' ? 'Plantilla' :
                    lang === 'it' ? 'Modello' :
                    'Template',
                  body:
`„Hallo, hier ist [Name]. Unfall an [Ort/Adresse].
[Anzahl] Verletzte; eine Person ist [z. B. bewusstlos / blutet stark].
Bitte schicken Sie schnell Hilfe. Meine Nummer: [Tel].“`
                },
                {
                  title:
                    lang === 'de' ? 'Beispiele' :
                    lang === 'fr' ? 'Exemples' :
                    lang === 'es' ? 'Ejemplos' :
                    lang === 'it' ? 'Esempi' :
                    'Examples',
                  body:
`• Blutung: „Person blutet stark am Arm.“
• Atemnot: „Person bekommt keine Luft.“
• Knochenbruch: „Bein verdreht, starke Schmerzen.“`
                }
              ]}
            />
          )}
          {/* FIRSTAID TABS END */}

          {/* Aufenthaltsort-Auswahl als modales Overlay: wird nur für
              Gefahren mit Kontext angezeigt.  Solange kein
              Aufenthaltsort gewählt wurde, werden weder die
              Zusammenfassung noch der Entscheidungsbaum gerendert. */}
          {locationModalOpen && !hazardsNoContext.includes(currentSlug) && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                // Hellere Overlay-Farbe: ein nahezu weißer Schleier verringert
                // den visuellen Stress in Notfallsituationen. Die frühere halbtransparente
                // schwarze Farbe wurde hier zu einem weißen Ton geändert.
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                zIndex: 3000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div
                style={{
                  background: '#fff',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  width: '90%',
                  maxWidth: '420px'
                }}
              >
                {/* Vorschlag basierend auf automatischer Erkennung */}
                {showLocationSuggest && detectedLocation && (
                  <div
                    style={{
                      marginBottom: '1rem',
                      padding: '0.5rem',
                      backgroundColor: '#e0f2fe',
                      border: '1px solid #bae6fd',
                      borderRadius: '6px'
                    }}
                  >
                    <p style={{ margin: '0 0 0.5rem 0' }}>
                      {(() => {
                        // Übersetze den erkannten Aufenthaltsort in Klartext
                        const label = locationLabels[detectedLocation]?.[lang] || detectedLocation;
                        return `Wir haben erkannt, dass du dich wahrscheinlich ${label} befindest. Möchtest du diese Einstellung übernehmen?`;
                      })()}
                    </p>
                    <button
                      onClick={() => {
                        setLocationCtx(detectedLocation);
                        setShowLocationSuggest(false);
                        setLocationModalOpen(false);
                      }}
                      style={{ marginRight: '0.5rem' }}
                    >
                      Ja
                    </button>
                    <button onClick={() => setShowLocationSuggest(false)}>Nein</button>
                  </div>
                )}
                {/* Dynamische Optionen basierend auf Hazard-Metadaten */}
                {(() => {
                  const meta = (hazardMeta && hazardMeta[currentSlug]) || {};
                  const codes = Array.isArray(meta.locations) && meta.locations.length > 0 ? meta.locations : ['home', 'outside', 'car'];
                  const opts = codes.map((code) => ({ value: code, label: (locationLabels[code] && locationLabels[code][lang]) || code }));
                  return (
                    <ContextSelector
                      type="location"
                      options={opts}
                      title={lang === 'de' ? 'Wo befindest du dich?' : lang === 'fr' ? 'Où te trouves‑tu ?' : lang === 'es' ? '¿Dónde te encuentras?' : lang === 'it' ? 'Dove ti trovi?' : 'Where are you?'}
                      description={lang === 'de' ? 'Bitte wähle deine aktuelle Situation aus, damit dir die passende Hilfe angezeigt werden kann.' : lang === 'fr' ? 'Veuillez choisir votre situation actuelle pour afficher l\'aide appropriée.' : lang === 'es' ? 'Elige tu situación actual para que se muestre la ayuda adecuada.' : lang === 'it' ? 'Seleziona la tua situazione attuale per visualizzare l\'aiuto appropriato.' : 'Please select your current situation so that the appropriate help can be displayed.'}
                      onSelect={(val) => {
                        setLocationCtx(val);
                        setLocationModalOpen(false);
                      }}
                    />
                  );
                })()}
              </div>
            </div>
          )}
          {/* Kurzbeschreibung als Liste und Entscheidungsbaum erst anzeigen,
             wenn entweder keine Kontextauswahl erforderlich ist oder bereits
             ein Aufenthaltsort gewählt wurde. Dadurch vermeiden wir
             Doppelungen und erleichtern die Orientierung. */}
          {/*
            Anzeige der Zusammenfassung und des Entscheidungsbaums.  Online
            blenden wir den Entscheidungsbaum erst ein, wenn entweder
            keine Kontextauswahl notwendig ist oder der Aufenthaltsort
            gewählt wurde.  Im Offline‑Modus zeigen wir den Baum sofort
            (auch ohne Kontext), damit der Nutzer nicht blockiert wird.
          */}
          {(!online || hazardsNoContext.includes(currentSlug) || locationCtx !== null) && (
            <>
              {/* Kurzbeschreibung als Liste nur im Offline‑Modus anzeigen.  So
                 stehen die wichtigsten Punkte als Fallback bereit, wenn
                 keine Internetverbindung besteht. */}
              {!online && summary && (
                <div className="hazard-summary" style={{ marginTop: '1rem' }}>
                  {(() => {
                    const parts = summary.includes('1.')
                      ? summary.split(/\s*\d+\.\s*/).filter(Boolean)
                      : summary.split(/\./).filter((s) => s.trim().length > 0);
                    return (
                      <ul style={{ paddingLeft: '1.2rem' }}>
                        {parts.map((text, idx) => (
                          <li key={idx} style={{ marginBottom: '0.3rem' }}>{text.trim()}</li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>
              )}
              {/* Entscheidungsbaum anzeigen (nur wenn gültig).  Einige
                 Kategorien verfügen noch über keine vollwertigen
                 Entscheidungsbäume.  In diesen Fällen besitzt das
                 tree‑Objekt keine children‑Eigenschaft.  Wir zeigen den
                 Entscheidungsbaum daher nur, wenn tree.children
                 vorhanden ist; ansonsten wird direkt der Chat genutzt. */}
              {tree && tree.children && (
                <DecisionTreeViewer
                  tree={tree}
                  onBack={backToOverview}
                  hideRootText={online}
                />
              )}
              {/* Persona-Auswahl: erst nach Aufenthaltsort zeigen, falls vorhanden */}
              {online && !hazardsNoContext.includes(currentSlug) && locationCtx != null && personaCtx == null && !profilePersona && (
                <div style={{ marginTop: '1rem' }}>
                  <ContextSelector type="persona" onSelect={(val) => setPersonaCtx(val)} />
                </div>
              )}
              {/* Chat‑Assistent wird weiter unten außerhalb dieser Bedingung gerendert */}
            </>
          )}
        </>
      )}
      {/* Chat‑Assistent: im Online‑Modus zeigen wir ihn unabhängig vom Aufenthaltsort an, sobald ein Kontext gesetzt wurde. */}
      {online && context && (
        <div style={{ marginTop: '1rem' }}>
          <ChatAssistant
            slug={currentSlug}
            context={context}
            suggestions={getSuggestions(currentSlug)}
            ttsEnabled={ttsEnabled}
            onClose={() => setChatOpen(false)}
            onLifeSaver={() => setLifeSaverOpen(true)}
            riskLevel={risk}
            buddy={buddy}
            onBuddyChange={handleBuddyChange}
            subHazards={medicalSubhazards}
            onSelectHazard={(slug) => loadTree(slug)}
          />
        </div>
      )}

      {/* Lernkarten-Button: erscheint, wenn für die aktuelle Gefahr Lernkarten definiert sind */}
      {online && context && currentSlug && learningCards[currentSlug] && (
        <div style={{ marginTop: '0.5rem' }}>
          <button
            onClick={() => {
              setLearningSlug(currentSlug);
              setLearningOpen(true);
            }}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#0369a1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            {lang === 'de'
              ? 'Lernkarten'
              : lang === 'fr'
              ? 'Cartes d’apprentissage'
              : lang === 'es'
              ? 'Tarjetas de aprendizaje'
              : lang === 'it'
              ? 'Schede didattiche'
              : 'Learning cards'}
          </button>
        </div>
      )}

      {/* Map‑Button: erscheint, wenn für die aktuelle Gefahr passende POI‑Typen
          definiert sind.  Öffnet das Karten‑Overlay, damit der Nutzer sich
          bei Bedarf die nächstgelegenen Einrichtungen anzeigen lassen kann. */}
      {online && context && currentSlug && mapFilterTypes.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <button
            onClick={() => setMapOpen(true)}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#0a3a72', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            {lang === 'de'
              ? 'Hilfe in der Nähe'
              : lang === 'fr'
              ? 'Aide à proximité'
              : lang === 'es'
              ? 'Ayuda cercana'
              : lang === 'it'
              ? 'Aiuto nelle vicinanze'
              : 'Nearby help'}
          </button>
        </div>
      )}

      {/* Karten-Overlay: zeigt nach Abschluss des Navigators die nächstgelegenen
          Einrichtungen basierend auf der erkannten Gefahr. Die Karte wird
          nur angezeigt, wenn mapOpen true ist. Ein Klick außerhalb der
          Kartenbox schließt die Ansicht. */}
      {mapOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            // Helles Overlay für die Kartenansicht: minimiert den visuellen Stress
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            zIndex: 3500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={(e) => {
            // Close only when clicking on the dark overlay
            if (e.target === e.currentTarget) setMapOpen(false);
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '8px',
              width: '95%',
              maxWidth: '1100px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1rem'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.5rem'
              }}
            >
              <h3 style={{ margin: 0 }}>
                {lang === 'de'
                  ? 'Hilfe in der Nähe'
                  : lang === 'fr'
                  ? 'Aide à proximité'
                  : lang === 'es'
                  ? 'Ayuda cercana'
                  : lang === 'it'
                  ? 'Aiuto vicino'
                  : 'Help nearby'}
              </h3>
              <button onClick={() => setMapOpen(false)} style={{ fontSize: '1.25rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                ×
              </button>
            </div>
            <OfflineMap types={mapFilterTypes} limit={1} autoRoute={true} />
          </div>
        </div>
      )}

      {/* Lernkarten-Overlay: zeigt ein Overlay mit interaktiven Lernkarten für die aktuelle Gefahr */}
      {learningOpen && learningSlug && (
        <LearningCard
          cards={learningCards[learningSlug] || []}
          onClose={() => {
            setLearningOpen(false);
            setLearningSlug(null);
          }}
        />
      )}
      {/* Einstellungsdialog: erscheint über der Seite, wenn settingsOpen true ist */}
      {settingsOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            // Hellere Overlay-Farbe für den Einstellungsdialog. Ein heller,
            // transparenter Hintergrund sorgt dafür, dass Nutzer:innen den
            // Dialog besser wahrnehmen können, ohne dass der Rest der Seite
            // komplett abgedunkelt wird.
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: '1.5rem',
              borderRadius: '8px',
              width: '90%',
              maxWidth: '400px'
            }}
          >
            <h3 style={{ marginTop: 0 }}>Einstellungen</h3>
            {/* Persona-Auswahl */}
            <div style={{ marginBottom: '1rem' }}>
              <p><strong>Persönliches Profil</strong></p>
              <p>Wähle aus, welche Beschreibung am besten passt. Diese Auswahl wird gespeichert und bei Bedarf automatisch verwendet.</p>
              {['adult', 'senior', 'child', 'handicap', ''].map((val) => (
                <label key={val} style={{ display: 'block', marginBottom: '0.5rem' }}>
                  <input
                    type="radio"
                    name="profilePersona"
                    value={val}
                    checked={profilePersona === val}
                    onChange={(e) => setProfilePersona(e.target.value)}
                  />
                  {val === '' ? 'Keine Angabe' : val === 'adult' ? 'Erwachsener' : val === 'senior' ? 'Senior' : val === 'child' ? 'Kind' : 'Person mit Handicap'}
                </label>
              ))}
            </div>

              {/* Text‑to‑Speech‑Einstellung */}
              <div style={{ marginBottom: '1rem' }}>
                <p><strong>Sprachausgabe</strong></p>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={ttsEnabled}
                    onChange={(e) => {
                      setTtsEnabled(e.target.checked);
                      try {
                        localStorage.setItem('ttsEnabled', JSON.stringify(e.target.checked));
                      } catch {}
                    }}
                  />
                  Sprachausgabe aktivieren (Text‑to‑Speech)
                </label>
              </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  // Speichere die aktuelle Auswahl im localStorage
                  try {
                    localStorage.setItem('profilePersona', profilePersona);
                  } catch {}
                  setSettingsOpen(false);
                }}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#004080', color: '#fff', border: 'none', borderRadius: '4px' }}
              >
                Speichern
              </button>
              <button
                onClick={() => {
                  // Bei Abbruch nichts speichern
                  setSettingsOpen(false);
                }}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#ccc', border: 'none', borderRadius: '4px' }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notfall‑Navigator als zentriertes Modal.  Wenn navigatorOpen
          true ist, wird das Overlay angezeigt und alle anderen
          interaktiven Elemente werden überlagert.  Der Navigator
          stellt Fragen, um eine Gefahrenlage zu identifizieren, und
          ruft handleNavigatorComplete nach der letzten Antwort auf. */}
      {/* Life‑Saver‑Modus Overlay: zeige Schritt‑für‑Schritt‑Ansicht, wenn aktiviert */}
      {lifeSaverOpen && tree && (
        <LifeSaverMode
          tree={tree}
          onClose={() => setLifeSaverOpen(false)}
          lang={lang}
        />
      )}

      {/* Standort teilen: erlaubt das Senden des aktuellen Standorts an einen Notfallkontakt */}
      <ShareLocationButton defaultContact={buddy} lang={lang} />

      {navigatorOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            width: '100%',
            height: '100%',
            // Helles Overlay: leichter weißer Schleier, damit der Hintergrund weniger ablenkt.
            // Diese Farbe sorgt dafür, dass der Navigator gut sichtbar ist, ohne den Inhalt
            // komplett zu verdunkeln. Ein fast weißer Hintergrund hilft insbesondere
            // Menschen in Stresssituationen, sich zu orientieren.
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            zIndex: 4000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflowY: 'auto',
            padding: '1rem'
          }}
        >
          {/* Nutze den neuen QuickNavigator anstelle des alten CrisisNavigator. Er
              berücksichtigt mehr Kontextfragen und gibt die gesammelten
              Antworten an handleNavigatorComplete weiter. */}
          <div
            style={{
              maxWidth: '600px',
              width: '100%',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '1rem',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            <QuickNavigator
              hazardMeta={hazardMeta}
              lang={lang}
              onComplete={handleNavigatorComplete}
              deviceLocation={deviceLocation}
            />
          </div>
        </div>
      )}
      {/* Globale Overlays */}
      <PersonalInfoToolkit open={infoOpen} onClose={() => setInfoOpen(false)} />
      <TipsModal open={tipsOpen} tips={tipsForHazard} onClose={() => setTipsOpen(false)} />
      <FeedbackForm open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onToggleSensors={(enabled) => {
          if (enabled) contextRef.current?.enable(); else contextRef.current?.disable();
        }}
      />
    </div>
  );
}

export default App;
