/*
 * ESLint rule disable for react-hooks/exhaustive-deps
 *
 * The project currently does not have the optional plugin
 * `eslint-plugin-react-hooks` installed in production. When
 * building on environments that strictly enforce ESLint, the
 * missing rule causes compilation to fail. Disabling it here
 * avoids referencing an undefined rule. Hooks dependencies
 * are still handled with care via manual comments within the
 * component effects.
 */
// Hinweis: Die Regel "react-hooks/exhaustive-deps" ist in diesem Projekt
// nicht verfügbar, weil das optionale Plugin `eslint-plugin-react-hooks`
// nicht installiert ist. Wird eine `eslint-disable`‑Direktive für diese
// Regel angegeben, schlägt der Build fehl. Daher entfernen wir die
// entsprechende Direktive komplett und verlassen uns auf sorgfältige
// manuelle Abhängigkeitsverwaltung in den Hooks.

import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import AddressSearch from './AddressSearch';


// Configure default Leaflet marker icons
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

/*
 * OfflineMap – zeigt eine Karte mit nahegelegenen Hilfestellen (POIs).
 *
 * Props:
 * - city: optional Name der Stadt ("berlin" oder "muenchen"). Wird zur
 *   Bestimmung der Bounding‑Box und als Fallback für die Anzeige genutzt.
 * - types: optionale Liste von Kategorien (amenity‑Typen) zur Filterung der
 *   POIs (z. B. ['hospital','police','shelter']).
 *
 * Die Komponente versucht zunächst, die aktuelle Position des Nutzers
 * zu bestimmen. Basierend darauf werden die POIs vom Backend geladen
 * (wenn REACT_APP_BACKEND_URL gesetzt ist) oder aus lokalen JSON‑Dateien
 * (pois.berlin.json oder pois.muenchen.json) geladen. Zusätzlich kann
 * der Nutzer für jeden POI eine Route abrufen – hierfür wird über das
 * Backend der öffentliche OSRM‑Server verwendet.
 */
const OfflineMap = ({ city: cityProp = 'berlin', types = [], limit = 6, autoRoute = false }) => {
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userPos, setUserPos] = useState(null);
  const [activeCity, setActiveCity] = useState(cityProp);
  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState(null);

  // Grobe Erkennung der Stadt anhand der Koordinaten
  const guessCityFromCoords = (lat, lon) => {
    // Berlin Bounding‑Box
    const isBerlin = lat >= 52.3383 && lat <= 52.6755 && lon >= 13.0884 && lon <= 13.7611;
    const isMunich = lat >= 48.0610 && lat <= 48.2485 && lon >= 11.3600 && lon <= 11.7229;
    if (isBerlin) return 'berlin';
    if (isMunich) return 'muenchen';
    return null;
  };

  // Berechne Distanz zwischen zwei Punkten (Haversine)
  const haversine = (a, b) => {
    const toRad = (deg) => deg * (Math.PI / 180);
    const [lat1, lon1] = a;
    const [lat2, lon2] = b;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const aa =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(aa));
  };

  
  const [radius, setRadius] = useState(5000); // meters, default 5 km
// Adresse ausgewählt → Karte zentrieren und POIs neu laden
const handleSelectAddress = async ({ lat, lon, label }) => {
  try {
    setUserPos([lat, lon]);
    setLoading(true);
    // loadFromBackend ist weiter unten im Effekt definiert – hier nur triggern:
    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
    const params = new URLSearchParams();
    params.set('lat', lat);
    params.set('lon', lon);
    params.set('radius', String(radius));
    if (Array.isArray(types) && types.length > 0) {
      params.set('types', types.join(','));
    }
    const resp = await fetch(`${backendUrl}/api/pois?${params.toString()}`);
    const data = await resp.json();
    setPois(Array.isArray(data?.pois) ? data.pois : []);
  } finally {
    setLoading(false);
  }
};

