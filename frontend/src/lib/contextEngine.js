// src/lib/contextEngine.js
//
// Heuristic crash/fall detection using device motion and geolocation. The
// engine listens to accelerometer events and geolocation updates to
// infer potential accidents and emits suggestions with a confidence
// score. A suggestion does not automatically trigger actions; the UI
// must ask the user to confirm before starting the appropriate flow.

export class ContextEngine {
  constructor() {
    // Initialise internal state
    this.accelSpike = 0;
    this.lastImpact = 0;
    this.stillSince = 0;
    this.speedKmh = 0;
    this.listeners = [];
    // Track whether the engine is enabled
    this.enabled = false;
    this.motionHandler = undefined;
    this.geoWatchId = undefined;
  }

  /**
   * Enable the context engine. Registers device motion and geolocation
   * listeners to detect potential crashes or falls. Requests permission
   * on iOS devices if necessary.
   */
  async enable() {
    if (this.enabled) return;
    this.enabled = true;
    // iOS requires explicit permission to access motion sensors
    // eslint-disable-next-line no-undef
    if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) {
      try {
        // eslint-disable-next-line no-undef
        await DeviceMotionEvent.requestPermission();
      } catch {
        /* ignore permission errors */
      }
    }
    // Create a handler that processes accelerometer data
    this.motionHandler = (e) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const g = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
      const now = performance.now();
      // Detect strong impact (> ~3g)
      if (g > 30) {
        this.accelSpike = g;
        this.lastImpact = now;
      }
      // Detect stillness after impact (< ~0.3g)
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
    // Watch geolocation to determine speed
    if ('geolocation' in navigator) {
      this.geoWatchId = navigator.geolocation.watchPosition(
        (p) => {
          const sp = (p.coords.speed ?? 0) * 3.6; // m/s to km/h
          this.speedKmh = Math.max(0, sp);
          this.evaluate();
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }
  }

  /**
   * Disable the context engine. Removes listeners to conserve battery.
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

  /**
   * Register a callback to receive suggestions. Each callback is invoked
   * with an object containing a hazard slug, a confidence (0..1) and
   * an array of reasons describing why the suggestion was made.
   */
  onSuggest(fn) {
    this.listeners.push(fn);
  }

  // Evaluate the current readings and emit a suggestion if the score passes a threshold.
  evaluate() {
    const reasons = [];
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
    // Slightly elevate at night time
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) {
      score += 0.05;
      reasons.push('Nachtzeit');
    }
    if (score >= 0.6) {
      this.emit({
        hazard: 'unfall_sofortmassnahmen',
        confidence: Math.min(1, score),
        reason: reasons
      });
    }
  }

  // Notify all registered listeners with a suggestion.
  emit(suggestion) {
    this.listeners.forEach((fn) => fn(suggestion));
  }
}