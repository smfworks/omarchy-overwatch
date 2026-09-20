#!/usr/bin/env bash
# Install Omarchy Overwatch for a local user (Omarchy / Arch).
set -euo pipefail

# Usage: install.sh [dest] [--service]
#   --service  also install+enable a systemd --user unit that keeps the preview
#              server running (useful with `tailscale serve` or a reverse proxy).
WITH_SERVICE=0
ARGS=()
for arg in "$@"; do
  case "${arg}" in
    --service) WITH_SERVICE=1 ;;
    *) ARGS+=("${arg}") ;;
  esac
done

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${ARGS[0]:-${HOME}/Apps/omarchy-overwatch}"
BIN_DIR="${HOME}/.local/bin"
APP_DIR="${HOME}/.local/share/applications"
ICON_DIR="${HOME}/.local/share/icons/hicolor/scalable/apps"

echo "==> Omarchy Overwatch install"
echo "    source: ${SRC}"
echo "    dest:   ${DEST}"

mkdir -p "$(dirname "$DEST")"
if [[ "${SRC}" != "${DEST}" ]]; then
  mkdir -p "${DEST}"
  # Copy project files without node_modules / git.
  tar -C "${SRC}" --exclude node_modules --exclude dist --exclude .git -cf - . | tar -C "${DEST}" -xf -
fi

cd "${DEST}"
if ! command -v npm >/dev/null; then
  echo "npm is required. On Omarchy/Arch: sudo pacman -S nodejs npm" >&2
  exit 1
fi

npm install
npm test
npm run build

mkdir -p "${BIN_DIR}" "${APP_DIR}" "${ICON_DIR}"
install -m 0755 "${DEST}/scripts/omarchy-overwatch.sh" "${BIN_DIR}/omarchy-overwatch"
sed -i "s|^OW_ROOT=.*|OW_ROOT=\"${DEST}\"|" "${BIN_DIR}/omarchy-overwatch"

install -m 0644 "${DEST}/public/favicon.svg" "${ICON_DIR}/omarchy-overwatch.svg"

# Keep Exec pointing at the launcher binary so preview starts before the HUD.
# Do not call omarchy-webapp-install: its default Exec is
# `omarchy-launch-webapp $URL`, which would skip the Vite preview server.
# Custom Exec is supported there, but would write a second .desktop named
# after the display name. This file is the single launcher.
DESKTOP="${APP_DIR}/omarchy-overwatch.desktop"
cat > "${DESKTOP}" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Omarchy Overwatch
Comment=Public-source OSINT workbench
Exec=${BIN_DIR}/omarchy-overwatch
Icon=omarchy-overwatch
Terminal=false
Categories=Network;Security;Utility;
StartupNotify=true
EOF

if command -v update-desktop-database >/dev/null; then
  update-desktop-database "${APP_DIR}" >/dev/null 2>&1 || true
fi

if [[ "${WITH_SERVICE}" -eq 1 ]]; then
  UNIT_DIR="${HOME}/.config/systemd/user"
  mkdir -p "${UNIT_DIR}"

  # systemd has no shell, so npm must be an absolute path. Version managers
  # (mise/nvm/asdf) resolve to a version-pinned directory that stops existing at
  # the next Node upgrade, so prefer a stable system npm when one is present.
  NPM_BIN="$(command -v npm)"
  case "${NPM_BIN}" in
    */.local/share/mise/*|*/.nvm/*|*/.asdf/*|*/fnm/*)
      [[ -x /usr/bin/npm ]] && NPM_BIN=/usr/bin/npm
      ;;
  esac
  cat > "${UNIT_DIR}/omarchy-overwatch.service" <<EOF
[Unit]
Description=Omarchy Overwatch preview server (127.0.0.1:4173)
Documentation=https://github.com/smfworks/omarchy-overwatch
After=network-online.target

[Service]
Type=simple
WorkingDirectory=${DEST}
ExecStart=${NPM_BIN} run preview
Restart=on-failure
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now omarchy-overwatch.service
  echo "==> systemd --user service enabled (omarchy-overwatch.service)."
  echo "    The preview server now starts with your session, on 127.0.0.1:4173."
fi

echo "==> Installed."
echo "    Launch: omarchy-overwatch"
echo "    Or:     gtk-launch omarchy-overwatch"
echo "    HUD:    chrome-free web app at http://127.0.0.1:4173"
