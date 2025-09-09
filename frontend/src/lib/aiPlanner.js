// src/lib/aiPlanner.js
//
// This module implements a simple edge‑first triage planner.  Given a free‑text
// description of the situation and optional sensor data, it infers an intent
// (medical emergency type) and returns a prioritised list of actions.
// Offline heuristic rules provide a baseline, while an optional backend call
// can refine the plan if network connectivity is available.

import { scoreRisk } from './riskEngine';
import rules from './plannerRules.json';

/**
 * Plan steps for the given situation.  This function uses a very simple
 * keyword‑based intent inference.  It can be replaced by a more sophisticated
 * model in the future (e.g. tiny TFJS model loaded on demand).
 *
 * @param {Object} params
 * @param {string} params.text Free‑text description from the user.
 * @param {Object} params.sensor Sensor readings (accel, temp, etc.).
 * @param {string} params.locale Language code (e.g. 'de', 'en').
 * @param {boolean} params.online Whether the device is online; if true a
 *                                backend refinement request is attempted.
 * @returns {Promise<{intent: string, risk: Object, steps: string[], source: string}>}
 */
export async function planSteps({ text = '', sensor = {}, locale = 'de', online = false, hints = [] }) {
  // Determine the most likely hazard intent from the description and hints
  const intent = inferIntent(text, locale, hints);
  // Fetch baseline steps for the inferred intent; fall back to 'unklare_gefahr' if unknown
  let base = (rules[intent]?.steps?.[locale]) || (rules['unklare_gefahr']?.steps?.[locale]) || [];
  // Compute a simple risk score from available sensor data
  const risk = scoreRisk(sensor);
  // Sort the baseline steps according to risk level and critical keywords
  let ordered = prioritise(base, risk, hints);
  // Build a list of additional steps based on hints if not already present
  const prepend = [];
  if (hints.includes('aed_icon') && !ordered.some((s) => /aed/i.test(s))) {
    prepend.push(locale === 'de' ? 'AED holen lassen (jemanden losschicken).' : 'Send someone to get an AED.');
  }
  if (hints.includes('blood_suspected') && !ordered.some((s) => /druck|blutung/i.test(s))) {
    prepend.push(locale === 'de' ? 'Direkten Druck auf die Wunde ausüben.' : 'Apply direct pressure to the wound.');
  }
  if (hints.includes('smoke_fire') && !ordered.some((s) => /gebäude verlassen|ins freie|evaku/i.test(s))) {
    prepend.push(locale === 'de' ? 'Gebäude geordnet verlassen.' : 'Evacuate the building in an orderly fashion.');
  }
  ordered = [...prepend, ...ordered];
  // Generate a concise call-to-action to display prominently in the UI
  const cta = getCTA({ intent, hints, locale });
  // Optionally refine the plan via the backend using a GPT-powered endpoint
  if (online) {
    try {
      const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/plan-refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: intent, steps: ordered, sensor, locale }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const refinedSteps = Array.isArray(data?.steps) && data.steps.length > 0 ? data.steps : ordered;
        const refinedCTA = typeof data?.cta === 'string' && data.cta.trim().length > 0 ? data.cta : cta;
        return { intent, risk, steps: refinedSteps, source: 'ai+rules', cta: refinedCTA };
      }
    } catch {
      // Fallback silently to local plan on network or parsing errors
    }
  }
  return { intent, risk, steps: ordered, source: 'rules', cta };
}

/**
 * Generate a short, actionable CTA (call to action) based on the identified
 * hazard or hints.  CTAs are phrased in simple language to accommodate
 * older adults, children, people with disabilities, and tourists.  They
 * summarise the single most important next step.
 *
 * @param {Object} params
 * @param {string} params.intent The inferred hazard slug
 * @param {string[]} params.hints Vision hints that may override the CTA
 * @param {string} params.locale Language code ('de' or 'en')
 * @returns {string|null} A short CTA or null if none applies
 */
