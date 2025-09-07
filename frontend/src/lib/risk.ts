// src/lib/risk.ts
//
// Centralised risk scoring logic for the NAh‑final application. The
// algorithm assigns a risk level (low, medium, high) based on the
// hazard slug, the current decision tree node, persona, patient
// vitals and contextual information such as crash detection.
//
export type Persona = 'default' | 'child' | 'senior' | 'cognitive';
export type Risk = 'low' | 'medium' | 'high';

export interface RiskContext {
  /** Hazard slug, e.g. 'herzstillstand' */
  hazard: string;
  /** Optional current node ID within the decision tree */
  nodeId?: string;
  /** Persona: influences risk scaling (children and seniors are treated as high risk) */
  persona?: Persona;
  /** Contextual info from sensors (crash detection etc.) */
  context?: {
    /** Confidence of crash/fall detection (0..1) */
    crashConfidence?: number;
    /** Whether it is night time (22:00–06:00) */
    isNight?: boolean;
    /** Current speed in km/h if available */
    speedKmh?: number;
  };
  /** Patient vitals (if known) */
  vitals?: {
    breathing?: boolean;
    bleeding?: 'none' | 'minor' | 'severe';
  };
}

// Baseline risk per hazard when no extra info is available
const BASE: Record<string, Risk> = {
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
 */
export function riskScore(ctx: RiskContext): Risk {
  let risk: Risk = BASE[ctx.hazard] ?? 'low';
  // Escalate based on node ID
  if (ctx.nodeId && ESCALATE_NODES.has(ctx.nodeId)) {
    risk = 'high';
  }
  // Severe bleeding escalates risk
  if (ctx.vitals?.bleeding === 'severe') {
    risk = 'high';
  }
  // Children are always high risk for medium/high hazards
  if (ctx.persona === 'child' && risk !== 'low') {
    risk = 'high';
  }
  // Crash detection influences risk
  if (ctx.context?.crashConfidence && ctx.context.crashConfidence > 0.6) {
    risk = 'high';
  }
  // Elevate at night time if currently medium
  if (ctx.context?.isNight && risk === 'medium') {
    risk = 'high';
  }
  return risk;
}

export interface CTAFeatures {
  hasBuddy?: boolean;
  hasAEDNearby?: boolean;
}

/**
 * Suggest a call to action given the risk level and available features.
 */
export function callToAction(risk: Risk, features: CTAFeatures): string {
  if (risk === 'high') return 'Sofort 112 anrufen';
  if (features.hasAEDNearby) return 'Zum nächstgelegenen AED führen';
  if (features.hasBuddy) return 'Buddy pingen';
  return 'Ruhig bleiben und Anweisungen folgen';
}