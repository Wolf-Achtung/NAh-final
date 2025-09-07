import React, { useState } from 'react';

export default function AddressSearch({ onSelect, backendUrl = '' }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    try {
      const resp = await fetch(`${backendUrl}/api/geocode?q=` + encodeURIComponent(q));
      const data = await resp.json();
      setItems(data?.results || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ margin: '8px 0' }}>
      <form onSubmit={search} style={{ display: 'flex', gap: 8 }}>
        <input
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          placeholder="Adresse oder Ort eingeben"
          style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: 6 }}
        />
        <button type="submit" style={{ padding: '8px 12px' }}>Suchen</button>
      </form>
      {loading && <div>Suche…</div>}
      {!loading && items.length > 0 && (
        <div style={{ marginTop: 6, border: '1px solid #eee', borderRadius: 6 }}>
          {items.slice(0,6).map((it, idx) => (
            <div key={idx}
              onClick={()=> onSelect && onSelect({ lat: it.lat, lon: it.lon, label: it.display_name })}
              style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}>
              {it.display_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
