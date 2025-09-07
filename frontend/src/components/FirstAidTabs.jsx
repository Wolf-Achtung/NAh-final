import React, { useState } from 'react';

export default function FirstAidTabs({ items = [] }) {
  const [active, setActive] = useState(0);
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {items.map((it, idx) => (
          <button key={it.title}
            onClick={()=>setActive(idx)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #cfe0ff',
              background: idx===active ? '#1d4ed8' : '#f3f6ff',
              color: idx===active ? '#fff' : '#1d4ed8'
            }}>
            {it.title}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>
        {items[active]?.body}
      </div>
    </div>
  );
}
