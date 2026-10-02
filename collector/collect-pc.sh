#!/usr/bin/env bash
# Снимок ПК (WSL) → отправка на VPS. Запускается по cron/systemd на ПК каждые 5 минут.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PY="${PY:-python3}"
OUT="${HOME}/.hermes-ops/pc.json"
mkdir -p "$(dirname "$OUT")"

"$PY" "$HERE/collect.py" \
  --name pc \
  --label "ПК · Windows 11 / WSL2" \
  --kind "WSL2 · RTX 3050" \
  --hermes-home "${HOME}/.hermes" \
  --disks "/,/mnt/c" \
  --heartbeat-url "https://gist.githubusercontent.com/dwarf-alviss/348cdf443ff2ec901f7930baa0a181c8/raw/heartbeat.json" \
  --out "$OUT" \
  --push vps
