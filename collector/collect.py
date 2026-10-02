#!/usr/bin/env python3
"""Сбор снимка узла для дашборда hermes-ops: ресурсы машины + состояние Hermes.

Работает и на VPS, и на ПК (WSL). Результат — JSON-снимок в state/<name>.json.
Опция --push отправляет снимок на VPS (используется на ПК, который за NAT).

Только stdlib: python3 collect.py --name vps --kind "VPS · Amsterdam" --out state/vps.json
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone

ISO = lambda: datetime.now(timezone.utc).isoformat(timespec='seconds')


def sh(cmd: str, timeout: int = 10, stdin_data: str | None = None) -> str:
    try:
        r = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout, input=stdin_data
        )
        return (r.stdout or '').strip()
    except Exception:
        return ''


def systemd_unit_state(unit: str) -> str | None:
    """Состояние systemd user-юнита (active/inactive/failed/…).

    Нужно, чтобы статус gateway не зависел от файла-маркера: файл врёт, юнит — нет.
    XDG_RUNTIME_DIR подставляем явно: из cron/systemd-таймера переменной может не быть.
    """
    uid = os.getuid()
    env = dict(os.environ)
    env.setdefault('XDG_RUNTIME_DIR', f'/run/user/{uid}')
    try:
        r = subprocess.run(
            ['systemctl', '--user', 'is-active', unit],
            capture_output=True, text=True, timeout=6, env=env,
        )
        return (r.stdout or '').strip() or None
    except Exception:
        return None


# ---------------------------------------------------------------- host metrics
def read_meminfo() -> dict:
    out: dict[str, int] = {}
    try:
        with open('/proc/meminfo') as f:
            for line in f:
                k, _, rest = line.partition(':')
                v = rest.strip().split()
                if v and v[0].isdigit():
                    out[k] = int(v[0])  # kB
    except OSError:
        pass
    return out


def host_metrics(disks: list[str]) -> dict:
    mem = read_meminfo()
    total = mem.get('MemTotal', 0) / 1024
    avail = mem.get('MemAvailable', mem.get('MemFree', 0)) / 1024
    swap_total = mem.get('SwapTotal', 0) / 1024
    swap_free = mem.get('SwapFree', 0) / 1024

    try:
        uptime = float(open('/proc/uptime').read().split()[0])
    except Exception:
        uptime = 0.0

    try:
        l1, l5, l15 = os.getloadavg()
    except OSError:
        l1 = l5 = l15 = 0.0

    disk_info = []
    for path in disks:
        try:
            u = shutil.disk_usage(path)
            if u.total == 0:
                continue
            disk_info.append({
                'mount': path,
                'total_gb': round(u.total / 1024**3, 1),
                'used_gb': round(u.used / 1024**3, 1),
                'pct': round(u.used * 100 / u.total),
            })
        except OSError:
            continue

    # топ процессов по CPU (исключая самих себя)
    procs = []
    skip_pids = {str(os.getpid()), str(os.getppid())}
    ps = sh("ps -eo pid=,comm=,pcpu=,rss= --sort=-pcpu 2>/dev/null | head -14")
    for line in ps.splitlines():
        parts = line.split(None, 3)
        if len(parts) < 4:
            continue
        pid, name, cpu, rss = parts
        if pid in skip_pids or name in ('ps', 'sh', 'bash', 'systemd'):
            continue
        try:
            cpu_f = float(cpu)
            rss_mb = int(rss) / 1024
        except ValueError:
            continue
        if cpu_f < 0.1 and rss_mb < 30:
            continue
        procs.append({'name': name[:40], 'cpu': round(cpu_f, 1), 'mem_mb': round(rss_mb)})
        if len(procs) >= 6:
            break

    docker = []
    dps = sh("docker ps --format '{{.Names}}|{{.Status}}|{{.Image}}' 2>/dev/null")
    for line in dps.splitlines():
        bits = line.split('|')
        if len(bits) == 3:
            docker.append({'name': bits[0], 'status': bits[1][:40], 'image': bits[2][:60]})

    return {
        'name': '',
        'kind': '',
        'uptime_s': round(uptime),
        'cpu_count': os.cpu_count() or 1,
        'load': {'m1': round(l1, 2), 'm5': round(l5, 2), 'm15': round(l15, 2)},
        'mem': {
            'total_mb': round(total),
            'used_mb': round(total - avail),
            'avail_mb': round(avail),
            'pct': round((total - avail) * 100 / total) if total else 0,
        },
        'swap': ({
            'total_mb': round(swap_total),
            'used_mb': round(swap_total - swap_free),
            'pct': round((swap_total - swap_free) * 100 / swap_total),
        } if swap_total else None),
        'disks': disk_info,
        'procs': procs,
        'docker': docker,
        'note': None,
    }


# --------------------------------------------------------------- hermes state
def q(db: str, sql: str, params: tuple = ()) -> list[tuple]:
    try:
        import sqlite3
        con = sqlite3.connect(f'file:{db}?mode=ro', uri=True, timeout=5)
        try:
            return list(con.execute(sql, params))
        finally:
            con.close()
    except Exception:
        return []


def hermes_state(home: str, heartbeat_url: str | None) -> dict:
    cron_dir = os.path.join(home, 'cron')
    state_db = os.path.join(home, 'state.db')
    out: dict = {
        'node': '',
        'gateway': {'running': False, 'pid': None, 'state': 'down', 'updated_at': None,
                    'active_agents': 0, 'platforms': []},
        'cron': [],
        'recent': [],
        'heartbeat': None,
        'sessions_24h': 0,
        'messages_24h': 0,
        'note': None,
    }

    # gateway
    try:
        gw = json.load(open(os.path.join(home, 'gateway_state.json')))
        plat = [{'name': k, 'state': (v or {}).get('state', '?')}
                for k, v in (gw.get('platforms') or {}).items()]
        updated = None
        for v in (gw.get('platforms') or {}).values():
            if isinstance(v, dict) and v.get('updated_at'):
                updated = v['updated_at']
        # файл gateway_state.json переживает падение процесса: «running» в нём ничего
        # не доказывает, поэтому состояние подтверждаем живостью PID (kill -0).
        pid = gw.get('pid')
        alive = False
        if pid:
            try:
                os.kill(int(pid), 0)
                alive = True
            except (OSError, ValueError):
                alive = False
        declared = gw.get('gateway_state') == 'running'
        unit_state = systemd_unit_state('hermes-gateway.service')
        running = bool(declared and alive)
        if running:
            state = 'running'
        elif declared and not alive:
            state = 'stale'          # процесс мёртв, state-файл врёт
        else:
            state = gw.get('gateway_state') or 'down'
        out['gateway'] = {
            'running': running,
            'pid': pid,
            'pid_alive': alive,
            'state': state,
            'unit_state': unit_state,
            'updated_at': updated,
            'active_agents': gw.get('active_agents') or 0,
            'platforms': plat,
        }
        if state == 'stale':
            out['note'] = ('gateway: процесс не найден, а state-файл говорит «running» '
                           f'(последняя запись {updated or "—"})')
        elif not running:
            out['note'] = f"gateway: {gw.get('exit_reason') or 'не запущен'}"
    except Exception:
        out['note'] = 'gateway_state.json недоступен'

    # cron jobs
    jobs = []
    try:
        raw = json.load(open(os.path.join(cron_dir, 'jobs.json')))
        jobs = raw['jobs'] if isinstance(raw, dict) else raw
    except Exception:
        jobs = []

    by_id = {j.get('id'): j for j in jobs if isinstance(j, dict)}
    exec_db = os.path.join(cron_dir, 'executions.db')

    for j in jobs:
        jid = j.get('id')
        sched = j.get('schedule_display') or (j.get('schedule') or {}).get('display') or \
                (j.get('schedule') or {}).get('expr') or '—'
        runs = q(exec_db, 'select count(*) from executions where job_id=?', (jid,))
        fails = q(exec_db, "select count(*) from executions where job_id=? and status='failed'", (jid,))
        out['cron'].append({
            'id': jid,
            'name': j.get('name') or jid,
            'schedule': sched,
            'enabled': bool(j.get('enabled', True)),
            'last_run': j.get('last_run_at'),
            'last_status': j.get('last_status'),
            'last_error': (j.get('last_error') or None) and str(j.get('last_error'))[:200],
            'next_run': j.get('next_run_at'),
            'runs': runs[0][0] if runs else 0,
            'fails': fails[0][0] if fails else 0,
        })

    # последние запуски
    rows = q(
        exec_db,
        'select job_id, started_at, finished_at, status, error from executions '
        'order by coalesce(finished_at, started_at) desc limit 12',
    )
    for job_id, started, finished, status, error in rows:
        dur = None
        if started and finished:
            try:
                a = datetime.fromisoformat(started)
                b = datetime.fromisoformat(finished)
                dur = (b - a).total_seconds()
            except Exception:
                dur = None
        out['recent'].append({
            'job': (by_id.get(job_id) or {}).get('name') or job_id,
            'started': (started or '')[:19].replace('T', ' '),
            'status': status or '?',
            'duration_s': round(dur) if dur is not None and dur >= 0 else None,
            'error': (error or '')[:200] or None,
        })

    # активность за сутки
    since = time.time() - 86400
    s = q(state_db, 'select count(*) from sessions where started_at > ?', (since,))
    m = q(state_db, 'select count(*) from messages where timestamp > ?', (since,))
    out['sessions_24h'] = s[0][0] if s else 0
    out['messages_24h'] = m[0][0] if m else 0

    # HA-heartbeat (арбитр в gist)
    if heartbeat_url:
        try:
            import urllib.request
            with urllib.request.urlopen(heartbeat_url, timeout=8) as r:
                hb = json.loads(r.read().decode())
            out['heartbeat'] = {'role': hb.get('role', '?'), 'gateway': hb.get('gateway', '?'),
                                'ts': hb.get('ts')}
        except Exception:
            out['heartbeat'] = None

    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--name', required=True, help='id узла (vps, pc)')
    ap.add_argument('--label', default='', help='человекочитаемое имя')
    ap.add_argument('--kind', default='linux', help='тип узла для подписи')
    ap.add_argument('--hermes-home', default=os.path.expanduser('~/.hermes'))
    ap.add_argument('--out', default='-')
    ap.add_argument('--disks', default='/', help='через запятую')
    ap.add_argument('--heartbeat-url', default='')
    ap.add_argument('--push', default='', help='ssh-хост: положить снимок на VPS (state/<name>.json)')
    args = ap.parse_args()

    disks = [d for d in args.disks.split(',') if d]
    # авто-добавление Windows-диска в WSL
    for extra in ('/mnt/c',):
        if os.path.isdir(extra) and extra not in disks:
            disks.append(extra)

    hosts = host_metrics(disks)
    hosts['name'] = args.label or args.name
    hosts['kind'] = args.kind

    hermes = hermes_state(args.hermes_home, args.heartbeat_url or None)
    hermes['node'] = args.name

    snapshot = {'name': args.name, 'collected_at': ISO(), 'host': hosts, 'hermes': hermes}
    text = json.dumps(snapshot, ensure_ascii=False, indent=1)

    if args.out == '-':
        print(text)
    else:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, 'w') as f:
            f.write(text)

    if args.push:
        target = f'{args.push}:/root/hermes-ops/state/{args.name}.json'
        r = subprocess.run(
            ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', args.push,
             f'cat > /root/hermes-ops/state/{args.name}.json'],
            input=text, text=True, capture_output=True, timeout=40,
        )
        if r.returncode != 0:
            print(f'push failed: {r.stderr.strip()}', file=sys.stderr)
            return 2
        print(f'pushed → {target}')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
