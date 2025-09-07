import React, { useMemo, useState } from "react";

/**
 * ChatAssistant – kompakter Modus für eindeutige Gefahren:
 * - Für alle Slugs zeigen wir 2–3 Sofort-Handlungen (kompakt).
 * - Vorschlagsfragen sind stark gekürzt (max. 2) und nur Fallback.
 *
 * Props:
 * - slug: aktueller Gefahren-Slug (z. B. 'krisen_konflikte')
 * - onSend(message: string): sendet Chat-Nachricht ans Backend
 * - suggestions?: string[] (optional, Fallback)
 * - lang?: 'de' | 'en' | ...
 */
export default function ChatAssistant({
  slug,
  onSend,
  suggestions = [],
  lang = "de",
}) {
  const [input, setInput] = useState("");

  // Slug-spezifische Kurz-Anweisungen (Soforthilfe) – für ALLE gängigen Slugs
  const compactAdvice = useMemo(() => {
    const t = (de, en) => (lang === "de" ? de : en);
    const map = {
      krisen_konflikte: [
        t("➡️ In Deckung gehen, Abstand halten.", "➡️ Take cover, keep distance."),
        t("📞 112 anrufen und Standort melden.", "📞 Call 112 and report your location."),
        t("🚪 Sichere Ausgänge nutzen / Gebiet verlassen.", "🚪 Use safe exits / leave the area."),
      ],
      brand_feuer: [
        t("➡️ Gebäude verlassen, Türen schließen.", "➡️ Leave building, close doors."),
        t("📞 112 anrufen, Brand melden.", "📞 Call 112, report fire."),
        t("⛔ Kein Aufzug, tief unten bleiben (Rauch).", "⛔ No elevator, stay low (smoke)."),
      ],
      medizinischer_notfall: [
        t("➡️ Eigene Sicherheit prüfen.", "➡️ Ensure your own safety."),
        t("📞 112 anrufen, Situation beschreiben.", "📞 Call 112, describe situation."),
        t("❤️ Erste Hilfe leisten (wenn möglich).", "❤️ Provide first aid (if possible)."),
      ],
      blackout: [
        t("🔦 Lichtquellen/Powerbanks nutzen.", "🔦 Use flashlights/power banks."),
        t("📱 Handy-Akku sparen (Flugmodus).", "📱 Save phone battery (airplane mode)."),
        t("📻 Offizielle Hinweise beachten.", "📻 Follow official advisories."),
      ],
      hochwasser: [
        t("⬆️ Höher gelegene Bereiche aufsuchen.", "⬆️ Move to higher ground."),
        t("⚡ Strom aus, Wasser meiden.", "⚡ Turn off power, avoid water."),
        t("📞 Warnungen beachten/112 bei Not.", "📞 Follow alerts / call 112 if needed."),
      ],
      unwetter: [
        t("➡️ Drinnen bleiben, Fenster schließen.", "➡️ Stay indoors, close windows."),
        t("🚗 Fahrt verschieben, Unterstand suchen.", "🚗 Delay travel, find shelter."),
        t("📻 Offizielle Hinweise beachten.", "📻 Follow official advisories."),
      ],
      erdbeben: [
        t("🛡️ Ducken, Schützen, Festhalten.", "🛡️ Drop, Cover, Hold On."),
        t("🚪 Nach Erschütterung geordnet raus.", "🚪 Exit carefully after shaking stops."),
        t("📞 Gas/Elektrik prüfen, 112 bei Not.", "📞 Check gas/electric, call 112 if needed."),
      ],
      unfall: [
        t("🛑 Absichern, Warnblinker/Warndreieck.", "🛑 Secure scene, hazard lights/triangle."),
        t("📞 112 anrufen.", "📞 Call 112."),
        t("❤️ Erste Hilfe leisten.", "❤️ Provide first aid."),
      ],
      gefahrstoffe: [
        t("😷 Abstand, Gegenwind, Räume abdichten.", "😷 Keep distance, move upwind, seal rooms."),
        t("📞 112 informieren.", "📞 Call 112."),
        t("📻 Offizielle Hinweise beachten.", "📻 Follow official advisories."),
      ],
      // Fallback für sonstige/unklare
      unklare_gefahr: [
        t("➡️ In Sicherheit bringen / Abstand halten.", "➡️ Move to safety / keep distance."),
        t("📞 112 anrufen, Lage schildern.", "📞 Call 112 and describe situation."),
        t("📻 Offizielle Hinweise beachten.", "📻 Follow official advisories."),
      ],
    };
    return map[slug] || map.unklare_gefahr;
  }, [slug, lang]);

  const handleSend = () => {
    const msg = input.trim();
    if (!msg) return;
    onSend?.(msg);
    setInput("");
  };

  return (
    <div
      style={{
        width: 340,
        background: "#fff",
        borderRadius: 8,
        boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
        padding: 12,
        border: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          background: "#0a3a72",
          color: "#fff",
          padding: "8px 12px",
          borderRadius: 6,
          marginBottom: 10,
        }}
      >
        {lang === "de" ? "Chat-Assistent" : "Chat Assistant"}
      </div>

      {/* Kompaktmodus: Soforthilfe statt langer Fragenliste */}
      <div style={{ marginBottom: 10 }}>
        {compactAdvice.map((line, idx) => (
          <div key={idx} style={{ margin: "6px 0", color: "#111827" }}>
            {line}
          </div>
        ))}
      </div>

      {/* Sehr kurze, reduzierte Vorschläge (max. 2) nur als Fallback */}
      {(!suggestions || suggestions.length === 0 ? [] : suggestions.slice(0, 2)).map((s, i) => (
        <button
          key={i}
          onClick={() => onSend?.(s)}
          style={{
            width: "100%",
            marginBottom: 8,
            padding: "8px 10px",
            border: "1px solid #c7d2fe",
            background: "#eef2ff",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          {s}
        </button>
      ))}

      {/* Freie Frage */}
      <div style={{ marginTop: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={lang === "de" ? "Deine Frage…" : "Your question…"}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            marginBottom: 8,
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          onClick={handleSend}
          style={{
            width: "100%",
            padding: "8px 10px",
            background: "#0a3a72",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {lang === "de" ? "Senden" : "Send"}
        </button>
      </div>
    </div>
  );
}
