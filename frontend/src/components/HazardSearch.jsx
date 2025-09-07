import React, { useEffect, useState } from 'react';
import Fuse from 'fuse.js';

const HazardSearch = ({ hazardMeta, lang = 'de', onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [fuse, setFuse] = useState(null);

  useEffect(() => {
    if (hazardMeta && Object.keys(hazardMeta).length > 0) {
      const entries = Object.entries(hazardMeta).map(([slug, meta]) => ({
        slug,
        name: meta.name?.[lang],
        description: meta.description?.[lang],
        synonyms: meta.synonyms?.[lang]?.join(' ') || ''
      }));

      const fuseInstance = new Fuse(entries, {
        keys: ['name', 'description', 'synonyms'],
        threshold: 0.4,
        distance: 100,
        includeScore: true,
      });

      setFuse(fuseInstance);
    }
  }, [hazardMeta, lang]);

  const handleSearch = (e) => {
    const val = e.target.value;
    setQuery(val);

    if (val.trim() && fuse) {
      const found = fuse.search(val).slice(0, 5);
      setResults(found);
    } else {
      setResults([]);
    }
  };

  return (
    <div className="hazard-search">
      <input
        type="text"
        value={query}
        onChange={handleSearch}
        placeholder="Gefahr eingeben… z.B. Stromausfall, Feuer, etc."
      />

      {results.length > 0 && (
        <ul className="hazard-results">
          {results.map((r, idx) => (
            <li key={idx}>
              <button onClick={() => {
                setQuery('');
                setResults([]);
                onSelect(r.item.slug);
              }}>
                {r.item.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default HazardSearch;