#!/usr/bin/env bash
# Установка hermes-ctrl на VPS (запускать на VPS из распакованной папки ctrl/).
#   bash install-ctrl.sh [порт]
# Ставит: /root/hermes-ctrl/{hermes_ctrl.py,agent.sh}, systemd user-сервис, self-test юнит.
set -euo pipefail

PORT="${1:-9120}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT=/root/hermes-ctrl
UNIT_DIR="$HOME/.config/systemd/user"

mkdir -p "$ROOT"/{queue/running,nodes}
install -m 0755 "$HERE/hermes_ctrl.py" "$ROOT/hermes_ctrl.py"
install -m 0755 "$HERE/agent.sh" "$ROOT/agent.sh"

# производная от пароля дашборда: один пароль на вход и на API, но ключи разные
python3 - "$ROOT" <<'PY'
import hashlib, json, os, sys, secrets
root = sys.argv[1]
cfg_path = os.path.join(root, 'config.json')
cfg = {}
if os.path.exists(cfg_path):
    try:
        cfg = json.load(open(cfg_path, encoding='utf-8'))
    except ValueError:
        cfg = {}
password = ''
pass_file = '/root/hermes-ops/.pass'
if os.path.exists(pass_file):
    password = open(pass_file, encoding='utf-8').read().strip()
if password:
    cfg['token_derived'] = hashlib.pbkdf2_hmac('sha256', password.encode(), b'hermes-ctrl-v1', 200_000).hex()
cfg.setdefault('port', int(os.environ.get('HERMES_CTRL_PORT', '9120')))
cfg.setdefault('allowed_origin', 'https://dwarf-alviss.github.io')
cfg.setdefault('log_chat', '518222643')
cfg.setdefault('log_thread', '615309')
cfg.setdefault('commands_keep', 500)
json.dump(cfg, open(cfg_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
os.chmod(cfg_path, 0o600)
print('config.json обновлён, token_derived:', 'есть' if cfg.get('token_derived') else 'НЕТ (нет /root/hermes-ops/.pass)')
PY

python3 - "$ROOT" "$PORT" <<'PY'
import json, os, sys
root, port = sys.argv[1], int(sys.argv[2])
p = os.path.join(root, 'config.json')
cfg = json.load(open(p, encoding='utf-8'))
cfg['port'] = port
json.dump(cfg, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
PY

mkdir -p "$UNIT_DIR"

cat > "$UNIT_DIR/hermes-ctrl.service" <<EOF
[Unit]
Description=hermes-ctrl — API управления gateway для дашборда hermes-ops
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 $ROOT/hermes_ctrl.py
Environment=HERMES_CTRL_ROOT=$ROOT
Environment=HERMES_CTRL_PORT=$PORT
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
EOF

# пустышка для сквозной проверки механизма: кнопки жмут её, а не прод-бот
cat > "$UNIT_DIR/hermes-ctrl-selftest.service" <<'EOF'
[Unit]
Description=hermes-ctrl self-test unit (пустышка, ничего не делает)

[Service]
Type=simple
ExecStart=/bin/sleep infinity
Restart=no
EOF

systemctl --user daemon-reload
systemctl --user enable --now hermes-ctrl.service
sleep 2
systemctl --user is-active hermes-ctrl.service
curl -s "http://127.0.0.1:${PORT}/api/health" || true
echo
echo "готово: hermes-ctrl слушает 127.0.0.1:${PORT}"
