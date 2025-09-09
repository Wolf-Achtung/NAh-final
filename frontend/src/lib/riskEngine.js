// src/lib/riskEngine.js
//
// Simple sensor‑fusion risk estimation.  Reads available sensors when
// permitted and computes a risk level (low/medium/high) based on heuristics.
//
// This function is intentionally lightweight and can be extended with
// additional data sources (e.g. heart rate, temperature).

/**
 * Safely read available device sensors (accelerometer).  Returns an object
 * with the values read or null if sensors are unavailable.
 *
 * @returns {Promise<Object>} Sensor data
 */
export async function safeReadSensors() {
  const out = { accel: null, time: Date.now() };
  try {
    if ('DeviceMotionEvent' in window) {
      // In iOS Safari a permission prompt may be required.  We ignore errors.
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        await DeviceMotionEvent.requestPermission().catch(() => {});
      }
      return new Promise(resolve => {
        const handler = ev => {
          // Sum absolute acceleration on all axes.
          const ax = Math.abs(ev.acceleration?.x || 0);
          const ay = Math.abs(ev.acceleration?.y || 0);
          const az = Math.abs(ev.acceleration?.z || 0);
          out.accel = ax + ay + az;
          window.removeEventListener('devicemotion', handler);
          resolve(out);
        };
        window.addEventListener('devicemotion', handler, { once: true });
        // fallback after 500ms if no event fired
        setTimeout(() => {
          window.removeEventListener('devicemotion', handler);
          resolve(out);
        }, 500);
      });
    }
  } catch {
    // ignore sensor errors
  }
  return out;
}

/**
 * Compute a basic risk score from sensor values.
 *
 * @param {Object} sensor Sensor data
 * @returns {{ level: string, score: number }}
 */
export function scoreRisk(sensor) {
  let score = 0;
  if (!sensor) return { level: 'low', score: 0 };
  // Increase risk on high acceleration – possible fall or crash.
  if (sensor.accel && sensor.accel > 25) {
    score += 2;
  }
  const hour = new Date(sensor.time).getHours();
  if (hour < 5 || hour > 22) {
    // Night time increases risk.
    score += 1;
  }
  const level = score >= 3 ? 'high' : (score >= 1 ? 'medium' : 'low');
  return { level, score };
}