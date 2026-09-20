#!/usr/bin/env bash
# Start the Overwatch preview server if needed, then open the HUD.
set -euo pipefail
OW_ROOT="${OW_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PORT="${OW_PORT:-4173}"
URL="http://127.0.0.1:${PORT}"

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

if command -v xdg-open >/dev/null; then
  xdg-open "${URL}" >/dev/null 2>&1 || true
else
  echo "Open ${URL} in your browser."
fi
