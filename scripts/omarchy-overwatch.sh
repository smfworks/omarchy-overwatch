#!/usr/bin/env bash
# Start the Overwatch OSINT for Omarchy preview server if needed, then open the HUD.
# Product name: Overwatch OSINT for Omarchy. CLI remains omarchy-overwatch.
set -euo pipefail
OW_ROOT="${OW_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PORT="${OW_PORT:-4173}"
URL="http://127.0.0.1:${PORT}"
# Window class / focus pattern — Chromium --app= class. Title is "Overwatch OSINT for Omarchy".
APP_CLASS="Overwatch"

cd "${OW_ROOT}"

if ! command -v npm >/dev/null; then
  echo "npm not found. Install nodejs/npm, then re-run." >&2
  exit 1
fi

if [[ ! -d dist ]]; then
  npm install
  npm run build
fi

already=0
if command -v curl >/dev/null; then
  if curl -fsS --max-time 1 "${URL}" >/dev/null 2>&1; then
    already=1
  fi
fi

if [[ "${already}" -eq 0 ]]; then
  nohup npm run preview -- --host 127.0.0.1 --port "${PORT}" >/tmp/omarchy-overwatch.log 2>&1 &
  for _ in $(seq 1 40); do
    if curl -fsS --max-time 1 "${URL}" >/dev/null 2>&1; then
      break
    fi
    sleep 0.25
  done
fi

# Omarchy web app (chrome-free --app= window), then Chromium/Chrome --app=, then xdg-open.
open_hud() {
  if command -v omarchy-launch-or-focus-webapp >/dev/null 2>&1; then
    omarchy-launch-or-focus-webapp "${APP_CLASS}" "${URL}" --class="${APP_CLASS}" >/dev/null 2>&1 || true
    return
  fi
  if command -v omarchy-launch-webapp >/dev/null 2>&1; then
    omarchy-launch-webapp "${URL}" --class="${APP_CLASS}" >/dev/null 2>&1 || true
    return
  fi
  local bin
  for bin in chromium google-chrome google-chrome-stable chromium-browser; do
    if command -v "${bin}" >/dev/null 2>&1; then
      nohup "${bin}" --app="${URL}" --class="${APP_CLASS}" >/dev/null 2>&1 &
      return
    fi
  done
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "${URL}" >/dev/null 2>&1 || true
    return
  fi
  echo "Open ${URL} in your browser."
}

open_hud