function getCTA({ intent, hints = [], locale = 'de' }) {
  // Define CTAs for known hazards
  const ctasDe = {
    herzstillstand: 'Bei Atemstillstand: Sofort Herzdruckmassage durchführen.',
    herzinfarkt: 'Bei Brustschmerzen: 112 rufen und auf Herzdruckmassage vorbereiten.',
    krampfanfall: 'Krampfanfall: Umgebung sichern und Kopf polstern.',
    anaphylaxie: 'Anaphylaxie: Adrenalin sofort injizieren und 112 verständigen.',
    hitze_uv_duerre: 'Schatten aufsuchen: Kühle dich ab und trinke ausreichend.',
    blutung_stark: 'Blutung stoppen: Fester Druck auf die Wunde.',
    brand_feuer: 'In Sicherheit bringen: Gebäude ruhig und schnell verlassen.',
    unklare_gefahr: 'Schütze dich: Abstand halten und Gefahren meiden.',
  };
  const ctasEn = {
    herzstillstand: 'If not breathing: start chest compressions immediately.',
    herzinfarkt: 'Chest pain: call emergency and prepare for compressions.',
    krampfanfall: 'Seizure: clear the area and cushion the head.',
    anaphylaxie: 'Anaphylaxis: inject adrenaline immediately and call emergency.',
    hitze_uv_duerre: 'Find shade: cool down and drink water.',
    blutung_stark: 'Stop bleeding: apply firm pressure to the wound.',
    brand_feuer: 'Get to safety: leave the building quickly and calmly.',
    unklare_gefahr: 'Protect yourself: keep away from danger and stay alert.',
  };
  // Vision hints override to emphasise direct actions
  if (hints.includes('blood_suspected')) {
    return locale === 'de' ? 'Blutung stoppen: Fester Druck auf die Wunde.' : 'Stop bleeding: apply firm pressure to the wound.';
  }
  if (hints.includes('smoke_fire')) {
    return locale === 'de' ? 'Sofort raus: Gebäude verlassen und in Sicherheit bringen.' : 'Move out: leave the building and get to safety.';
  }
  if (hints.includes('aed_icon')) {
    return locale === 'de' ? 'AED holen lassen: Bitte jemanden schicken, um einen AED zu holen.' : 'Get an AED: send someone to retrieve an AED.';
  }
  // Return the hazard-specific CTA or null
  const map = locale === 'de' ? ctasDe : ctasEn;
  return map[intent] || null;
}

// Very basic intent inference: check for German keywords.  This can be
// extended with synonyms or small classification models.
function inferIntent(text, locale, hints = []) {
  // If hints clearly indicate a specific hazard, return that hazard first.
  if (hints.includes('blood_suspected')) return 'blutung_stark';
  if (hints.includes('smoke_fire')) return 'brand_feuer';
  // Otherwise fall back to text patterns.
  const t = (text || '').toLowerCase();
  if (/(brust|brustschmerz|druck)/.test(t)) return 'herzinfarkt';
  if (/(herzstillstand|reanimation|nicht atmet)/.test(t)) return 'herzstillstand';
  if (/(krampf|epileps)/.test(t)) return 'krampfanfall';
  if (/(allergie|biene|schwellung|anaphyl)/.test(t)) return 'anaphylaxie';
  if (/(hitz|sonne|kollaps)/.test(t)) return 'hitze_uv_duerre';
  if (/(blut|blutung|blutet|stark blut)/.test(t)) return 'blutung_stark';
  return 'unklare_gefahr';
}

function prioritise(steps, risk, hints = []) {
  // Prioritise life‑saving steps first when risk is high.  Also push AED steps
  // to the top if an AED icon is seen.
  const criticalKeywords = ['112', 'herzdruckmassage', 'atmen', 'druck'];
  let ordered = [...steps].sort((a, b) => {
    const aw = criticalKeywords.some(k => a.toLowerCase().includes(k)) ? 2 : 0;
    const bw = criticalKeywords.some(k => b.toLowerCase().includes(k)) ? 2 : 0;
    if (risk.level === 'high') {
      return bw - aw;
    }
    return 0;
  });
  // If AED hint is present, bring AED-related steps to the front.
  if (hints.includes('aed_icon')) {
    ordered.sort((a, b) => {
      const wa = /aed/i.test(a) ? 0 : 1;
      const wb = /aed/i.test(b) ? 0 : 1;
      return wa - wb;
    });
  }
  return ordered;
}