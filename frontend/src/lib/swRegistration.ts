// src/lib/swRegistration.ts
//
// Registers the service worker for offline caching. Should be called
// once when the application loads. Errors are logged to the console.
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Service worker registration failed', err);
      });
    });
  }
}