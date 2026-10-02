#!/usr/bin/env bash
# Установка коллектора на VPS (запускается от root).
#   bash install-vps.sh [пароль]
# Если пароль не передан — генерируется и печатается один раз.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
BASE=/root/hermes-ops
SRC="$BASE/src"

mkdir -p "$BASE/state"

# 1. пароль шифрования
if [ ! -s "$BASE/.pass" ]; then
  if [ "${1:-}" != "" ]; then
    printf '%s' "$1" > "$BASE/.pass"
  else
    python3 - <<'PY' > "$BASE/.pass"
import secrets
alpha = "abcdefghjkmnpqrstuvwxyz23456789ACDEFGHJKLMNPQRSTUVWXYZ"
pw = "".join(secrets.choice(alpha) for _ in range(20))
print("-".join(pw[i:i+4] for i in range(0, 20, 4)), end="")
PY
  fi
  chmod 600 "$BASE/.pass"
  echo "Сгенерирован пароль шифрования (сохрани его):"
  echo
  echo "    $(cat "$BASE/.pass")"
  echo
fi

# 2. код коллектора
mkdir -p "$SRC"
cp -f "$HERE/collect.py" "$HERE/publish.py" "$SRC/"
chmod +x "$SRC"/*.py

# 3. git-доступ (gh CLI уже авторизован под dwarf-alviss)
if command -v gh >/dev/null; then
  gh auth setup-git || true
  export GIT_TERMINAL_PROMPT=0
  TOKEN="$(gh auth token)"
  git config --global --replace-all \
    url."https://x-access-token:${TOKEN}@github.com/".insteadOf "https://github.com/" || true
fi

# 4. cron: сбор каждые 5 минут
CRON_LINE="*/5 * * * * /usr/bin/python3 $SRC/collect.py --name vps --label 'VPS · Amsterdam (Timeweb)' --kind 'VPS · 1 vCPU' --hermes-home /root/.hermes --disks / --heartbeat-url 'https://gist.githubusercontent.com/dwarf-alviss/348cdf443ff2ec901f7930baa0a181c8/raw/heartbeat.json' --out $BASE/state/vps.json >/dev/null 2>&1 && /usr/bin/python3 $SRC/publish.py >> $BASE/publish.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'hermes-ops' ; echo "$CRON_LINE" ) | crontab -

echo "Коллектор установлен. Запускаю первый сбор…"
python3 "$SRC/collect.py" --name vps \
  --label 'VPS · Amsterdam (Timeweb)' --kind 'VPS · 1 vCPU' \
  --hermes-home /root/.hermes --disks / \
  --heartbeat-url 'https://gist.githubusercontent.com/dwarf-alviss/348cdf443ff2ec901f7930baa0a181c8/raw/heartbeat.json' \
  --out "$BASE/state/vps.json"
python3 "$SRC/publish.py"
