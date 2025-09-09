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
export async function planSteps({ text = '', sensor = {}, locale = 'de', online = false }) {
  const intent = inferIntent(text, locale);
  // Fallback to 'unklare_gefahr' if nothing matches
  const base = (rules[intent]?.steps?.[locale]) || (rules['unklare_gefahr']?.steps?.[locale]) || [];
  const risk = scoreRisk(sensor);
  const ordered = prioritise(base, risk);
  if (online) {
    try {
      const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/plan-refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent, steps: ordered, sensor, locale })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data?.steps) && data.steps.length > 0) {
          return { intent, risk, steps: data.steps, source: 'ai+rules' };
        }
      }
    } catch {
      // ignore network failures
    }
  }
  return { intent, risk, steps: ordered, source: 'rules' };
}

// Very basic intent inference: check for German keywords.  This can be
// extended with synonyms or small classification models.
function inferIntent(text, locale) {
  const t = (text || '').toLowerCase();
  // Note: keep patterns simple to avoid false positives.
  if (/(brust|brustschmerz|druck)/.test(t)) return 'herzinfarkt';
  if (/(herzstillstand|reanimation|nicht atmet)/.test(t)) return 'herzstillstand';
  if (/(krampf|epileps)/.test(t)) return 'krampfanfall';
  if (/(allergie|biene|schwellung|anaphyl)/.test(t)) return 'anaphylaxie';
  if (/(hitz|sonne|kollaps)/.test(t)) return 'hitze_uv_duerre';
  if (/(blut|blutung|blutet|stark blut)/.test(t)) return 'blutung_stark';
  return 'unklare_gefahr';
}

function prioritise(steps, risk) {
  // Prioritise life‑saving steps first when risk is high.
  const criticalKeywords = ['112', 'herzdruckmassage', 'atmen', 'druck'];
  return [...steps].sort((a, b) => {
    const aw = criticalKeywords.some(k => a.toLowerCase().includes(k)) ? 2 : 0;
    const bw = criticalKeywords.some(k => b.toLowerCase().includes(k)) ? 2 : 0;
    if (risk.level === 'high') {
      return bw - aw;
    }
    return 0;
  });
}