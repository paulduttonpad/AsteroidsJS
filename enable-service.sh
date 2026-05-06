#!/usr/bin/env bash
set -Eeuo pipefail

SERVICE_NAME="p5js-asteroids"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_USER="${SUDO_USER:-$USER}"
NODE_BIN="$(command -v node || true)"
NPM_BIN="$(command -v npm || true)"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "Installing ${SERVICE_NAME} systemd service..."

if [[ ! -f "${APP_DIR}/package.json" ]]; then
  echo "ERROR: package.json not found in ${APP_DIR}" >&2
  echo "Please run this script from the project root." >&2
  exit 1
fi

if [[ -z "${NODE_BIN}" ]]; then
  echo "ERROR: node was not found in PATH." >&2
  exit 1
fi

if [[ -z "${NPM_BIN}" ]]; then
  echo "ERROR: npm was not found in PATH." >&2
  exit 1
fi

sudo tee "${SERVICE_FILE}" > /dev/null <<EOF
[Unit]
Description=P5JS Asteroids Node.js Service
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
ExecStart=${NPM_BIN} start
Restart=always
RestartSec=5
User=${APP_USER}
Environment=NODE_ENV=production
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}"
sudo systemctl restart "${SERVICE_NAME}"

echo
echo "Service installed and started."
echo
echo "Status:"
sudo systemctl --no-pager status "${SERVICE_NAME}" || true

echo
echo "Useful commands:"
echo "  sudo systemctl status ${SERVICE_NAME}"
echo "  sudo journalctl -u ${SERVICE_NAME} -f"
echo "  sudo systemctl restart ${SERVICE_NAME}"
echo "  sudo systemctl stop ${SERVICE_NAME}"
