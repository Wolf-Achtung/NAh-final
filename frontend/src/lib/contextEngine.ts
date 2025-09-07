// src/lib/contextEngine.ts
//
// Heuristic crash/fall detection using device motion and geolocation. The
// engine listens to accelerometer events and geolocation updates to
// infer potential accidents and emits suggestions with a confidence
// score. A suggestion does not automatically trigger actions; the UI
// must ask the user to confirm before starting the appropriate flow.

export interface ContextSuggestion {
  hazard: 'unfall_sofortmassnahmen';
  confidence: number;
  reason: string[];
}

export class ContextEngine {
  private accelSpike = 0;
  private lastImpact = 0;
  private stillSince = 0;
  private speedKmh = 0;
  private listeners: ((s: ContextSuggestion) => void)[] = [];

  // Keep track of whether the engine is enabled and store listener/ids
  private enabled = false;
  private motionHandler?: any;
  private geoWatchId?: number;

  async enable() {
    if (this.enabled) return;
    this.enabled = true;
    // iOS requires explicit permission to access motion sensors
    // @ts-ignore
    if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) {
      try {
        await DeviceMotionEvent.requestPermission();
      } catch {
        /* ignore */
      }
    }
    this.motionHandler = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const g = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
      const now = performance.now();
      // Identify free fall or high impact (> 3g)
      if (g > 30) {
        this.accelSpike = g;
        this.lastImpact = now;
      }
      // Detect stillness after impact (< 0.3g)
      if (now - this.lastImpact < 15000) {
        const still = g < 3;
        if (still && this.stillSince === 0) this.stillSince = now;
        if (!still) this.stillSince = 0;
      } else {
        this.stillSince = 0;
      }
      this.evaluate();
    };
    window.addEventListener('devicemotion', this.motionHandler);
    if ('geolocation' in navigator) {
      this.geoWatchId = navigator.geolocation.watchPosition(
        (p) => {
          const sp = (p.coords.speed ?? 0) * 3.6;
          this.speedKmh = Math.max(0, sp);
          this.evaluate();
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }
  }

  /**
   * Deaktiviert den Kontext‑Engine. Event Listener und Geolocation Watch
   * werden entfernt, um Strom zu sparen. Kann später durch enable() wieder
   * aktiviert werden.
   */
  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    if (this.motionHandler) {
      window.removeEventListener('devicemotion', this.motionHandler);
      this.motionHandler = undefined;
    }
    if (this.geoWatchId !== undefined) {
      navigator.geolocation.clearWatch(this.geoWatchId);
      this.geoWatchId = undefined;
    }
  }

  onSuggest(fn: (s: ContextSuggestion) => void) {
    this.listeners.push(fn);
  }

  private evaluate() {
    const reasons: string[] = [];
    let score = 0;
    if (this.accelSpike > 30) {
      score += 0.4;
      reasons.push('starker Aufprall');
    }
    if (this.stillSince > 0 && performance.now() - this.stillSince > 3000) {
      score += 0.3;
      reasons.push('Stillstand nach Aufprall');
    }
    if (this.speedKmh > 25) {
      score += 0.2;
      reasons.push('Fahrt erkannt');
    }
    // Night time slight increase
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) {
      score += 0.05;
      reasons.push('Nachtzeit');
    }
    if (score >= 0.6) {
      this.emit({ hazard: 'unfall_sofortmassnahmen', confidence: Math.min(1, score), reason: reasons });
    }
  }

  private emit(s: ContextSuggestion) {
    this.listeners.forEach((fn) => fn(s));
  }
}