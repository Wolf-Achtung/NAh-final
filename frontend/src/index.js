import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Hinweis: In der Vergangenheit wurde hier ein Service Worker registriert, um
// Offline‑Funktionalität zu ermöglichen. Dies führte jedoch dazu, dass
// alte Versionen der Anwendung vom Cache ausgeliefert wurden, weil
// Service‑Worker bis zu 24 Stunden zwischengespeichert werden und sich
// nicht bei jedem Seiten‑Reload aktualisieren【653462592026113†L190-L193】.
// Um sicherzustellen, dass immer die aktuelle Version geladen wird,
// melden wir alle vorhandenen Service‑Worker ab. Sollte später wieder
// Offline‑Support gewünscht sein, kann hier eine Update‑Logik
// implementiert werden, die den Cache invalidiert.
// Registriere unseren eigenen Service Worker (public/sw.js) für Offline‑Support.
// Die Registrierung findet nach dem Laden der Seite statt. Der SW kümmert sich
// selbst um das Pre‑Caching und um die Aktualisierung. Bei Fehlern wird ein
// Hinweis in der Konsole ausgegeben.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service Worker registration failed:', err);
    });
  });
}