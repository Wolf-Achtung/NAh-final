import React from 'react';

const API_BASE = "https://nah-final-production.up.railway.app/api";

function AdminPanel() {
  const runSeed = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/seed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" })  // Dummy-Body
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error("Fehler beim Seed: " + text);
      }
      const data = await res.json();
      alert("Seed erfolgreich ausgeführt: " + JSON.stringify(data));
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div style={{ marginTop: "3em" }}>
      <h3>🔧 Admin-Bereich</h3>
      <button onClick={runSeed}>🪄 Seed ausführen</button>
    </div>
  );
}

export default AdminPanel;
