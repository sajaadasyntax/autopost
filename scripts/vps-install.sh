#!/usr/bin/env bash
# Installs autopost beside the existing app. It does not edit api.alzahaby.cloud,
# does not use port 4000, and does not restart golden-backend.
set -euo pipefail

HOST="${AUTOPOST_HOST:-autopost.alzahaby.cloud}"
PORT="${AUTOPOST_PORT:-3010}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run: sudo bash scripts/vps-install.sh"
  exit 1
fi

if [[ "$HOST" == "api.alzahaby.cloud" || "$HOST" == "alzahaby.cloud" || "$PORT" == "4000" || "$PORT" == "80" || "$PORT" == "443" ]]; then
  echo "Refusing to bind ${HOST}:${PORT}. That belongs to the existing site."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20 or newer is required. Install it for this app without replacing the Node used by golden-backend."
  exit 1
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "Node $(node -v) is too old for this app. Install Node 20 or newer beside the existing app."
  exit 1
fi

TARGET_USER="${SUDO_USER:-$(id -un)}"
chown -R "$TARGET_USER":"$TARGET_USER" "$ROOT"

sudo -u "$TARGET_USER" -H npm install
sudo -u "$TARGET_USER" -H npx prisma generate

if [[ -f .env ]] && grep -Eq '^(LOCAL_DEV=true|WHATSAPP_VERIFY_TOKEN=local-verify|PUBLIC_BASE_URL=http://127\.0\.0\.1:3000)$' .env; then
  echo "The .env in this folder is the laptop config. Move it aside and rerun so this script can write the public one."
  exit 1
fi

if [[ ! -s .env ]] || ! grep -q '^APP_ENCRYPTION_KEY=.\+' .env; then
  ENC="$(openssl rand -hex 32)"
  VERIFY="$(openssl rand -hex 16)"
  ADMIN="$(openssl rand -hex 24)"
  cat > .env <<EOF
LOCAL_DEV=false
PORT=${PORT}
DATABASE_URL=file:../data/autopost.db
REDIS_URL=
PUBLIC_BASE_URL=https://${HOST}
APP_ENCRYPTION_KEY=${ENC}
ADMIN_API_KEY=${ADMIN}
ALLOWLIST_PHONES=
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=${VERIFY}
GRAPH_API_VERSION=v21.0
ANTHROPIC_API_KEY=
CLAUDE_MODEL=claude-sonnet-4-5
CANVA_CLIENT_ID=
CANVA_CLIENT_SECRET=
CANVA_REDIRECT_URI=https://${HOST}/integrations/canva/callback
CANVA_FIELD_HEADLINE=HEADLINE
CANVA_FIELD_CAPTION=CAPTION
CANVA_FIELD_CTA=CTA
AZURE_STORAGE_CONNECTION_STRING=
STORAGE_DIR=storage
BRAND_NAME=Smile Dental
BRAND_TONE=Warm, professional, and reassuring
BRAND_AUDIENCE=Adults 25-50
CANVA_BRAND_TEMPLATE_ID=
FB_PAGE_ID=
IG_USER_ID=
PAGE_ACCESS_TOKEN=
EOF
  chown "$TARGET_USER":"$TARGET_USER" .env
  chmod 600 .env
fi

mkdir -p data storage
chown "$TARGET_USER":"$TARGET_USER" data storage
sudo -u "$TARGET_USER" -H npx prisma db push --accept-data-loss
sudo -u "$TARGET_USER" -H npm run build
sudo -u "$TARGET_USER" -H npm run seed

RENDERED="$(mktemp)"
sed -e "s/__HOST__/${HOST}/g" -e "s/__PORT__/${PORT}/g" deploy/nginx/autopost.conf > "$RENDERED"
NGINX_NAME="${HOST}.conf"
if [[ -d /etc/nginx/sites-available ]]; then
  install -m 644 "$RENDERED" "/etc/nginx/sites-available/${NGINX_NAME}"
  ln -sfn "/etc/nginx/sites-available/${NGINX_NAME}" "/etc/nginx/sites-enabled/${NGINX_NAME}"
else
  install -m 644 "$RENDERED" "/etc/nginx/conf.d/${NGINX_NAME}"
fi
rm -f "$RENDERED"

nginx -t
systemctl reload nginx

if command -v pm2 >/dev/null 2>&1; then
  sudo -u "$TARGET_USER" -H pm2 startOrReload "$ROOT/deploy/ecosystem.config.cjs" --only autopost
  sudo -u "$TARGET_USER" -H pm2 save
elif [[ -d /etc/systemd/system ]]; then
  NODE_BIN="$(command -v node)"
  cat > /etc/systemd/system/autopost.service <<EOF
[Unit]
Description=Autopost WhatsApp webhook
After=network.target

[Service]
Type=simple
User=${TARGET_USER}
WorkingDirectory=${ROOT}
EnvironmentFile=${ROOT}/.env
ExecStart=${NODE_BIN} dist/main.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable autopost
  systemctl restart autopost
else
  echo "Neither pm2 nor systemd is available. Start the app with: node dist/main.js"
  exit 1
fi

if command -v certbot >/dev/null 2>&1; then
  if ! certbot --nginx -d "$HOST" --non-interactive --redirect; then
    echo "HTTPS is not ready. After DNS for ${HOST} points at this server, run: sudo certbot --nginx -d ${HOST}"
  fi
else
  echo "certbot is not installed. After DNS is in place, install certbot and run: sudo certbot --nginx -d ${HOST}"
fi

VERIFY_TOKEN="$(grep '^WHATSAPP_VERIFY_TOKEN=' .env | cut -d= -f2-)"
echo
echo "Callback URL: https://${HOST}/webhooks/whatsapp"
echo "Verify token: ${VERIFY_TOKEN}"
echo "Canva redirect: https://${HOST}/integrations/canva/callback"
echo "The site https://api.alzahaby.cloud was left as it is."
