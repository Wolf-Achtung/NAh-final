// server/routes/gpt-classify.ts
//
// Classify free‑form user descriptions into hazard categories. This
// endpoint uses OpenAI's chat completion API with a low cost model
// (e.g. gpt-4o-mini) and leverages synonyms for better understanding.

import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Load synonyms at startup. We read them synchronously on first
// request; they are stable during runtime. If you change the file
// contents, reload the server.
let synonymsCache: any | null = null;
async function getSynonyms() {
  if (synonymsCache) return synonymsCache;
  const filePath = path.join(process.cwd(), 'src', 'data', 'hazard_synonyms.json');
  const raw = await fs.readFile(filePath, 'utf8');
  synonymsCache = JSON.parse(raw);
  return synonymsCache;
}

router.post('/api/gpt-classify', async (req, res) => {
  try {
    const text = String((req.body && req.body.text) || '').trim().slice(0, 500);
    const persona = (req.body && req.body.persona) || 'default';
    if (!text) {
      return res.json({ hazard: 'notruf', confidence: 0.5, override_risk: undefined, cta: undefined });
    }
    const synonyms = await getSynonyms();
    const hazards = Object.keys(synonyms);
    // Build system prompt
    const systemMsg =
      'Du bist ein strenger Notfall-Klassifizierer. Antworte nur mit JSON. ' +
      'Ordne eine kurze Freitextbeschreibung einer der Gefahrenkategorien zu. ' +
      'Falls lebensbedrohliche Hinweise vorkommen (kein Atmen, bewusstlos, starke Blutung), setze "override_risk":"high" und "cta":"Sofort 112 anrufen".' +
      ' Nutze keine medizinischen Diagnosen, nur Kategorien aus HAZARDS.';
    // Provide synonyms to the model for additional guidance
    const metaMsg = `HAZARDS=${JSON.stringify(hazards)}; SYNO=${JSON.stringify(synonyms)}; PERSONA=${persona}`;
    // Examples to ground the model
    const examples = [
      {
        user: 'Er atmet nicht und ist bewusstlos',
        out: { hazard: 'herzstillstand', confidence: 0.98, override_risk: 'high', cta: 'Sofort 112 anrufen' }
      },
      {
        user: 'stark blutet aus dem Bein',
        out: { hazard: 'starke_blutung', confidence: 0.93 }
      },
      {
        user: 'krampft am ganzen Körper',
        out: { hazard: 'krampfanfall', confidence: 0.92 }
      }
    ];
    const messages: any[] = [
      { role: 'system', content: systemMsg },
      { role: 'user', content: metaMsg }
    ];
    // Flatten examples
    examples.forEach((ex) => {
      messages.push({ role: 'user', content: ex.user });
      messages.push({ role: 'assistant', content: JSON.stringify(ex.out) });
    });
    messages.push({ role: 'user', content: text });
    // Call model
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' } as any,
      messages
    });
    const msg = response.choices[0].message?.content || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(msg);
    } catch {
      parsed = {};
    }
    // Default hazard if nothing classified
    const hazard = parsed.hazard && hazards.includes(parsed.hazard) ? parsed.hazard : 'notruf';
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.6;
    const override_risk = parsed.override_risk;
    const cta = parsed.cta;
    res.json({ hazard, confidence, override_risk, cta });
  } catch (err: any) {
    console.error('gpt-classify error', err);
    res.status(500).json({ error: err.message || 'classification failed' });
  }
});

export default router;