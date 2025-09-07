"""
Integration mit dem Deutschen Wetterdienst (DWD) für Unwetter‑Warnungen.
Dies ist ein Platzhalter, der die Struktur einer möglichen Implementierung
veranschaulicht. In einer realen Anwendung würden hier HTTP‑Anfragen an
offizielle APIs gestellt und die Ergebnisse geparst. Da in dieser Umgebung
kein externer Netzverkehr erlaubt ist, liefert die Funktion Beispielwerte.
"""

from typing import List, Dict, Any


async def get_unwetter_warnings(lat: float, lon: float) -> List[Dict[str, Any]]:
    """Gibt eine Liste fiktiver Unwetterwarnungen für die angegebene Position zurück."""
    # In einer echten Implementierung könnte hier der DWD GeoJSON Feed abgefragt werden,
    # siehe https://warnung.bund.de/mowas/#api
    # Anschließend würden nur Warnungen mit passender Gefahrenlage (z. B. Unwetter) extrahiert.
    return [
        {
            "id": "dummy-001",
            "title": "Sturmwarnung",
            "description": "Es wird starker Wind mit Böen bis 90 km/h erwartet. Meide Wälder und lose Gegenstände.",
            "severity": "Severe",
            "effective": "2025-08-03T20:00:00Z",
            "expires": "2025-08-04T06:00:00Z"
        },
        {
            "id": "dummy-002",
            "title": "Gewitter mit Starkregen",
            "description": "Lokale Gewitter mit Starkregen bis 40 l/m² in kurzer Zeit. Gefahr von Überschwemmungen in Senken.",
            "severity": "Moderate",
            "effective": "2025-08-03T22:00:00Z",
            "expires": "2025-08-04T01:00:00Z"
        }
    ]