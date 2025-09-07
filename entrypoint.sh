#!/bin/sh
set -e

# Falls gewünscht, Datenbank-Seed für Mongo ausführen
# Durch Setzen der Umgebungsvariable RUN_SEED=true beim Deployment werden alle
# vorhandenen Gefahrenlagen per seed_all_hazards.py importiert. Sollte diese
# Datei nicht vorhanden sein, fällt der Seed auf seed_hazards.py zurück, damit
# ältere Versionen weiterhin funktionieren.
if [ "$RUN_SEED" = "true" ]; then
  # Ermitteln, welches Seed‑Script vorhanden ist
  if [ -f /backend/seed_all_hazards.py ]; then
    echo "🚀 Starte seed_all_hazards.py..."
    python /backend/seed_all_hazards.py || echo "⚠️  Seed fehlgeschlagen, aber Deployment läuft weiter"
  elif [ -f /backend/seed_hazards.py ]; then
    echo "🚀 Starte seed_hazards.py..."
    python /backend/seed_hazards.py || echo "⚠️  Seed fehlgeschlagen, aber Deployment läuft weiter"
  else
    echo "❌ Kein Seed‑Script gefunden (weder seed_all_hazards.py noch seed_hazards.py)"
  fi
fi

# Starte den FastAPI-Backend-Service
cd /backend || { echo "Backend directory not found"; exit 1; }
echo "🚀 Starte FastAPI backend..."
uvicorn server:app --host 0.0.0.0 --port 8001 &
BACKEND_PID=$!

echo "⏳ Warte auf Backend-Start..."
sleep 30

if ! kill -0 $BACKEND_PID 2>/dev/null; then
  echo "❌ Backend startete nicht korrekt – breche ab"
  exit 1
fi

# Starte Nginx
echo "🌐 Starte Nginx..."
nginx -g 'daemon off;' &
NGINX_PID=$!

# Beende beide Prozesse bei Abbruch
trap 'kill $BACKEND_PID $NGINX_PID; exit 0' SIGTERM SIGINT

# Halte Container aktiv, solange beide Prozesse laufen
while kill -0 $BACKEND_PID 2>/dev/null && kill -0 $NGINX_PID 2>/dev/null; do
  sleep 1
done

# Wenn einer stirbt, beende den anderen auch
if ! kill -0 $BACKEND_PID 2>/dev/null; then
  echo "⚠️  Nginx beendet – stoppe Backend"
  kill $BACKEND_PID
else
  echo "⚠️  Backend beendet – stoppe Nginx"
  kill $NGINX_PID
fi

exit 1
