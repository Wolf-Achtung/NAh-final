// src/lib/risk.js
//
// Centralised risk scoring logic for the NAh‑final application. The
// algorithm assigns a risk level (low, medium, high) based on the
// hazard slug, the current decision tree node, persona, patient
// vitals and contextual information such as crash detection.

// Baseline risk per hazard when no extra info is available
const BASE = {
  herzstillstand: 'high',
  schlaganfall: 'high',
  starke_blutung: 'high',
  anaphylaxie: 'high',
  atemnot: 'medium',
  krampfanfall: 'medium',
  hypoglykaemie: 'medium',
  unfall_sofortmassnahmen: 'medium',
  stabile_seitenlage: 'low',
  herzinfarkt: 'high',
  lawine: 'high',
  notruf: 'high'
};

// Nodes that automatically trigger high risk
const ESCALATE_NODES = new Set(['no_breathing', 'unresponsive', 'severe_bleeding', 'shock_signs']);

/**
 * Compute the risk level for the current context. The function raises
 * the risk when certain conditions are met: severe bleeding, lack of
 * breathing, children persona, crash detection or night time.
 *
 * @param {Object} ctx - Context object containing hazard, nodeId, persona,
 *                       context and vitals information.
 * @returns {string} risk - 'low', 'medium' or 'high'.
 */
export function riskScore(ctx) {
  let risk = BASE[ctx.hazard] ?? 'low';
  // Escalate based on node ID
  if (ctx.nodeId && ESCALATE_NODES.has(ctx.nodeId)) {
    risk = 'high';
  }
  // Severe bleeding escalates risk
  if (ctx.vitals && ctx.vitals.bleeding === 'severe') {
    risk = 'high';
  }
  // Children are always high risk for medium/high hazards
  if (ctx.persona === 'child' && risk !== 'low') {
    risk = 'high';
  }
  // Crash detection influences risk
  if (ctx.context && ctx.context.crashConfidence && ctx.context.crashConfidence > 0.6) {
    risk = 'high';
  }
  // Elevate at night time if currently medium
  if (ctx.context && ctx.context.isNight && risk === 'medium') {
    risk = 'high';
  }
  return risk;
}

/**
 * Suggest a call to action given the risk level and available features.
 *
 * @param {string} risk - The computed risk level.
 * @param {Object} features - Available features such as presence of a buddy or AED.
 * @returns {string} CTA - The call to action text.
 */
export function callToAction(risk, features = {}) {
  if (risk === 'high') return 'Sofort 112 anrufen';
  if (features.hasAEDNearby) return 'Zum nächstgelegenen AED führen';
  if (features.hasBuddy) return 'Buddy pingen';
  return 'Ruhig bleiben und Anweisungen folgen';
}