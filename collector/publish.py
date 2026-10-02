#!/usr/bin/env python3
"""Сборка, шифрование и публикация данных дашборда hermes-ops.

Читает снимки узлов из state/*.json, ведёт историю (state/history.json),
собирает payload, шифрует его OpenSSL'ом (AES-256-CBC, PBKDF2-SHA256, 200k)
и пушит в публичную репу hermes-ops-data одним коммитом (amend + force push,
чтобы история репозитория не пухла от снапшота каждые 5 минут).

Запускается по cron на VPS. Пароль шифрования: /root/hermes-ops/.pass
"""
from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone

BASE = '/root/hermes-ops'
STATE = os.path.join(BASE, 'state')
REPO = os.path.join(BASE, 'data-repo')
PASSFILE = os.path.join(BASE, '.pass')
HISTORY = os.path.join(STATE, 'history.json')
OUT_NAME = 'status.v1.json'
MAX_POINTS = 288  # 24 часа при шаге 5 минут
STALE_S = 900  # после 15 минут молчания узел считается offline

ISO = lambda: datetime.now(timezone.utc).isoformat(timespec='seconds')


def run(cmd: list[str] | str, cwd: str | None = None, check: bool = False) -> tuple[int, str, str]:
    r = subprocess.run(cmd, shell=isinstance(cmd, str), cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f'{cmd}: {r.stderr.strip()[:300]}')
    return r.returncode, r.stdout.strip(), r.stderr.strip()


def load_snapshot(name: str) -> dict | None:
    path = os.path.join(STATE, f'{name}.json')
    if not os.path.exists(path):
        return None
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


def age_s(iso: str | None) -> float | None:
    if not iso:
        return None
    try:
        return (datetime.now(timezone.utc) - datetime.fromisoformat(iso)).total_seconds()
    except Exception:
        return None


def update_history(name: str, host: dict, hist: dict) -> None:
    series = hist.setdefault(name, [])
    point = {
        't': int(time.time()),
        'load1': host['load']['m1'],
        'mem_pct': host['mem']['pct'],
        'disk_pct': host['disks'][0]['pct'] if host.get('disks') else 0,
    }
    if series and series[-1]['t'] == point['t']:
        series[-1] = point
    else:
        series.append(point)
    del series[:-MAX_POINTS]


def build_notes(hosts: dict, hermes: dict) -> list[str]:
    notes: list[str] = []
    for key, h in hosts.items():
        if not h['online']:
            notes.append(f'{h["name"]}: узел не выходит на связь ({round((h["stale_s"] or 0) / 60)} мин).')
            continue
        if h['mem']['pct'] >= 90:
            notes.append(f'{h["name"]}: память {h["mem"]["pct"]}% — риск OOM.')
        for d in h.get('disks', []):
            if d['pct'] >= 85:
                notes.append(f'{h["name"]}: диск {d["mount"]} заполнен на {d["pct"]}%.')
        if h['load']['m1'] > h['cpu_count'] * 2:
            notes.append(f'{h["name"]}: load {h["load"]["m1"]} при {h["cpu_count"]} vCPU.')
    for key, n in hermes.items():
        if not n['gateway']['running']:
            notes.append(f'Hermes ({key}): gateway не запущен.')
        for plat in n['gateway']['platforms']:
            if plat['state'] not in ('connected',):
                notes.append(f'Hermes ({key}): платформа {plat["name"]} — {plat["state"]}.')
        for j in n['cron']:
            st = (j.get('last_status') or '').lower()
            if st and st not in ('ok', 'success', 'completed'):
                notes.append(f'Джоб «{j["name"]}» ({key}): последний статус {j["last_status"]}.')
    return notes[:12]


