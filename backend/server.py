import os
import json
import logging
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
import hashlib
import secrets
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pymongo import MongoClient
import requests
import time
_POI_CACHE: dict[str, tuple[float, dict]] = {}
_POI_TTL_SECONDS = 180  # seconds

from typing import List, Dict, Any, Optional
from urllib.parse import quote_plus

# Konfiguration / Umgebungsvariablen
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MONGO_URL = os.getenv("MONGO_URL")
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")

# OpenAI-Client (NEU ab openai>=1.0.0)
try:
    import openai
    if OPENAI_API_KEY:
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
    else:
        client = None
except Exception:
    client = None

# MongoDB
# Optionaler Datenbankname: Wenn keine Datenbank in der URI angegeben ist,
# kann über die Umgebungsvariable MONGO_DB_NAME ein expliziter Name
# gesetzt werden. Da Pymongo keine Punkte oder Doppelpunkte im
# Datenbanknamen erlaubt, prüfen wir den Wert vorsorglich. Falls
# MONGO_DB_NAME ungeeignet ist oder leer bleibt, versuchen wir, den
# Namen aus der URI abzuleiten. Schlägt auch dies fehl, wird eine
# fallback‑Datenbank "test" verwendet.
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME") or ''
mongo = MongoClient(MONGO_URL)
db = None
try:
    # Wenn ein Name gesetzt ist und nur zulässige Zeichen enthält, verwende ihn direkt.
    if MONGO_DB_NAME and all(ch not in MONGO_DB_NAME for ch in ":/."):
        db = mongo[MONGO_DB_NAME]
except Exception:
    db = None
if db is None:
    # Versuche, den Datenbanknamen aus der URI zu extrahieren
    try:
        from urllib.parse import urlparse
        parsed = urlparse(MONGO_URL)
        path = (parsed.path or '').lstrip('/')
        if path and all(ch not in path for ch in ":/."):
            db = mongo[path]
    except Exception:
        db = None
if db is None:
    # Fallback auf Standard‑Datenbank "test"
    db = mongo['test']

# Referenz auf die Benutzer‑Collection.  Diese wird lazily
# angelegt, wenn sie noch nicht existiert.  Wir verwenden eine
# separate Collection, um Benutzer über ein Skript (init_users)
# verwalten zu können.  Wenn sie nicht existiert, wird sie von
# MongoDB automatisch erstellt.
users_collection = db.get_collection("users")

# FastAPI App
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger("server")

# Einfache Benutzerdatenbank.  Für eine produktive Umgebung sollten
# Passwörter natürlich nicht im Klartext gespeichert werden.  Hier
# nutzen wir einen SHA‑256‑Hash zur Veranschaulichung.  In einer
# echten Anwendung wäre BCrypt oder Argon2 sowie ein Salt zu
# bevorzugen.
#
# Beispiel: Das Passwort "passwort123" (deutscher Sprachgebrauch) wurde
# mit SHA‑256 gehasht.  Du kannst neue Benutzer hinzufügen, indem du
# das Passwort entsprechend verschlüsselst:
#    hashlib.sha256(pw.encode()).hexdigest()
# Achtung: In der ursprünglichen Version war die Hash‑Summe mit
# "password123" statt "passwort123" erstellt, was zu Verwirrungen
# führen konnte.  Hier wird der Hash für "passwort123" verwendet.
USERS: dict[str, str] = {
    "admin": "55789e79eca2f9a1e0786388b869f34f28a64ccbc37eb85ceeb031fd9677e06e"  # sha256("passwort123")
}

class LoginRequest(BaseModel):
    username: str
    password: str

# Lade Metadaten über Gefahren (Name, Beschreibung, Synonyme, erlaubte Aufenthaltsorte)
try:
    with open(os.path.join("data", "hazards_meta.json"), encoding="utf-8") as f:
        HAZARD_META = json.load(f)
except Exception:
    HAZARD_META = {}

# ------------------------------------------------------------
# Hilfsfunktionen und Endpunkte für Points of Interest (POIs)
# ------------------------------------------------------------

# Bounding‑Boxen für bekannte Städte (MinLat, MinLon, MaxLat, MaxLon)
CITY_BBOXES: dict[str, tuple[float, float, float, float]] = {
    "berlin": (52.3383, 13.0884, 52.6755, 13.7611),
    # Erweitertes Bounding‑Box für München/Großraum: deckt auch Vororte ab
    "muenchen": (47.90, 11.20, 48.40, 11.80)
}

