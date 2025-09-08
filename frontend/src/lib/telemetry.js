/**
 * telemetry.js
 *
 * A minimalist telemetry module that stores interaction data in
 * localStorage. Each call to logEvent stores a new entry. The data
 * can later be sent anonymously. The module works offline.
 */

const STORAGE_KEY = 'telemetryLogs';

/**
 * Save a telemetry event. Events are stored in an array in
 * localStorage. When the number of entries exceeds 1000, the oldest
 * ones are removed.
 */
export function logEvent(type, payload = {}) {
  const entry = { type, timestamp: Date.now(), payload };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.push(entry);
    // Keep at most 1000 entries
    if (list.length > 1000) list.splice(0, list.length - 1000);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore errors (e.g. quota exceeded)
  }
}

/**
 * Return the stored telemetry events.
 */
export function getLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Delete all stored telemetry events.
 */
export function clearLogs() {
  localStorage.removeItem(STORAGE_KEY);
}