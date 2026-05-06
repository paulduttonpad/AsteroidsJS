#!/usr/bin/env bash
set -Eeuo pipefail

SERVICE_NAME="p5js-asteroids"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "Disabling ${SERVICE_NAME} systemd service..."

if systemctl list-unit-files | grep -q "^${SERVICE_NAME}.service"; then
  sudo systemctl stop "${SERVICE_NAME}" || true
  sudo systemctl disable "${SERVICE_NAME}" || true
else
  echo "Service ${SERVICE_NAME} is not currently registered."
fi

if [[ -f "${SERVICE_FILE}" ]]; then
  sudo rm -f "${SERVICE_FILE}"
  echo "Removed ${SERVICE_FILE}"
fi

sudo systemctl daemon-reload
sudo systemctl reset-failed || true

echo
echo "Service disabled and removed."