def build_overpass_query(min_lat: float, min_lon: float, max_lat: float, max_lon: float, types: Optional[List[str]] = None) -> str:
    """
    Erstellt eine Overpass‑Query innerhalb einer Bounding‑Box. Standardmäßig
    werden Krankenhäuser, Polizeiwachen, Feuerwachen, Apotheken,
    Notunterkünfte und ÖPNV‑Stationen abgefragt.  Wenn eine Liste
    `types` übergeben wird, werden nur die entsprechenden Kategorien in
    die Abfrage aufgenommen.  Folgende Schlüssel werden unterstützt:

    - hospital, police, fire_station, pharmacy, shelter
    - station (ersetzt railway=station und public_transport=station)
    - doctors, clinic, veterinary, social_facility, toilets
    """
    # Definiere Mapping von Typen zu Overpass-Teilen
    default_types = [
        "hospital", "police", "fire_station", "pharmacy", "shelter", "station"
    ]
    query_types = types or default_types
    lines = []
    for t in query_types:
        t = t.strip().lower()
        if t == "station":
            lines.append(f'  node["railway"="station"]({min_lat},{min_lon},{max_lat},{max_lon});')
            lines.append(f'  node["public_transport"="station"]({min_lat},{min_lon},{max_lat},{max_lon});')
        elif t in {"hospital", "police", "fire_station", "pharmacy", "shelter", "doctors", "clinic", "veterinary", "social_facility", "toilets"}:
            lines.append(f'  node["amenity"="{t}"]({min_lat},{min_lon},{max_lat},{max_lon});')
        else:
            # Fallback: allgemeiner amenity‑Typ
            lines.append(f'  node["amenity"="{t}"]({min_lat},{min_lon},{max_lat},{max_lon});')
    body = "\n".join(lines)
    query = f"""
    [out:json][timeout:25];
    (
    {body}
    );
    out center;
    """.strip()
    return query

