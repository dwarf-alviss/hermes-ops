#!/usr/bin/env bash
# Установка коллектора на VPS (запускать от root).
#   bash install-vps.sh [пароль]
# Если пароль не передан — генерируется и печатается один раз.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
BASE=/root/hermes-ops
SRC="$BASE/src"
HEARTBEAT="https://gist.githubusercontent.com/dwarf-alviss/348cdf443ff2ec901f7930baa0a181c8/raw/heartbeat.json"

mkdir -p "$BASE/state" "$SRC"

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
  echo "Пароль шифрования (сохрани — показывается один раз):"
  echo
  echo "    $(cat "$BASE/.pass")"
  echo
fi

# 2. код коллектора (из клона репы, если он есть — это актуальная версия)
SRC_DIR="$HERE"
[ -d /root/projects/hermes-ops/collector ] && SRC_DIR=/root/projects/hermes-ops/collector
cp -f "$SRC_DIR/collect.py" "$SRC_DIR/publish.py" "$SRC/"
chmod +x "$SRC"/*.py

# 3. git-доступ для публикации данных (gh CLI уже авторизован под dwarf-alviss)
if command -v gh >/dev/null; then
  export GIT_TERMINAL_PROMPT=0
  gh auth setup-git >/dev/null 2>&1 || true
  TOKEN="$(gh auth token 2>/dev/null || true)"
  if [ -n "$TOKEN" ]; then
    git config --global --replace-all \
      url."https://x-access-token:${TOKEN}@github.com/".insteadOf "https://github.com/" || true
  fi
fi

# 4. обёртка запуска
cat > "$BASE/run.sh" <<EOF
#!/usr/bin/env bash
# Сбор снимка VPS + публикация. Запускается по cron каждые 5 минут.
set -uo pipefail
exec >> "$BASE/publish.log" 2>&1
echo "=== \$(date -Is) ==="
/usr/bin/python3 "$SRC/collect.py" \\
  --name vps --label 'VPS · Amsterdam (Timeweb)' --kind 'VPS · 1 vCPU' \\
  --hermes-home /root/.hermes --disks / \\
  --heartbeat-url "$HEARTBEAT" \\
  --out "$BASE/state/vps.json" || echo "collect failed: \$?"
/usr/bin/python3 "$SRC/publish.py" || echo "publish failed: \$?"
EOF
chmod +x "$BASE/run.sh"

# 5. cron каждые 5 минут (идемпотентно)
LINE="*/5 * * * * $BASE/run.sh"
( { crontab -l 2>/dev/null | grep -v 'hermes-ops/run.sh' || true; echo "$LINE"; } ) | crontab -
echo "cron: $(crontab -l | grep hermes-ops/run.sh)"

# 6. первая публикация
echo "Первый сбор…"
"$BASE/run.sh"
tail -3 "$BASE/publish.log"