// Hol POIs aus Backend oder statischer Datei
  useEffect(() => {
    // Dieser Effekt lädt die POIs entweder aus dem Backend oder aus einer
    // statischen Datei. Er wird nur neu ausgeführt, wenn cityProp oder
    // types sich ändern. Die interne Variable activeCity wird nicht in
    // den Abhängigkeiten verwendet, um unnötige Schleifen zu vermeiden.
    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
    const useBackend = !!backendUrl;

    // Laden aus einer statischen JSON‑Datei (pois.berlin.json etc.)
    const loadFromStatic = async (cityToLoad) => {
      try {
        const res = await fetch(`/pois.${cityToLoad}.json`);
        const data = await res.json();
        setPois(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setPois([]);
      } finally {
        setLoading(false);
      }
    };

    // Laden vom Backend, falls URL vorhanden
    const loadFromBackend = async (lat, lon, cityToLoad) => {
      try {
        const params = new URLSearchParams();
        params.set('radius', String(radius));
        if (lat != null && lon != null) {
          params.set('lat', lat);
          params.set('lon', lon);
        }
        if (cityToLoad) params.set('city', cityToLoad);
        if (Array.isArray(types) && types.length > 0) {
          params.set('types', types.join(','));
        }
        const resp = await fetch(`${backendUrl}/api/pois?${params.toString()}`);
        if (!resp.ok) throw new Error('Fehler beim Abrufen der POIs vom Backend');
        const data = await resp.json();
        if (Array.isArray(data?.pois) && data.pois.length > 0) {
          setPois(data.pois);
        } else {
          // Fallback, wenn keine Einträge zurückgegeben wurden
          await loadFromStatic(cityToLoad);
        }
      } catch (e) {
        console.error(e);
        // Fallback bei Fehler
        await loadFromStatic(cityToLoad);
      } finally {
        setLoading(false);
      }
    };

    const performLoad = async (coords) => {
      // Bestimme die Stadt: Entweder cityProp oder per Schätzung
      let cityToLoad = cityProp || activeCity;
      if (!cityProp && coords) {
        const guessed = guessCityFromCoords(coords.lat, coords.lon);
        if (guessed) {
          cityToLoad = guessed;
          setActiveCity(guessed);
        }
      }
      if (coords) {
        setUserPos([coords.lat, coords.lon]);
      }
      // Starte die Datenabfrage
      if (useBackend) {
        await loadFromBackend(coords?.lat, coords?.lon, cityToLoad);
      } else {
        await loadFromStatic(cityToLoad);
      }
    };

    // Hole Geolocation und lade die Daten
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          performLoad({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        () => {
          performLoad(null);
        },
        { timeout: 5000 }
      );
    } else {
      performLoad(null);
    }
    // Dieser Effekt soll nur bei Änderungen von cityProp oder types ausgelöst werden.
    // Wir verzichten hier auf eine spezifische eslint-Regel, da das entsprechende Plugin
    // nicht in allen Umgebungen verfügbar ist. Ohne Angabe wird die Standardregel angewendet.
  }, [cityProp, types]);
// Bei Radius-Änderung (und optional Types) POIs erneut laden, falls Position bekannt
useEffect(() => {
  const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
  if (!backendUrl || !userPos) return; // nichts tun, wenn kein Backend/Standort

  (async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('lat', String(userPos[0]));
      params.set('lon', String(userPos[1]));
      params.set('radius', String(radius));
      if (Array.isArray(types) && types.length > 0) {
        params.set('types', types.join(','));
      }
      const resp = await fetch(`${backendUrl}/api/pois?${params.toString()}`);
      const data = await resp.json();
      setPois(Array.isArray(data?.pois) ? data.pois : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  })();
}, [radius]); // ggf. ergänzen: , types

  // Sortiere POIs nach Distanz und beschränke auf die angeforderte Anzahl
  const sorted = useMemo(() => {
    if (!Array.isArray(pois)) return [];
    if (!userPos) return pois;
    return [...pois]
      .map((p) => {
        const distKm = haversine(userPos, [p.lat, p.lng]);
        return { ...p, distance_km: distKm };
      })
      .sort((a, b) => a.distance_km - b.distance_km);
  }, [pois, userPos]);

  // Wenn autoRoute aktiviert ist, berechne nach dem Laden automatisch die Route zum nächsten Ziel
  useEffect(() => {
    if (autoRoute && !routeLoading && userPos && sorted && sorted.length > 0) {
      // Nur beim ersten automatischen Routing auslösen
      if (!route || (selectedPoi && selectedPoi.lat !== sorted[0].lat)) {
        handleGetRoute(sorted[0]);
      }
    }
    // Wir deaktivieren die Abhängigkeitsprüfung hier bewusst, weil die Logik des
    // automatischen Routings nicht bei jeder Änderung aller Abhängigkeiten
    // ausgeführt werden soll. Die Regeln von eslint‑plugin‑react‑hooks können
    // in manchen Umgebungen fehlen; daher verzichten wir auf eine spezifische
    // Regelangabe.
  }, [autoRoute, sorted, userPos]);

  // Karte zum neuen Zentrum bewegen
  const Recenter = ({ center }) => {
    const map = useMap();
    useEffect(() => {
      if (center) map.setView(center, 14);
    }, [center]);
    return null;
  };

  // Route abrufen
  const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
  const handleGetRoute = async (poi) => {
    if (!userPos) {
      alert('Standort nicht verfügbar.');
      return;
    }
    setSelectedPoi(poi);
    setRoute(null);
    setRouteLoading(true);
    try {
      const params = new URLSearchParams({
        start_lat: userPos[0],
        start_lon: userPos[1],
        end_lat: poi.lat,
        end_lon: poi.lng,
        profile: 'foot'
      });
      const resp = await fetch(`${backendUrl}/api/route?${params.toString()}`);
      if (resp.ok) {
        const data = await resp.json();
        setRoute(data);
      } else {
        console.error('Fehler beim Abrufen der Route', resp.status);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRouteLoading(false);
    }
  };

  // Bestimme Kartenmittelpunkt
  const mapCenter = userPos || (activeCity === 'muenchen' ? [48.137, 11.575] : [52.52, 13.405]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
      {/* Kartenbereich */}
      <div style={{ height: '60vh', minHeight: 420, background: '#f1f5f9', borderRadius: 8 }}>
        {loading ? (
          <div style={{ padding: 12 }}>Karte wird geladen…</div>
        ) : (
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution="© OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Recenter center={mapCenter} />
            {userPos && (
              <Marker position={userPos}>
                <Popup><strong>Ihr Standort</strong></Popup>
              </Marker>
            )}
            {sorted.slice(0, limit).map((p, idx) => (
              <Marker key={`${p.name}-${idx}`} position={[p.lat, p.lng]}>
                <Popup>
                  <div style={{ maxWidth: 220 }}>
                    <strong>{p.name || 'Ziel'}</strong><br />
                    {p.address && <span>{p.address}<br /></span>}
                    {typeof p.distance_km === 'number' && <span>~ {p.distance_km.toFixed(1)} km<br /></span>}
                    {p.phone && <a href={`tel:${p.phone}`}>{p.phone}</a>}
                    {p.website && (
                      <div><a href={p.website} target="_blank" rel="noreferrer">Website</a></div>
                    )}
                    <button onClick={() => handleGetRoute(p)} style={{ marginTop: 6, padding: '4px 8px', border: '1px solid #0a3a72', background: '#e5e7eb', borderRadius: 4, cursor: 'pointer' }}>
                      Route
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
            {route && Array.isArray(route.geometry) && (
              <Polyline positions={route.geometry.map(([lat, lon]) => [lat, lon])} color="red" weight={4} />
            )}
          </MapContainer>
        )}
        {/* Route-Info */}
        {routeLoading && <div style={{ padding: 8, color: '#0a3a72' }}>Route wird berechnet…</div>}
        {route && !routeLoading && (
          <div style={{ padding: 8, fontSize: 14, color: '#0f172a' }}>
            <strong>Route:</strong> { (route.distance / 1000).toFixed(2) } km,
            {' '}
            { Math.ceil(route.duration / 60) } min
          </div>
        )}
      </div>
      {/* Liste der POIs */}
      <div>
        <h3 style={{ marginTop: 0 }}>Nächstgelegene Ziele</h3>
<AddressSearch
  backendUrl={process.env.REACT_APP_BACKEND_URL || ''}
  onSelect={handleSelectAddress}
/>

        <div style={{margin:'8px 0'}}>
          <label>Suchradius:&nbsp;</label>
          <select value={radius} onChange={e => setRadius(Number(e.target.value))}>
            <option value={2000}>2 km</option>
            <option value={5000}>5 km</option>
            <option value={10000}>10 km</option>
          </select>
        </div>
        {sorted.slice(0, limit).map((p, i) => (
          <div key={i} style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: 8 }}>
            <div style={{ fontWeight: 600 }}>{p.name || 'Ziel'}</div>
            {p.address && <div style={{ color: '#374151' }}>{p.address}</div>}
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {typeof p.distance_km === 'number' ? `${p.distance_km.toFixed(1)} km` : ''}
              {p.type ? ` · ${p.type}` : ''}
            </div>
            <div style={{ marginTop: 6 }}>
              {p.phone && <a href={`tel:${p.phone}`} style={{ marginRight: 8 }}>Anrufen</a>}
              {p.website && <a href={p.website} target="_blank" rel="noreferrer" style={{ marginRight: 8 }}>Website</a>}
              <button onClick={() => handleGetRoute(p)} style={{ padding: '4px 8px', border: '1px solid #0a3a72', background: '#e5e7eb', borderRadius: 4, cursor: 'pointer' }}>
                Route
              </button>
            </div>
          </div>
        ))}
        {!loading && sorted.length === 0 && <div>Keine Ziele gefunden.</div>}
      </div>
    </div>
  );
};

export default OfflineMap;