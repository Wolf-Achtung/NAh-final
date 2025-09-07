// src/lib/prompts.ts
//
// Provides system prompts tailored to different personas for the chat
// assistant. The prompts constrain the language and sentence length
// according to the needs of children, seniors or users with cognitive
// impairments. There is also a helper to truncate text based on a
// difficulty level (basic, standard, detail).

export type Persona = 'default' | 'child' | 'senior' | 'cognitive';
export type Level = 'basic' | 'standard' | 'detail';

/**
 * Return a system prompt for the specified persona. Prompts aim to
 * enforce short, simple sentences and avoid technical terms.
 */
export function systemPrompt(persona: Persona): string {
  const base = 'Gib klare, kurze Schritte. Maximal zehn Wörter. Sag zuerst, was wichtig ist. Keine Fachsprache.';
  switch (persona) {
    case 'child':
      return 'Sprich sehr einfach. Kurze Sätze. Freundlich. Schritt für Schritt. Keine Fremdwörter.';
    case 'senior':
      return 'Sprich deutlich. Kurze Sätze. Langsam. Nenne wenige Schritte nacheinander.';
    case 'cognitive':
      return 'Sehr einfache Wörter. Ein Schritt pro Zeile. Pausen einbauen.';
    default:
      return base;
  }
}

/**
 * Limit the number of words in a string according to the level. Basic
 * allows 7 words, standard 10, detail 14. The persona is ignored
 * here, but could be used for additional constraints.
 */
export function limitText(text: string, level: Level): string {
  let maxWords = 10;
  if (level === 'basic') maxWords = 7;
  if (level === 'detail') maxWords = 14;
  return text.split(/\s+/).slice(0, maxWords).join(' ');
}