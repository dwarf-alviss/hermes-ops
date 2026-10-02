#!/usr/bin/env bash
# Смена пароля шифрования на VPS: bash set-password.sh 'новый-пароль'
# Перешифровывает данные следующим прогоном коллектора.
set -euo pipefail

BASE=/root/hermes-ops
[ $# -ge 1 ] || { echo "использование: bash $0 'новый-пароль'" >&2; exit 1; }

printf '%s' "$1" > "$BASE/.pass"
chmod 600 "$BASE/.pass"
echo "пароль обновлён; перешифровываю данные…"
"$BASE/run.sh"
tail -2 "$BASE/publish.log"
echo
echo "Не забудь войти в дашборд с новым паролем."
