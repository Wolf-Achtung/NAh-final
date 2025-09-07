// src/lib/offlineClassify.ts
//
// Provides a lightweight, offline classification mechanism for mapping
// free‑form descriptions to hazard categories based on synonym lists.
// This is useful when the device is offline and cannot reach the GPT
// classifier. The algorithm normalises the input string and matches
// synonyms by substring. It returns a hazard slug and a confidence
// score between 0 and 1.

import hazardSynonyms from '../data/hazard_synonyms.json';

function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\s\p{Punctuation}]+/gu, ' ')
    .trim();
}

/**
 * Offline classifier: returns the best matching hazard and a simple
 * confidence score. The language parameter selects the synonym list.
 */
export function offlineClassify(input: string, lang: 'de' | 'en' = 'de'): { hazard: string; confidence: number } {
  const text = normalise(input);
  let best = { hazard: 'notruf', score: 0 };
  const synonyms: any = hazardSynonyms as any;
  for (const [hazard, langs] of Object.entries(synonyms)) {
    const list: string[] = langs[lang] || [];
    let score = 0;
    list.forEach((phrase) => {
      const norm = normalise(phrase);
      if (text.includes(norm)) {
        // Weight by phrase length: longer phrases contribute more
        score += Math.min(1, phrase.split(' ').length / 3);
      }
    });
    if (score > best.score) {
      best = { hazard: hazard as string, score };
    }
  }
  // Normalise score to 0..1 by dividing by an arbitrary max (3)
  const confidence = Math.min(1, best.score / 3);
  return { hazard: best.hazard, confidence };
}