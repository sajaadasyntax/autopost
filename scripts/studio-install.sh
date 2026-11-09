#!/usr/bin/env bash
# Installs the studio beside the API. It does not edit api.alzahaby.cloud or restart golden-backend.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run: sudo bash scripts/studio-install.sh"
  exit 1
fi

if [[ -f .env ]] && ! grep -q '^STUDIO_ORIGIN=' .env; then
  printf '\nSTUDIO_ORIGIN=https://studio.alzahaby.cloud\n' >> .env
fi

cd web
npm install
npm run build
cd "$ROOT"

RENDERED="$(mktemp)"
cp deploy/nginx/studio.conf "$RENDERED"
if [[ -d /etc/nginx/sites-available ]]; then
  install -m 644 "$RENDERED" /etc/nginx/sites-available/studio.alzahaby.cloud.conf
  ln -sfn /etc/nginx/sites-available/studio.alzahaby.cloud.conf /etc/nginx/sites-enabled/studio.alzahaby.cloud.conf
else
  install -m 644 "$RENDERED" /etc/nginx/conf.d/studio.alzahaby.cloud.conf
fi
rm -f "$RENDERED"
nginx -t
systemctl reload nginx

TARGET_USER="${SUDO_USER:-$(id -un)}"
chown -R "$TARGET_USER":"$TARGET_USER" "$ROOT/web"
sudo -u "$TARGET_USER" -H pm2 startOrReload "$ROOT/deploy/studio.ecosystem.config.cjs" --only autopost-web
sudo -u "$TARGET_USER" -H pm2 save

if command -v certbot >/dev/null 2>&1; then
  certbot --nginx -d studio.alzahaby.cloud --non-interactive --redirect || echo "After DNS points at this server, run: sudo certbot --nginx -d studio.alzahaby.cloud"
fi

echo "Studio: https://studio.alzahaby.cloud"
echo "The API on port 3010 was left running."
