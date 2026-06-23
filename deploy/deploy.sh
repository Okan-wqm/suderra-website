#!/usr/bin/env bash
# Deploy script run on the droplet by GitHub Actions (or manually).
# Assumes it is executed from the project root after `git pull`.
set -euo pipefail

SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
PYBIN="venv/bin/python"; [ -x "$PYBIN" ] || PYBIN="$(command -v python3)"

echo "› install dependencies"
"$PYBIN" -m pip install -q -r requirements.txt

echo "› apply migrations"
"$PYBIN" manage.py migrate --noinput

echo "› collect static (hashed + compressed)"
"$PYBIN" manage.py collectstatic --noinput

echo "› restart app server"
if $SUDO systemctl cat gunicorn >/dev/null 2>&1; then
  $SUDO systemctl restart gunicorn && echo "  restarted gunicorn"
elif systemctl list-unit-files --no-legend 2>/dev/null | grep -qi gunicorn; then
  svc="$(systemctl list-unit-files --no-legend 2>/dev/null | grep -i gunicorn | awk '{print $1}' | head -1)"
  $SUDO systemctl restart "$svc" && echo "  restarted $svc"
elif command -v supervisorctl >/dev/null 2>&1; then
  $SUDO supervisorctl restart all && echo "  restarted via supervisor"
elif [ -f docker-compose.yml ] || [ -f compose.yaml ]; then
  docker compose up -d --build && echo "  restarted via docker compose"
else
  echo "  WARN: no known service manager detected — restart the app server manually" >&2
fi

echo "✓ deploy complete"