def main() -> int:
    if not os.path.exists(PASSFILE):
        print(f'нет файла с паролем: {PASSFILE}', file=sys.stderr)
        return 2
    os.makedirs(STATE, exist_ok=True)

    try:
        with open(HISTORY) as f:
            hist = json.load(f)
    except Exception:
        hist = {}

    hosts, hermes, missing = {}, {}, []
    for key in ('vps', 'pc'):
        snap = load_snapshot(key)
        if not snap:
            missing.append(key)
            continue
        host = dict(snap['host'])
        node = dict(snap['hermes'])
        host['last_seen'] = snap.get('collected_at')
        stale = age_s(host['last_seen'])
        host['stale_s'] = round(stale) if stale is not None else None
        host['online'] = True if key == 'vps' else bool(stale is not None and stale < STALE_S)
        hosts[key] = host
        hermes[key] = node
        if host['online']:
            update_history(key, host, hist)

    payload = {
        'schema': 1,
        'generated_at': ISO(),
        'hosts': hosts,
        'hermes': hermes,
        'history': {k: v[-MAX_POINTS:] for k, v in hist.items() if k in hosts},
        'notes': build_notes(hosts, hermes),
    }
    if missing:
        payload['notes'].append('Нет снимка узла: ' + ', '.join(missing) + '.')

    with open(HISTORY, 'w') as f:
        json.dump(hist, f)

    plain_path = os.path.join(STATE, 'plain.json')
    enc_path = os.path.join(STATE, 'status.enc')
    with open(plain_path, 'w') as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    os.chmod(plain_path, 0o600)

    code, _, err = run([
        'openssl', 'enc', '-aes-256-cbc', '-pbkdf2', '-iter', '200000', '-salt',
        '-in', plain_path, '-out', enc_path, '-pass', f'file:{PASSFILE}',
    ])
    if code != 0:
        print('openssl encrypt failed: ' + err, file=sys.stderr)
        return 3

    envelope = {
        'v': 1,
        'alg': 'AES-256-CBC/PBKDF2-SHA256/200000',
        'generated_at': payload['generated_at'],
        'data': base64.b64encode(open(enc_path, 'rb').read()).decode(),
    }

    os.makedirs(REPO, exist_ok=True)
    out_path = os.path.join(REPO, OUT_NAME)
    with open(out_path, 'w') as f:
        json.dump(envelope, f)

    if not os.path.isdir(os.path.join(REPO, '.git')):
        run(['git', 'init', '-q', '-b', 'main'], cwd=REPO, check=True)
        run(['git', 'remote', 'add', 'origin',
             'https://github.com/dwarf-alviss/hermes-ops-data.git'], cwd=REPO)
        run(['git', 'config', 'user.email', 'dwarf-alviss@users.noreply.github.com'], cwd=REPO)
        run(['git', 'config', 'user.name', 'dwarf-alviss'], cwd=REPO)

    with open(os.path.join(REPO, 'README.md'), 'w') as f:
        f.write('# hermes-ops-data\n\nЗашифрованный снапшот дашборда '
                '[hermes-ops](https://github.com/dwarf-alviss/hermes-ops). '
                'Без пароля не читается.\n')

    run(['git', 'add', '-A'], cwd=REPO, check=True)
    code, _, err = run(['git', 'commit', '-q', '-m', f'snapshot {payload["generated_at"]}'], cwd=REPO)
    if code != 0:
        run(['git', 'commit', '-q', '--amend', '--no-edit'], cwd=REPO, check=True)

    # один снапшот в истории: amend + force push
    run(['git', 'commit', '-q', '--amend', '--no-edit'], cwd=REPO)
    code, out, err = run(['git', 'push', '-q', '-f', 'origin', 'main'], cwd=REPO, check=False)
    if code != 0 and 'set-upstream' in err + out:
        code, out, err = run(['git', 'push', '-q', '-f', '-u', 'origin', 'main'], cwd=REPO)
    if code != 0:
        print('push failed: ' + (err or out), file=sys.stderr)
        return 4

    print(f'ok {payload["generated_at"]} hosts={list(hosts)} notes={len(payload["notes"])} '
          f'bytes={os.path.getsize(out_path)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
