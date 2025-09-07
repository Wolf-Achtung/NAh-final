/**
 * telemetry.ts
 *
 * Ein minimalistisches Telemetrie‑Modul, das Interaktionsdaten im
 * Browser speichert. Jeder Aufruf von logEvent speichert ein neues
 * Ereignis in localStorage. Die Daten können später anonymisiert
 * übertragen werden. Eine einfache Schnittstelle, die auch offline
 * funktioniert.
 */
export interface TelemetryEvent {
  type: string;
  timestamp: number;
  payload?: any;
}

const STORAGE_KEY = 'telemetryLogs';

/**
 * Speichert ein Telemetrie‑Ereignis.  Events werden in einem Array
 * in localStorage gesammelt. Übersteigt die Anzahl 1000 Einträge,
 * werden die ältesten entfernt.
 */
export function logEvent(type: string, payload: any = {}): void {
  const entry: TelemetryEvent = { type, timestamp: Date.now(), payload };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: TelemetryEvent[] = raw ? JSON.parse(raw) : [];
    list.push(entry);
    // Max 1000 Einträge behalten
    if (list.length > 1000) list.splice(0, list.length - 1000);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore errors (e.g. quota exceeded)
  }
}

/**
 * Gibt die gespeicherten Telemetrie‑Ereignisse zurück.
 */
export function getLogs(): TelemetryEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Löscht alle gespeicherten Telemetrie‑Ereignisse.
 */
export function clearLogs(): void {
  localStorage.removeItem(STORAGE_KEY);
}