#!/usr/bin/env bash
# Очередь команд для узла ПК. Вызывается агентом на ПК ПО SSH (порт наружу не открываем).
#   agent.sh poll pc [STATUS_JSON]   — забрать до 3 задач и сообщить свой статус
#   agent.sh result <id> <ok|fail> <текст> — вернуть результат
#   agent.sh list                    — что сейчас в очереди/в работе (для отладки)
set -uo pipefail

ROOT="${HERMES_CTRL_ROOT:-/root/hermes-ctrl}"
QUEUE="$ROOT/queue"
RUNNING="$QUEUE/running"
NODES="$ROOT/nodes"
mkdir -p "$QUEUE" "$RUNNING" "$NODES"

case "${1:-}" in
  poll)
    node="${2:-pc}"
    # Статус узла приходит на stdin: через аргументы JSON рвётся шеллом (ssh склеивает
    # аргументы в одну строку, и пробелы внутри JSON ломают разбор).
    if [ ! -t 0 ]; then
      tmp="$NODES/.$node.status.$$"
      cat > "$tmp" 2>/dev/null || true
      if [ -s "$tmp" ]; then mv "$tmp" "$NODES/$node.json"; else rm -f "$tmp"; fi
    fi
    python3 - "$QUEUE" "$RUNNING" "$node" <<'PY'
import json, os, sys
queue, running, node = sys.argv[1], sys.argv[2], sys.argv[3]
out = []
try:
    names = sorted(n for n in os.listdir(queue)
                   if n.startswith(f'{node}-') and n.endswith('.job'))
except OSError:
    names = []
for name in names[:3]:
    src, dst = os.path.join(queue, name), os.path.join(running, name)
    try:
        os.replace(src, dst)        # атомарный захват: агент не увидит полуфайл
    except OSError:
        continue
    try:
        with open(dst, encoding='utf-8') as f:
            out.append(json.load(f))
    except (OSError, ValueError):
        continue
print(json.dumps(out, ensure_ascii=False))
PY
    ;;

  result)
    id="${2:?нужен id}"; ok="${3:-fail}"; text="${4:-}"
    python3 - "$ROOT" "$RUNNING" "$id" "$ok" "$text" <<'PY'
import json, os, sys, datetime
root, running, cid, ok, text = sys.argv[1:6]
cmds_path = os.path.join(root, 'commands.json')
try:
    cmds = json.load(open(cmds_path, encoding='utf-8'))
except (OSError, ValueError):
    cmds = []
now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
for c in cmds:
    if c.get('id') == cid:
        c['status'] = 'done' if ok == 'ok' else 'failed'
        c['finished'] = now
        c['result'] = (text or '')[:400]
        c['rc'] = 0 if ok == 'ok' else 1
        break
tmp = cmds_path + '.part'
with open(tmp, 'w', encoding='utf-8') as f:
    json.dump(cmds, f, ensure_ascii=False, indent=1)
os.replace(tmp, cmds_path)
try:
    os.remove(os.path.join(running, f'pc-{cid}.job'))
except OSError:
    pass
PY
    ;;

  list)
    echo "queue: $(ls -1 "$QUEUE" 2>/dev/null | grep -c '\.job$' || true)"
    ls -1 "$QUEUE" 2>/dev/null | grep '\.job$' || true
    echo "running: $(ls -1 "$RUNNING" 2>/dev/null | grep -c '\.job$' || true)"
    ;;

  *)
    echo "usage: agent.sh {poll <node> [status_json]|result <id> ok|fail <text>|list}" >&2
    exit 2
    ;;
esac
