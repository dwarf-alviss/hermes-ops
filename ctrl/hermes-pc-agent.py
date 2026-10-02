#!/usr/bin/env python3
"""Агент ПК: забирает команды управления gateway с VPS по SSH и выполняет их.

Почему так: ПК за NAT, входящих портов у него нет. VPS до ПК не дотягивается,
поэтому инициатор — ПК: один ssh-вызов в цикле (в покое очередь пуста, вызов дешёвый),
плюс отчёт о результате. Никаких новых портов, никаких секретов на ПК.

Разрешены только действия start/stop/restart над юнитами из белого списка.
"""
from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
import sys
import time
from datetime import datetime, timezone

VPS = os.environ.get('CTRL_VPS', 'vps')
REMOTE = os.environ.get('CTRL_REMOTE', '/root/hermes-ctrl/agent.sh')
NODE = os.environ.get('CTRL_NODE', 'pc')
ALLOWED_UNITS = {'hermes-gateway.service', 'hermes-ctrl-selftest.service'}
ALLOWED_ACTIONS = {'start', 'stop', 'restart'}

ISO = lambda: datetime.now(timezone.utc).isoformat(timespec='seconds')


def log(msg: str) -> None:
    print(f'{ISO()} [pc-agent] {msg}', flush=True)


def env_user() -> dict:
    env = dict(os.environ)
    env.setdefault('XDG_RUNTIME_DIR', f'/run/user/{os.getuid()}')
    return env


def unit_state(unit: str) -> str | None:
    try:
        r = subprocess.run(['systemctl', '--user', 'is-active', unit],
                           capture_output=True, text=True, timeout=8, env=env_user())
        return (r.stdout or '').strip() or None
    except Exception:                                          # noqa: BLE001
        return None


def pids() -> list[int]:
    """PID gateway из gateway_state.json, подтверждённые живостью.

    pgrep по 'hermes gateway run' бесполезен: supervised-процесс идёт как
    `python -c <код>`, шаблон его не находит, а сам он ловит шелл с этой фразой.
    """
    home = os.environ.get('HERMES_HOME') or os.path.join(os.path.expanduser('~'), '.hermes')
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


def ssh(args: list[str], timeout: int = 30, stdin_data: str | None = None) -> str:
    cmd = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', VPS, *args]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, input=stdin_data)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or '').strip()[:200] or f'ssh rc={r.returncode}')
    return r.stdout or ''


def status_payload() -> str:
    st = unit_state('hermes-gateway.service')
    p = pids()
    return json.dumps({
        'unit_state': st,
        'running': st == 'active' and bool(p),
        'pids': p,
        'source': 'pc-agent',
        'updated_at': ISO(),
    }, ensure_ascii=False)


def execute(job: dict) -> tuple[bool, str]:
    action, unit = job.get('action'), job.get('unit')
    if action not in ALLOWED_ACTIONS or unit not in ALLOWED_UNITS:
        return False, f'отказ: недопустимое действие {action} {unit}'
    try:
        r = subprocess.run(['systemctl', '--user', action, unit],
                           capture_output=True, text=True, timeout=120, env=env_user())
        rc, err = r.returncode, (r.stderr or '').strip()[:300]
    except Exception as exc:                                   # noqa: BLE001
        return False, f'{type(exc).__name__}: {exc}'[:300]
    time.sleep(3)
    st = unit_state(unit)
    ok = rc == 0
    text = err or f'rc=0, {unit}={st}'
    return ok, text


def one_cycle() -> int:
    try:
        out = ssh([REMOTE, 'poll', NODE], stdin_data=status_payload())
    except Exception as exc:                                   # noqa: BLE001
        log(f'опрос не удался: {exc}')
        return 0
    out = out.strip()
    start = out.find('[')
    if start < 0:
        log(f'странный ответ очереди: {out[:120]!r}')
        return 0
    try:
        jobs = json.loads(out[start:])
    except ValueError as exc:
        log(f'не разобрал задачи: {exc}')
        return 0
    if not jobs:
        return 0
    for job in jobs:
        log(f'задача {job.get("id")}: {job.get("action")} {job.get("unit")}')
        ok, text = execute(job)
        try:
            ssh([REMOTE, 'result', str(job.get('id')), 'ok' if ok else 'fail', text])
        except Exception as exc:                               # noqa: BLE001
            log(f'не смог вернуть результат: {exc}')
        log(f'итог: {"ок" if ok else "ошибка"} — {text}')
    return len(jobs)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--once', action='store_true')
    ap.add_argument('--interval', type=int, default=15)
    a = ap.parse_args()
    if a.once:
        one_cycle()
        return 0
    log(f'цикл каждые {a.interval} с, узел {NODE}, ssh {VPS}:{shlex.quote(REMOTE)}')
    while True:
        try:
            one_cycle()
        except Exception as exc:                               # noqa: BLE001
            log(f'цикл упал: {exc}')
        time.sleep(a.interval)


if __name__ == '__main__':
    raise SystemExit(main())