def fetch_pois_overpass(city: Optional[str] = None, lat: Optional[float] = None, lon: Optional[float] = None, radius: int = 2000, types: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """
    Ruft POIs aus der Overpass‑API ab.  Wenn eine Stadt angegeben ist und eine
    bekannte Bounding‑Box existiert, wird diese genutzt.  Andernfalls
    berechnet die Funktion eine Bounding‑Box um die gegebene Position mit
    einem einfachen Puffer.  Das Ergebnis ist eine Liste von POIs mit
    Name, Typ und Koordinaten.
    """
    # Bestimme Bounding‑Box
    if city and city in CITY_BBOXES:
        min_lat, min_lon, max_lat, max_lon = CITY_BBOXES[city]
    elif lat is not None and lon is not None:
        # 0.02 Grad ~ 2 km – einfache Näherung. Für größere Flächen sollte
        # der Puffer angepasst werden.
        delta = 0.02
        min_lat, min_lon, max_lat, max_lon = lat - delta, lon - delta, lat + delta, lon + delta
    else:
        raise HTTPException(status_code=400, detail="Entweder city oder lat/lon muss angegeben werden")
    query = build_overpass_query(min_lat, min_lon, max_lat, max_lon, types=types)
    url = "https://overpass-api.de/api/interpreter"
    try:
        resp = requests.post(url, data=query, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.error(f"Fehler bei Overpass-Abfrage: {e}")
        raise HTTPException(status_code=500, detail="Fehler bei der Overpass-Abfrage")
    pois: List[Dict[str, Any]] = []
    for element in data.get("elements", []):
        tags = element.get("tags", {})
        name = tags.get("name")
        # Ignoriere Elemente ohne Namen
        if not name:
            continue
        # Versuche den Typ anhand der Tags zu bestimmen
        poi_type = None
        if tags.get("amenity") in {"hospital", "police", "fire_station", "pharmacy", "shelter"}:
            poi_type = tags.get("amenity")
        elif tags.get("railway") == "station" or tags.get("public_transport") == "station":
            poi_type = "station"
        else:
            poi_type = tags.get("amenity") or tags.get("public_transport")
        lat_el = element.get("lat") or element.get("center", {}).get("lat")
        lon_el = element.get("lon") or element.get("center", {}).get("lon")
        pois.append({
            "name": name,
            "type": poi_type,
            "lat": lat_el,
            "lng": lon_el,
            "address": tags.get("addr:full") or tags.get("addr:street"),
        })
    return pois

def fetch_place_details(place_id: str, fields: str = "name,formatted_address,formatted_phone_number,current_opening_hours,opening_hours,international_phone_number,website") -> Optional[Dict[str, Any]]:
    """
    Ruft Details zu einem Ort über die Google Places API ab.  Dieser Helper
    verwendet den in der Umgebungsvariablen gespeicherten API‑Key.  Wenn kein
    Schlüssel vorhanden ist oder ein Fehler auftritt, wird None zurückgegeben.
    """
    key = GOOGLE_PLACES_API_KEY
    if not key:
        return None
    params = {
        "place_id": place_id,
        "fields": fields,
        "key": key,
    }
    try:
        resp = requests.get("https://maps.googleapis.com/maps/api/place/details/json", params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if data.get("status") != "OK":
            return None
        return data.get("result")
    except Exception as e:
        logger.error(f"Fehler bei Google Place Details: {e}")
        return None

@app.get("/api/pois")
def get_pois(
    city: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    radius: int = 2000,
    use_google: bool = False,
    types: str | None = None,
):
    """
    Liefert Points of Interest (POIs) für eine Stadt oder Umgebung.  Standardmäßig
    werden die Daten aus der Overpass‑API geladen.  Über den Parameter
    `types` können eine oder mehrere Kategorien (durch Komma getrennt) angegeben
    werden, um die Ergebnisse einzuschränken (z. B. "hospital,police").
    Wenn `use_google=true` und ein Google Places API‑Key vorhanden ist,
    werden zusätzliche Details über die Google‑API abgerufen (z. B.
    Öffnungszeiten und Telefonnummern).  Query‑Parameter:

    - `city`: Name der Stadt (berlin, muenchen, …).  Hat Vorrang gegenüber lat/lon.
    - `lat`, `lon`: Koordinaten für die Suche, falls keine Stadt angegeben ist.
    - `radius`: Suchradius in Metern (nur relevant für Google Places).  Overpass
      nutzt Bounding‑Boxen, die aus city oder lat/lon abgeleitet werden.
    - `use_google`: Wenn true, werden zusätzlich Informationen aus Google
      abgefragt.  Beachte, dass dies API‑Kosten verursachen kann.
    - `types`: Kommagetrennte Liste von amenity‑Typen, um die Abfrage
      einzuschränken (z. B. "hospital,police,station").
    """
    
    # --- simple in-memory cache to reduce Overpass load ---
    # Build a cache key using rounded coords, radius and types
    try:
        key_parts = [
            f"{round(lat or 0.0, 3)}",
            f"{round(lon or 0.0, 3)}",
            f"r{int(radius)}",
            f"t{','.join(type_list or [])}"
        ]
        cache_key = "|".join(key_parts)
        now = time.time()
        cached = _POI_CACHE.get(cache_key)
        if cached and now - cached[0] < _POI_TTL_SECONDS:
            return cached[1]
    except Exception:
        cache_key = None
    # ------------------------------------------------------
# Wandle types-String in Liste um
    type_list: Optional[List[str]] = None
    if types:
        type_list = [t.strip() for t in types.split(",") if t.strip()]
    # Hole POIs aus Overpass mit optionaler Filterliste
    pois = fetch_pois_overpass(city=city, lat=lat, lon=lon, radius=radius, types=type_list)
    # Optional: hol zusätzliche Details via Google Places
    if use_google and GOOGLE_PLACES_API_KEY:
        for poi in pois:
            place_id = poi.get("google_place_id")
            if place_id:
                details = fetch_place_details(place_id)
                if details:
                    poi["phone"] = details.get("formatted_phone_number") or details.get("international_phone_number")
                    hours = details.get("current_opening_hours") or details.get("opening_hours")
                    if hours:
                        poi["opening_hours"] = hours
                    poi["website"] = details.get("website")
    result = {"pois": pois}
    if 'cache_key' in locals() and cache_key:
        _POI_CACHE[cache_key] = (time.time(), result)
    return result

@app.get("/")
def root():
    return {"status": "ok", "message": "API running"}

@app.get("/api/hazards")
def list_hazards():
    """
    Liste aller verfügbaren Gefahren ermitteln.

    Statt die Slugs aus den Dateinamen der Entscheidungsbäume abzuleiten,
    geben wir die Schlüssel aus den Metadaten zurück.  Dadurch wird
    gesteuert, welche Kategorien dem Frontend angezeigt werden.  Alte
    Entscheidungsbäume können weiterhin existieren, werden hier jedoch
    ausgeblendet, wenn sie nicht in ``hazards_meta.json`` definiert sind.
    """
    hazards = set(HAZARD_META.keys())
    return {"hazards": sorted(hazards)}

# Endpunkt, um die Metadaten aller Gefahren abzurufen.  Die Struktur ist
# ein Dictionary, dessen Schlüssel die Slugs sind und deren Werte Name,
# Beschreibungen, Synonyme und gültige Aufenthaltsorte enthalten.  Dieser
# Endpunkt erlaubt dem Frontend, übersetzte Namen und Kurzbeschreibungen
# sowie Suchsynonyme anzuzeigen.
@app.get("/api/hazards_meta")
def get_hazards_meta():
    return HAZARD_META

@app.get("/api/decision-tree/{slug}")
def get_decision_tree(slug: str, request: Request, lang: str | None = None):
    """
    Liefert den Entscheidungsbaum für die angegebene Gefahr.  Über den
    optionale Query‑Parameter ``lang`` kann die Sprache des Baums
    bestimmt werden (de, en, fr, es, it).  Wenn die angeforderte
    Sprachvariante nicht vorhanden ist, wird auf Deutsch zurückgegriffen.
    """
    # Sprache aus Querystring entnehmen.  Wenn FastAPI lang=None erhält,
    # übernimmt es den Parameter automatisch.  Wir werten ihn hier
    # zusätzlich aus, da ältere Clients ``?lang`` nur im request haben.
    q = request.query_params.get("lang")
    language = lang or q or "de"
    # Datei gemäß Sprache bestimmen
    base_path = os.path.join("data", "decision-trees")
    candidate = os.path.join(base_path, f"{slug}_decision_tree.{language}.json")
    # Fallback auf deutsch, falls Sprache nicht existiert
    if not os.path.exists(candidate):
        candidate = os.path.join(base_path, f"{slug}_decision_tree.de.json")
    if not os.path.exists(candidate):
        raise HTTPException(status_code=404, detail="Decision Tree not found")
    with open(candidate, encoding="utf-8") as f:
        tree = json.load(f)
    return tree

@app.get("/api/hazards/{slug}")
def get_hazard_details(slug: str, request: Request):
    """
    Kombinierter Endpunkt, der den Entscheidungsbaum für eine Gefahr
    sowie eine Kurzbeschreibung liefert.  Die Sprache kann über den
    Query‑Parameter ``lang`` gesteuert werden.  Optional kann das
    ``mode`` (``simple`` vs. ``full``) angegeben werden – dieses wird
    derzeit nicht weiter ausgewertet und ist für zukünftige Erweiterungen
    reserviert.  Statt eines dynamisch generierten KI‑Textes wird eine
    hinterlegte Kurzbeschreibung aus den Metadaten zurückgegeben.
    """
    lang = request.query_params.get("lang", "de")
    mode = request.query_params.get("mode", "full")
    # Lade den Entscheidungsbaum in der gewünschten Sprache
    base_path = os.path.join("data", "decision-trees")
    candidate = os.path.join(base_path, f"{slug}_decision_tree.{lang}.json")
    if not os.path.exists(candidate):
        candidate = os.path.join(base_path, f"{slug}_decision_tree.de.json")
    if not os.path.exists(candidate):
        raise HTTPException(status_code=404, detail="Decision Tree not found")
    try:
        with open(candidate, encoding="utf-8") as f:
            tree = json.load(f)
    except Exception as e:
        logger.error(f"Error loading decision tree for {slug}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error loading decision tree")
    # Hole Kurzbeschreibung aus Metadaten, falls vorhanden
    summary = None
    meta = HAZARD_META.get(slug)
    if meta and isinstance(meta.get("description"), dict):
        summary = meta["description"].get(lang) or meta["description"].get("de")
    if not summary:
        # Fallback: generiere einen einfachen, statischen Text
        summary = f"Hinweis: Für die Gefahr '{slug}' liegt keine Kurzbeschreibung vor."
    return {
        "slug": slug,
        "tree": tree,
        "summary": summary
    }

@app.post("/api/chat")
async def chat_endpoint(request: Request):
    """
    Endpunkt für den Chat‑Assistenten.

    Er erwartet eine Liste von Nachrichten unter dem Schlüssel "messages".
    Zur Abwärtskompatibilität werden auch "history" und "message"
    unterstützt: Falls ein einzelner Nutzertext übergeben wird, wird er an
    die Nachrichtenliste angehängt.  Die Antwort wird im Feld
    "content" zurückgegeben, sodass Frontends sich nicht auf
    unterschiedliche Feldnamen einstellen müssen.
    """
    data = await request.json()
    # Versuche, eine vollständige Nachrichtenliste zu extrahieren
    messages = data.get("messages") or data.get("history") or []
    # Einzelne Nutzerfrage berücksichtigen
    user_message = data.get("message")
    if user_message:
        messages = list(messages) + [{"role": "user", "content": user_message}]

    # Kontextinformationen sammeln
    slug = data.get("slug")
    context_info = data.get("context")  # z. B. 'indoor', 'outdoor', 'car' oder komplexerer Kontext

    # Baue einen System‑Prompt, der die aktuelle Gefahr, eine kurze Handlungsempfehlung und optional den Kontext beschreibt.
    system_parts: list[str] = []
    if slug:
        # Gefahr benennen
        system_parts.append(f"Gefahrensituation: {slug}")
        # Füge eine kompakte Handlungsempfehlung aus den Metadaten hinzu, falls verfügbar.  
        # Dies hilft GPT, relevantere Antworten zu generieren.
        try:
            meta = HAZARD_META.get(slug)
            if meta and isinstance(meta.get("description"), dict):
                # Nutze bevorzugt die deutsche Beschreibung; fallback auf erste vorhandene Sprache
                desc = meta["description"].get("de") or next(iter(meta["description"].values()), None)
                if desc:
                    # Kürze den Text leicht, indem Zeilenumbrüche entfernt werden
                    short_desc = " ".join(str(desc).split())
                    system_parts.append(f"Handlungsempfehlung: {short_desc}")
        except Exception:
            pass
    if context_info:
        system_parts.append(f"Kontext: {context_info}")
    # Wenn Systemnachrichten vorhanden sind, setze sie an den Anfang der Unterhaltung
    if system_parts:
        system_prompt = " | ".join(system_parts)
        messages = ([{"role": "system", "content": system_prompt}] + list(messages))
    try:
        if not client:
            return JSONResponse(status_code=500, content={"error": "OpenAI-Key nicht gesetzt."})
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=300,
            temperature=0.3,
        )
        answer = response.choices[0].message.content.strip()
        return {"content": answer}
    except Exception as e:
        logger.error(f"Fehler bei GPT‑Chat: {str(e)}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/api/health")
def health_check():
    status = {
        "api": "ok",
        "db": False,
        "openai": bool(client),
    }
    try:
        status["db"] = db.command("ping")["ok"] == 1
    except Exception:
        status["db"] = False
    return status


# Login‑Endpoint.  Erwartet einen Benutzernamen und ein Passwort.
# Prüft, ob der Benutzer existiert und das Passwort korrekt ist.  Bei
# Erfolg wird ein zufälliges Token zurückgegeben.  Dieses Token
# besitzt in dieser Beispielimplementierung keine weitere Bedeutung
# (kein JWT).  In einer realen Anwendung solltest du das Token
# speichern und bei nachfolgenden Anfragen überprüfen.
@app.post("/api/login")
async def login(req: LoginRequest):
    username = req.username
    password = req.password
    # Hash des eingegebenen Passworts
    pw_hash = hashlib.sha256(password.encode()).hexdigest()
    # Versuche zuerst, den Benutzer aus der Datenbank zu laden.  Die
    # Benutzer‑Collection kann über init_users.py gefüllt werden.  Fallback
    # auf das statische USERS‑Dict, das weiterhin Admin‑Zugänge enthalten
    # kann.
    expected_hash = None
    try:
        # Versuche den Benutzer anhand von "username" oder "email" zu finden.
        # Einige Clients verwenden die E‑Mail als Benutzernamen.  Um beide
        # Varianten zu unterstützen, sucht diese Abfrage gleichzeitig in den
        # Feldern "username" und "email".  Wenn ein Dokument gefunden
        # wird, wird der in der Datenbank gespeicherte Passwort‑Hash
        # verwendet.
        user_doc = users_collection.find_one({"$or": [{"username": username}, {"email": username}]})
        if user_doc:
            expected_hash = user_doc.get("password_hash")
    except Exception:
        # Fehlende Datenbank oder Collection
        expected_hash = None
    # Wenn kein Datensatz gefunden wurde, prüfe das statische Dict
    if expected_hash is None:
        expected_hash = USERS.get(username)
    # Prüfe den Hash
    if expected_hash is None or expected_hash != pw_hash:
        raise HTTPException(status_code=401, detail="Ungültiger Benutzername oder Passwort")
    # Generiere ein zufälliges Token
    token = secrets.token_hex(16)
    return {"token": token}
# Beispiel für Custom-Endpunkt: User-Feedback (optional)
@app.post("/api/feedback")
async def save_feedback(request: Request):
    data = await request.json()
    try:
        db.feedback.insert_one(data)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Fehler beim Speichern von Feedback: {str(e)}")
        return JSONResponse(status_code=500, content={"error": str(e)})

# Beispiel für einen neuen Decision-Tree-Endpunkt:
@app.get("/api/all-trees")
def all_decision_trees():
    hazard_dir = "data/decision-trees"
    trees = []
    for fname in os.listdir(hazard_dir):
        if fname.endswith(".json"):
            with open(os.path.join(hazard_dir, fname), encoding="utf-8") as f:
                trees.append(json.load(f))
    return trees

# In-Memory Speicher für Telemetriedaten.  In einer produktiven Umgebung
# sollten diese Daten beispielsweise an einen dedizierten Log-Service
# weitergeleitet oder in einer Datenbank gespeichert werden.  Es werden
# ausschließlich anonyme Felder gespeichert (z. B. slug, verwendete
# Schritt-IDs, Zeitstempel, optional online/offline), keine Freitexte.
_TELEMETRY: list[dict] = []

@app.post("/api/telemetry")
async def save_telemetry(request: Request):
    """
    Speichert anonymisierte Telemetriedaten.  Der Body kann beliebige
    strukturierte Felder enthalten.  Dieses Beispiel speichert die Daten
    lediglich im Arbeitsspeicher.  In einer produktiven Anwendung sollte
    hier eine persistente Speicherung oder Weiterleitung an einen
    Telemetrie-Endpunkt stattfinden.
    """
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Ungültiger JSON-Body")
    # Füge einen Zeitstempel hinzu, falls nicht vorhanden
    if isinstance(data, dict) and "timestamp" not in data:
        data["timestamp"] = int(time.time() * 1000)
    _TELEMETRY.append(data)
    return {"status": "ok"}

@app.post("/api/auto-navigate")
async def auto_navigate(request: Request):
    """
    Versucht anhand einer frei formulierten Beschreibung die passende
    Gefahrenkategorie (Slug) zu ermitteln.  Der Request-Body sollte
    ein Feld ``description`` enthalten.  Die Heuristik vergleicht das
    beschriebene Szenario mit den Namen und Synonymen aus
    ``hazards_meta.json``.  Wenn keine Kategorie eindeutig
    identifiziert werden kann, wird 'unklare_gefahr' zurückgegeben.
    """
    data = await request.json()
    description = (data.get("description") or "").lower()
    if not description:
        raise HTTPException(status_code=400, detail="'description' erforderlich")
    # Sammle mögliche Treffer nach Anzahl der Vorkommen von Begriffen
    best_slug = None
    best_score = 0
    for slug, meta in HAZARD_META.items():
        # Sammle alle Begriffe: alle Namensvarianten und Synonyme aller Sprachen
        terms: list[str] = []
        name_dict = meta.get("name") or {}
        for n in name_dict.values():
            terms.append(str(n).lower())
        synonyms_dict = meta.get("synonyms") or {}
        for syn_list in synonyms_dict.values():
            for s in syn_list:
                terms.append(str(s).lower())
        # Zähle Vorkommen der Begriffe in der Beschreibung
        score = sum(1 for term in terms if term and term in description)
        if score > best_score:
            best_score = score
            best_slug = slug
    if not best_slug:
        best_slug = "unklare_gefahr"
    return {"slug": best_slug}

@app.api_route("/api/grounded-answer-stream", methods=["GET", "POST"])
async def grounded_answer_stream(request: Request):
    """
    Streamt eine antwort über Server-Sent-Events (SSE).  Die Struktur des
    Requests entspricht dem regulären ``grounded-answer``-Endpunkt.
    
    Dieser Endpunkt nutzt das OpenAI-Streaming-API (falls verfügbar), um
    das Sprachmodell Token für Token zu übertragen.  Zusätzliche
    Metadaten wie ``used_nodes`` werden nach Abschluss in einem eigenen
    SSE-Event mit dem Typ ``meta`` gesendet.
    """
    # Erlaube sowohl POST mit JSON-Body als auch GET mit Query-Parametern.  Für GET werden
    # Parameter aus request.query_params entnommen.
    slug = None
    question = None
    lang = "de"
    context_info = None
    if request.method == "POST":
        try:
            data = await request.json()
        except Exception:
            data = {}
        slug = data.get("slug")
        question = data.get("question")
        lang = data.get("lang") or "de"
        context_info = data.get("context")
    else:
        # GET: Parameter aus URL lesen
        params = request.query_params
        slug = params.get("slug")
        question = params.get("question")
        lang = params.get("lang") or "de"
        context_info = params.get("context")
    if not slug or not question:
        raise HTTPException(status_code=400, detail="slug und question sind erforderlich")
    # Lade Decision-Tree (wie im grounded-answer-Endpunkt)
    base_path = os.path.join("data", "decision-trees")
    candidate = os.path.join(base_path, f"{slug}_decision_tree.{lang}.json")
    if not os.path.exists(candidate):
        candidate = os.path.join(base_path, f"{slug}_decision_tree.de.json")
    if not os.path.exists(candidate):
        raise HTTPException(status_code=404, detail="Decision Tree not found")
    try:
        with open(candidate, encoding="utf-8") as f:
            tree = json.load(f)
    except Exception as e:
        logger.error(f"Fehler beim Laden des Entscheidungsbaums für {slug}: {str(e)}")
        raise HTTPException(status_code=500, detail="Fehler beim Laden des Entscheidungsbaums")
    # Sammle relevante Knoten (erste 5)
    nodes = _collect_tree_nodes(tree)
    relevant = nodes[:5]
    # Baue System-Prompt
    rules = (
        "Antworte ausschließlich basierend auf den bereitgestellten Schritten. "
        "Wenn Information fehlt: 'Nicht im Schema – 112 rufen.' "
        "Form: 1–3 Sätze + 1–3 Bullet-steps. Keine Spekulation."
    )
    context_part = f"\nKontext: {context_info}" if context_info else ""
    steps_lines = "\n".join([f"- {n['id']}: {n['text']}" for n in relevant])
    system_prompt = (
        f"{rules}\n\nGefahr: {slug} [{lang}]" + context_part + f"\nRelevante Schritte:\n{steps_lines}"
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": str(question)},
    ]
    # Wenn kein OpenAI-Client vorhanden ist, verhindere Streaming
    if not client:
        raise HTTPException(status_code=500, detail="OpenAI-Key nicht gesetzt.")
    # Streaming-Antwort generator
    def sse_event_generator():
        try:
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages,
                max_tokens=300,
                temperature=0.2,
                stream=True,
            )
            full_text = ""
            for chunk in response:
                delta = chunk.choices[0].delta
                content = getattr(delta, "content", None)
                if content:
                    full_text += content
                    # Sende das Token im SSE-Format
                    yield f"data: {content}\n\n"
            # Nach Abschluss sende ein Meta-Event mit used_nodes
            meta = json.dumps({"used_nodes": [n["id"] for n in relevant]})
            yield f"event: meta\ndata: {meta}\n\n"
        except Exception as e:
            logger.error(f"Fehler bei Streaming-GPT ({slug}): {str(e)}")
            # Sende ein Fehler-Ereignis
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
    return StreamingResponse(sse_event_generator(), media_type="text/event-stream")

# ------------------------------------------------------------
# Grounded-Answer Endpunkt (Phase 0/1)
# ------------------------------------------------------------

def _collect_tree_nodes(tree: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Flatten a decision tree into a list of nodes with id and text.  This helper
    iterates over all keys in the JSON structure and extracts the node id and
    associated text (or text_simplified).  Whitespace is normalized.  The
    returned list preserves the order of discovery; this simple heuristic
    prefers the root and early nodes as most relevant.
    """
    nodes: List[Dict[str, str]] = []

    def add_node(node: Dict[str, Any], key: str | None = None) -> None:
        if not isinstance(node, dict):
            return
        # Determine the node id: prefer explicit id field, otherwise key
        node_id = node.get("id") or key
        # Skip if id is missing
        if not node_id:
            return
        # Get text; fall back to text_simplified
        text = node.get("text") or node.get("text_simplified") or ""
        # Normalize whitespace
        normalized = " ".join(str(text).split())
        nodes.append({"id": str(node_id), "text": normalized})

    # If the tree has a root node, add it first
    if isinstance(tree, dict) and "root" in tree:
        root_node = tree.get("root")
        add_node(root_node, "root")
    # Iterate over top-level keys in the tree (excluding "root")
    if isinstance(tree, dict):
        for key, node in tree.items():
            if key == "root":
                continue
            add_node(node, key)
    return nodes


@app.post("/api/grounded-answer")
async def grounded_answer(request: Request):
    """
    Liefert eine durch Entscheidungsbäume gestützte Antwort auf eine Frage.
    
    Diese Route akzeptiert folgende Felder im JSON-Body:
    - slug: Gefahren-Slug (z. B. "herzstillstand")
    - question: Die Nutzerfrage (erforderlich)
    - lang: Sprachcode (de, en, fr, es, it) – optional, Default "de"
    - context: Optionaler Kontextstring (z. B. Aufenthaltsort oder Persona)

    Der Server lädt den entsprechenden Entscheidungsbaum, extrahiert einige
    relevante Schritte (heuristisch: erste fünf Knoten) und generiert
    anschließend einen System-Prompt.  Die Antwort wird von OpenAI erzeugt.

    Die Antwortstruktur umfasst:
    - answer: Der generierte Text
    - used_nodes: Liste der Knotennamen, die als Kontext dienten
    - risk_level: Momentan statisch "medium"
    - cta: Handlungsempfehlungen (vereinfacht)
    - disclaimer: Haftungsausschluss
    """
    data = await request.json()
    slug = data.get("slug")
    question = data.get("question")
    lang = data.get("lang") or "de"
    context_info = data.get("context")

    if not slug or not question:
        raise HTTPException(status_code=400, detail="slug und question sind erforderlich")
    # Lade den Entscheidungsbaum in der gewünschten Sprache (Fallback auf Deutsch)
    base_path = os.path.join("data", "decision-trees")
    candidate = os.path.join(base_path, f"{slug}_decision_tree.{lang}.json")
    if not os.path.exists(candidate):
        candidate = os.path.join(base_path, f"{slug}_decision_tree.de.json")
    if not os.path.exists(candidate):
        raise HTTPException(status_code=404, detail="Decision Tree not found")
    try:
        with open(candidate, encoding="utf-8") as f:
            tree = json.load(f)
    except Exception as e:
        logger.error(f"Fehler beim Laden des Entscheidungsbaums für {slug}: {str(e)}")
        raise HTTPException(status_code=500, detail="Fehler beim Laden des Entscheidungsbaums")
    # Extrahiere Knoten (vereinfachte Relevanzheuristik: nimm die ersten 5)
    nodes = _collect_tree_nodes(tree)
    relevant = nodes[:5]
    # Baue Prompt-Teile
    rules = (
        "Antworte ausschließlich basierend auf den bereitgestellten Schritten. "
        "Wenn Information fehlt: 'Nicht im Schema – 112 rufen.' "
        "Form: 1–3 Sätze + 1–3 Bullet-steps. Keine Spekulation."
    )
    context_part = f"\nKontext: {context_info}" if context_info else ""
    steps_lines = "\n".join([f"- {n['id']}: {n['text']}" for n in relevant])
    system_prompt = (
        f"{rules}\n\nGefahr: {slug} [{lang}]" + context_part + f"\nRelevante Schritte:\n{steps_lines}"
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": str(question)},
    ]
    # Sicherheitsprüfung: Kein OpenAI-Client vorhanden
    if not client:
        return JSONResponse(status_code=500, content={"error": "OpenAI-Key nicht gesetzt."})
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=300,
            temperature=0.2,
        )
        answer = response.choices[0].message.content.strip()
        return {
            "answer": answer,
            "used_nodes": [n["id"] for n in relevant],
            "risk_level": "medium",
            "cta": ["112 rufen"],
            "disclaimer": "Kein Ersatz für professionelle Hilfe.",
        }
    except Exception as e:
        logger.error(f"Fehler bei GPT-Chat (grounded-answer) für {slug}: {str(e)}")
        return JSONResponse(status_code=500, content={"error": str(e)})

# Externe Warnmeldungen (z. B. NINA/Katwarn)
#
# Diese Route fungiert als Proxy für das öffentliche Warnsystem des Bundes.
# Die direkte Abfrage im Frontend scheitert meist an CORS‑Restriktionen.  Um
# dennoch aktuelle Warnmeldungen zu erhalten, ruft der Server die Daten
# serverseitig ab und liefert sie an den Client.  Die URL und Struktur
# können sich ändern; bei Fehlern wird eine leere Liste zurückgegeben.

@app.get("/api/warnings")
def get_external_warnings():
    import requests
    url = "https://warnung.bund.de/api31/mowas/mapData.json"
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            # Wenn der Inhalt JSON ist, gib ihn direkt zurück
            return resp.json()
        else:
            logger.warning(f"Warn-API Antwortcode {resp.status_code}")
    except Exception as e:
        logger.error(f"Fehler beim Abrufen von Warnmeldungen: {e}")
    return {"warnings": []}

@app.get("/api/route")
def get_route(
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float,
    profile: str = "foot",
):
    """
    Liefert eine Route zwischen zwei Koordinaten mithilfe des
    Open Source Routing Machine (OSRM) öffentlichen Endpunkts.
    Unterstützte Profile sind ``foot`` (zu Fuß) und ``car``
    (Fahrzeug). Als Ergebnis werden Distanz (Meter), Dauer (Sekunden)
    und die Geometrie als Liste von [lat, lon]-Koordinaten
    zurückgegeben. Wenn ein Fehler auftritt, wird ein HTTP‑Fehler
    ausgelöst.
    """
    # Valid profiles mapping: foot -> foot, car -> car
    prof = profile.lower()
    if prof not in {"foot", "car"}:
        raise HTTPException(status_code=400, detail="Ungültiges Profil")
    # OSRM erwartet lon,lat Paare
    coords = f"{start_lon},{start_lat};{end_lon},{end_lat}"
    # Baue URL; nutze full overview und GeoJSON Geometrie
    url = f"https://router.project-osrm.org/route/v1/{prof}/{quote_plus(coords)}?overview=full&geometries=geojson"
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") != "Ok" or not data.get("routes"):
            raise Exception("No route returned")
        route = data["routes"][0]
        # GeoJSON geometry: [lon, lat]
        geometry = [
            [lat, lon] for lon, lat in route["geometry"]["coordinates"]
        ]
        return {
            "distance": route.get("distance"),
            "duration": route.get("duration"),
            "geometry": geometry,
        }
    except Exception as e:
        logger.error(f"Fehler beim Abrufen der Route: {e}")
        raise HTTPException(status_code=500, detail="Fehler beim Abrufen der Route")
@app.post("/api/gpt-chat")
async def gpt_chat(request: Request):
    """
    GPT-basierter Chat-Endpunkt für die neue ChatAssistant-Komponente.
    Erwartet: {"messages": [ ... ]} im OpenAI-Chatformat.
    Antwort: {"reply": "Antworttext"}
    """
    if not client:
        raise HTTPException(status_code=503, detail="OpenAI-Client nicht verfügbar")

    try:
        data = await request.json()
        messages = data.get("messages", [])
        if not messages:
            raise HTTPException(status_code=400, detail="Keine Nachrichten übermittelt")

        response = client.chat.completions.create(
            model="gpt-4",
            messages=messages,
            temperature=0.7,
            max_tokens=600
        )

        reply = response.choices[0].message.content.strip()
        return {"reply": reply}

    except Exception as e:
        logger.error(f"Fehler bei /api/gpt-chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))
@app.get("/api/geocode")
def geocode(q: str, limit: int = 5):
    """Proxy für Nominatim-Geocoding (CORS-freundlich)."""
    if not q or len(q) < 2:
        return {"results": []}
    try:
        import requests
        url = "https://nominatim.openstreetmap.org/search"
        params = {"q": q, "format": "json", "addressdetails": 1, "limit": str(limit)}
        headers = {"User-Agent": "akut.jetzt/1.0 (mailto:info@akut.jetzt)"}
        resp = requests.get(url, params=params, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        results = [
            {
                "display_name": item.get("display_name"),
                "lat": float(item.get("lat")),
                "lon": float(item.get("lon"))
            } for item in data if item.get("lat") and item.get("lon")
        ]
        return {"results": results}
    except Exception as e:
        logger.error(f"Geocoding-Fehler: {e}")
        return {"results": []}
