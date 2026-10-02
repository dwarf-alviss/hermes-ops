#!/usr/bin/env python3
"""hermes-ctrl — микро-API для дашборда hermes-ops: управление gateway на машинах.

Слушает ТОЛЬКО localhost; наружу выставляется через `tailscale funnel` (HTTPS).
Даёт браузеру ровно три действия над gateway — start / stop / restart — и статус.
Никаких произвольных команд: иначе это RCE-панель, доступная из интернета.

Авторизация: Bearer-токен = PBKDF2-SHA256(пароль дашборда, salt='hermes-ctrl-v1', 200k).
Производная считается и в браузере (WebCrypto), и здесь — второй пароль помнить не нужно,
а ключ расшифровки данных и ключ API не совпадают.

Управление:
  узел vps — локально: systemctl --user <action> hermes-gateway.service
  узел pc  — через очередь /root/hermes-ctrl/queue (её разбирает агент на ПК по SSH):
             у ПК нет входящих портов, VPS сам до ПК не дотягивается.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.environ.get('HERMES_CTRL_ROOT', '/root/hermes-ctrl')
QUEUE = os.path.join(ROOT, 'queue')
RUNNING = os.path.join(ROOT, 'queue', 'running')
NODES = os.path.join(ROOT, 'nodes')
CONFIG = os.path.join(ROOT, 'config.json')
COMMANDS = os.path.join(ROOT, 'commands.json')
PROJECTS = os.path.join(ROOT, 'projects.json')
LOG = os.path.join(ROOT, 'ctrl.log')

GATEWAY_UNIT = 'hermes-gateway.service'
# Разрешённые юниты: продовый gateway и пустышка для самопроверки механизма.
ALLOWED_UNITS = {GATEWAY_UNIT, 'hermes-ctrl-selftest.service'}
ACTIONS = {'start', 'stop', 'restart'}
NODES_KNOWN = ('vps', 'pc')
RATE_LIMIT = 20          # команд в минуту на узел
CMD_KEEP = 500

ISO = lambda: datetime.now(timezone.utc).isoformat(timespec='seconds')


def log(msg: str) -> None:
    line = f'{ISO()} {msg}\n'
    try:
        if os.path.exists(LOG) and os.path.getsize(LOG) > 1_000_000:
            with open(LOG) as f:
                tail = f.readlines()[-2000:]
            with open(LOG, 'w') as f:
                f.writelines(tail)
        with open(LOG, 'a') as f:
            f.write(line)
    except OSError:
        pass
    sys.stderr.write(line)


def read_json(path: str, default):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def write_json(path: str, data) -> None:
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    tmp = f'{path}.part'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def config() -> dict:
    return read_json(CONFIG, {})


def derive(password: str) -> str:
    return hashlib.pbkdf2_hmac('sha256', password.encode(), b'hermes-ctrl-v1', 200_000).hex()


def authorized(header: str | None) -> bool:
    cfg = config()
    want = cfg.get('token_derived') or ''
    if not want or not header:
        return False
    if not header.lower().startswith('bearer '):
        return False
    got = header.split(None, 1)[1].strip()
    return hmac.compare_digest(got.lower(), want.lower())


# ------------------------------------------------------------------ узлы
def unit_state(unit: str) -> str | None:
    env = dict(os.environ)
    env.setdefault('XDG_RUNTIME_DIR', f'/run/user/{os.getuid()}')
    try:
        r = subprocess.run(['systemctl', '--user', 'is-active', unit],
                           capture_output=True, text=True, timeout=8, env=env)
        return (r.stdout or '').strip() or None
    except Exception:
        return None


def gateway_pids(home: str = '/root/.hermes') -> list[int]:
    """PID gateway, подтверждённые живостью (kill -0).

    pgrep по 'hermes gateway run' не годится: supervised-процесс запускается как
    `python -c <код>`, и шаблон его не находит, зато находит любой шелл, в чьей
    командной строке встречается эта же фраза.
    """
    try:
        with open(os.path.join(home, 'gateway_state.json'), encoding='utf-8') as f:
            pid = json.load(f).get('pid')
    except (OSError, ValueError):
        return []
    if not pid:
        return []
    try:
        os.kill(int(pid), 0)
        return [int(pid)]
    except (OSError, ValueError):
        return []


def node_status(node: str) -> dict:
    """Статус gateway на узле. vps читаем локально, pc — из отчёта агента (fallback: снимок коллектора)."""
    if node == 'vps':
        st = unit_state(GATEWAY_UNIT)
        pids = gateway_pids('/root/.hermes')
        return {
            'unit_state': st,
            'running': st == 'active' and bool(pids),
            'pids': pids,
            'source': 'local',
            'updated_at': ISO(),
        }
    rep = read_json(os.path.join(NODES, 'pc.json'), {})
    if not rep:
        snap_path = '/root/hermes-ops/state/pc.json'
        snap = read_json(snap_path, {})
        gw = ((snap or {}).get('hermes') or {}).get('gateway') or {}
        if gw:
            # свежесть берём по mtime снимка, а не по времени записи платформы
            try:
                mtime = os.path.getmtime(snap_path)
                stamp = datetime.fromtimestamp(mtime, timezone.utc).isoformat(timespec='seconds')
            except OSError:
                stamp = gw.get('updated_at') or ISO()
            rep = {
                'unit_state': gw.get('unit_state'),
                'running': bool(gw.get('running')),
                'pids': [gw['pid']] if gw.get('pid_alive') and gw.get('pid') else [],
                'source': 'collector',
                'updated_at': stamp,
            }
    if not rep:
        return {'unit_state': None, 'running': False, 'pids': [], 'source': 'нет данных', 'updated_at': None}
    age = None
    try:
        ts = datetime.fromisoformat(str(rep.get('updated_at')).replace('Z', '+00:00'))
        age = int((datetime.now(timezone.utc) - ts).total_seconds())
    except Exception:
        pass
    rep['age_s'] = age
    return rep


def other_node(node: str) -> str:
    return 'pc' if node == 'vps' else 'vps'


# ------------------------------------------------------------------ команды
def load_commands() -> list[dict]:
    data = read_json(COMMANDS, [])
    cmds = data if isinstance(data, list) else []
    # задача, которую агент не забрал за 15 минут, не должна висеть «pending» вечно:
    # после перезагрузки ПК или правки скриптов очередь никто не разберёт.
    now = time.time()
    dirty = False
    for c in cmds:
        if c.get('status') == 'pending' and now - (c.get('ts') or now) > 900:
            c['status'] = 'expired'
            c['result'] = 'истекла: агент узла не забрал задачу за 15 мин'
            c['finished'] = ISO()
            dirty = True
    if dirty:
        save_commands(cmds)
    return cmds


def save_commands(cmds: list[dict]) -> None:
    write_json(COMMANDS, cmds[-CMD_KEEP:])


def rate_ok(node: str) -> bool:
    now = time.time()
    recent = [c for c in load_commands() if c.get('node') == node and now - (c.get('ts') or 0) < 60]
    return len(recent) < RATE_LIMIT


def enqueue(node: str, action: str, unit: str, takeover: bool) -> dict:
    cmd = {
        'id': f'{int(time.time())}-{os.urandom(2).hex()}',
        'node': node,
        'action': action,
        'unit': unit,
        'takeover': bool(takeover),
        'status': 'pending',
        'ts': time.time(),
        'created': ISO(),
        'created_by': 'dashboard',
        'started': None,
        'finished': None,
        'result': None,
        'rc': None,
    }
    cmds = load_commands()
    cmds.append(cmd)
    save_commands(cmds)
    if node != 'vps':
        os.makedirs(QUEUE, exist_ok=True)
        write_json(os.path.join(QUEUE, f'{node}-{cmd["id"]}.job'), cmd)
    return cmd


def run_local(cmd: dict) -> dict:
    """Выполнить команду на этом узле и записать результат в журнал."""
    unit = cmd['unit']
    env = dict(os.environ)
    env.setdefault('XDG_RUNTIME_DIR', f'/run/user/{os.getuid()}')
    cmd['status'] = 'running'
    cmd['started'] = ISO()
    save_commands(_replace(cmd))
    try:
        r = subprocess.run(['systemctl', '--user', cmd['action'], unit],
                           capture_output=True, text=True, timeout=90, env=env)
        rc, err = r.returncode, (r.stderr or '').strip()[:400]
    except Exception as exc:                                   # noqa: BLE001
        rc, err = 1, f'{type(exc).__name__}: {exc}'[:400]
    time.sleep(3)
    st = unit_state(unit)
    cmd['rc'] = rc
    cmd['finished'] = ISO()
    cmd['unit_state_after'] = st
    cmd['status'] = 'done' if rc == 0 else 'failed'
    cmd['result'] = err or f'rc=0, {unit}={st}'
    save_commands(_replace(cmd))
    notify(cmd)
    return cmd


def _replace(cmd: dict) -> list[dict]:
    cmds = load_commands()
    for i, c in enumerate(cmds):
        if c.get('id') == cmd.get('id'):
            cmds[i] = cmd
            return cmds
    cmds.append(cmd)
    return cmds


def tg_token() -> str | None:
    for path in ('/root/.hermes/.env', os.path.join(ROOT, 'bot.env')):
        try:
            with open(path) as f:
                for line in f:
                    if line.startswith('TELEGRAM_BOT_TOKEN=') or line.startswith('HERMES_TELEGRAM_TOKEN='):
                        return line.split('=', 1)[1].strip()
        except OSError:
            continue
    return None


def notify(cmd: dict) -> None:
    """Сообщить о действии в Telegram: кто-то жмёт кнопки на прод-узлах — это должно быть видно."""
    cfg = config()
    chat, thread = cfg.get('log_chat'), cfg.get('log_thread')
    token = tg_token()
    if not (token and chat):
        return
    icon = '✅' if cmd.get('status') == 'done' else '❌'
    text = (f'{icon} hermes-ctrl: {cmd["action"]} {cmd["node"]} gateway'
            f'\nюнит: {cmd["unit"]}\nитог: {cmd.get("result") or "—"}')
    args = ['curl', '-s', '-m', '10', '-X', 'POST',
            f'https://api.telegram.org/bot{token}/sendMessage',
            '--data-urlencode', f'chat_id={chat}',
            '--data-urlencode', f'text={text}']
    if thread:
        args += ['--data-urlencode', f'message_thread_id={thread}']
    try:
        subprocess.run(args, capture_output=True, timeout=15)
    except Exception:                                          # noqa: BLE001
        pass


# ------------------------------------------------------------------ HTTP
class Handler(BaseHTTPRequestHandler):
    server_version = 'hermes-ctrl/1.0'
    protocol_version = 'HTTP/1.1'

    def _cors(self) -> None:
        origin = config().get('allowed_origin') or 'https://dwarf-alviss.github.io'
        got = self.headers.get('Origin')
        if got and got == origin:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Credentials', 'true')
            self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
        self.send_header('Access-Control-Max-Age', '600')

    def _send(self, code: int, payload) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(code)
        self._cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def _body(self) -> dict:
        try:
            n = int(self.headers.get('Content-Length') or 0)
            if not n:
                return {}
            return json.loads(self.rfile.read(n).decode('utf-8') or '{}')
        except Exception:                                       # noqa: BLE001
            return {}

    def _auth(self) -> bool:
        if authorized(self.headers.get('Authorization')):
            return True
        log(f'401 {self.command} {self.path} ip={self.client_address[0]}')
        self._send(401, {'error': 'unauthorized'})
        return False

    def do_OPTIONS(self) -> None:                              # noqa: N802
        self.send_response(204)
        self._cors()
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self) -> None:                                  # noqa: N802
        path = self.path.split('?')[0]
        if path == '/api/health':
            return self._send(200, {'ok': True, 'ts': ISO()})
        if path == '/api/status':
            if not self._auth():
                return
            nodes = {n: node_status(n) for n in NODES_KNOWN}
            cmds = load_commands()[-30:][::-1]
            return self._send(200, {
                'nodes': nodes,
                'commands': cmds,
                'projects_rev': read_json(PROJECTS, {}).get('rev', 0),
                'projects_at': read_json(PROJECTS, {}).get('updated_at'),
                'ts': ISO(),
            })
        if path == '/api/commands':
            if not self._auth():
                return
            return self._send(200, {'commands': load_commands()[-60:][::-1]})
        if path == '/api/projects':
            if not self._auth():
                return
            return self._send(200, read_json(PROJECTS, {'rev': 0, 'projects': []}))
        return self._send(404, {'error': 'not found'})

    def do_POST(self) -> None:                                 # noqa: N802
        path = self.path.split('?')[0]
        m = re.fullmatch(r'/api/nodes/(vps|pc)/gateway/(start|stop|restart)', path)
        if m:
            return self._gateway_action(m.group(1), m.group(2))
        return self._send(404, {'error': 'not found'})

    def do_PUT(self) -> None:                                  # noqa: N802
        if self.path.split('?')[0] != '/api/projects':
            return self._send(404, {'error': 'not found'})
        if not self._auth():
            return
        body = self._body()
        cur = read_json(PROJECTS, {'rev': 0, 'projects': []})
        base = body.get('rev')
        if isinstance(base, int) and base < int(cur.get('rev') or 0):
            return self._send(409, {'error': 'конфликт версий', 'current': cur})
        payload = {
            'rev': int(cur.get('rev') or 0) + 1,
            'updated_at': ISO(),
            'projects': body.get('projects') or [],
        }
        write_json(PROJECTS, payload)
        log(f'projects PUT rev={payload["rev"]} n={len(payload["projects"])}')
        return self._send(200, {'rev': payload['rev'], 'updated_at': payload['updated_at']})

    def _gateway_action(self, node: str, action: str) -> None:
        if not self._auth():
            return
        body = self._body()
        unit = body.get('unit') or GATEWAY_UNIT
        takeover = bool(body.get('confirm_takeover'))
        if unit not in ALLOWED_UNITS:
            return self._send(400, {'error': f'юнит не разрешён: {unit}'})
        if action not in ACTIONS:
            return self._send(400, {'error': 'неизвестное действие'})
        if not rate_ok(node):
            return self._send(429, {'error': 'слишком часто, подожди минуту'})
        # Два gateway на одном Telegram-токене дерутся за апдейты: start/restart
        # второго узла — только осознанный перехват роли.
        if action in ('start', 'restart') and unit == GATEWAY_UNIT:
            other = node_status(other_node(node))
            if other.get('running') and not takeover:
                return self._send(409, {
                    'error': 'на другом узле gateway работает — это будет перехват роли',
                    'need_takeover': True,
                    'other': {'node': other_node(node), **other},
                })
        cmd = enqueue(node, action, unit, takeover)
        if node == 'vps':
            cmd = run_local(cmd)
            return self._send(200, {'command': cmd})
        return self._send(202, {'command': cmd, 'queued': True})

    def log_message(self, fmt: str, *args) -> None:            # тише в journal
        return


def main() -> int:
    os.makedirs(RUNNING, exist_ok=True)
    os.makedirs(NODES, exist_ok=True)
    cfg = config()
    port = int(os.environ.get('HERMES_CTRL_PORT') or cfg.get('port') or 9120)
    srv = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    log(f'hermes-ctrl слушает 127.0.0.1:{port}, root={ROOT}')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
