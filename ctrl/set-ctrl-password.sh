#!/usr/bin/env bash
# Пересчитать токен API (производную от пароля) после смены пароля дашборда.
#   bash set-ctrl-password.sh            # взять пароль из /root/hermes-ops/.pass
#   bash set-ctrl-password.sh 'новый'    # задать вручную
# Запускать на VPS. Меняет только производную для API, шифрование данных не трогает.
set -euo pipefail

ROOT="${HERMES_CTRL_ROOT:-/root/hermes-ctrl}"
PASS="${1:-}"

if [ -z "$PASS" ]; then
  if [ -r /root/hermes-ops/.pass ]; then
    PASS="$(cat /root/hermes-ops/.pass)"
  else
    echo "нет пароля: передай аргументом или создай /root/hermes-ops/.pass" >&2
    exit 1
  fi
fi

python3 - "$ROOT" "$PASS" <<'PY'
import hashlib, json, os, sys
root, password = sys.argv[1], sys.argv[2]
cfg_path = os.path.join(root, 'config.json')
cfg = {}
if os.path.exists(cfg_path):
    try:
        cfg = json.load(open(cfg_path, encoding='utf-8'))
    except ValueError:
        cfg = {}
cfg['token_derived'] = hashlib.pbkdf2_hmac('sha256', password.encode(), b'hermes-ctrl-v1', 200_000).hex()
json.dump(cfg, open(cfg_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
os.chmod(cfg_path, 0o600)
print('token_derived обновлён')
PY
systemctl --user restart hermes-ctrl.service
sleep 2
systemctl --user is-active hermes-ctrl.service
