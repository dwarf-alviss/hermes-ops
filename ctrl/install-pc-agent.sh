#!/usr/bin/env bash
# Установка агента ПК: забирает команды с VPS по SSH и выполняет их.
#   bash install-pc-agent.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$HOME/.hermes-ops"
UNIT_DIR="$HOME/.config/systemd/user"
mkdir -p "$DEST" "$UNIT_DIR"
install -m 0755 "$HERE/hermes-pc-agent.py" "$DEST/hermes-pc-agent.py"

# пустышка для сквозной проверки механизма: кнопки жмут её, а не прод-бот
cat > "$UNIT_DIR/hermes-ctrl-selftest.service" <<'EOF'
[Unit]
Description=hermes-ctrl self-test unit (пустышка, ничего не делает)

[Service]
Type=simple
ExecStart=/bin/sleep infinity
Restart=no
EOF

cat > "$UNIT_DIR/hermes-ctrl-pc-agent.service" <<EOF
[Unit]
Description=hermes-ctrl: агент ПК (команды gateway с VPS по SSH)
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 $DEST/hermes-pc-agent.py --interval 15
Environment=CTRL_VPS=vps
Environment=CTRL_NODE=pc
Environment=CTRL_REMOTE=/root/hermes-ctrl/agent.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now hermes-ctrl-pc-agent.service
sleep 3
systemctl --user is-active hermes-ctrl-pc-agent.service
echo "--- лог агента ---"
journalctl --user -u hermes-ctrl-pc-agent.service -n 8 --no-pager 2>/dev/null | tail -8 || true
