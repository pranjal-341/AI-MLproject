"""Run common project tasks from any working directory, without exposing secrets."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parents[1]


def python():
    executable = ROOT / ('venv/Scripts/python.exe' if os.name == 'nt' else 'venv/bin/python')
    return str(executable) if executable.is_file() else sys.executable


def npm(*args):
    executable = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
    if not executable:
        raise RuntimeError('Install Node.js 24 and npm before running frontend tasks.')
    return [executable, *args]


def run(command, frontend=False):
    subprocess.run(command, cwd=ROOT / 'frontend' if frontend else ROOT, check=True)


def doctor():
    required = ['.env', 'frontend/.env.local', 'frontend/node_modules', 'data/raw/MdrDB_Full_Scraped.csv']
    required += [f'models/{algorithm}/model_{tier}/model.joblib' for algorithm in ('linear_regression', 'decision_tree', 'random_forest') for tier in 'ABC']
    ready = True
    for relative in required:
        path = ROOT / relative
        ok = path.exists()
        if ok and path.suffix in {'.csv', '.joblib'}:
            with path.open('rb') as handle:
                prefix = handle.read(128)
            ok = bool(prefix) and not prefix.startswith(b'version https://git-lfs.github.com/spec/')
        ready &= ok
        print(f'{"OK" if ok else "MISSING OR LFS POINTER"}: {relative}')
    print('Checks file presence only. Start the API and inspect /api/dashboard for model readiness.')
    return 0 if ready else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('task', choices=['doctor', 'backend', 'frontend', 'test', 'check', 'build', 'verify-models'])
    args = parser.parse_args()
    if args.task == 'doctor':
        return doctor()
    if args.task == 'backend':
        run([python(), '-m', 'uvicorn', 'backend.app.main:app', '--reload'])
    elif args.task == 'frontend':
        run(npm('run', 'dev', '--', '--port', '3000'), frontend=True)
    elif args.task in {'test', 'check'}:
        # Keep each test run inside the workspace; do not reuse/delete another run's temp directory.
        temporary = ROOT / '.pytest_cache' / ('run-' + uuid.uuid4().hex)
        run([python(), '-m', 'pytest', 'tests', '-q', '--tb=short', '--basetemp=' + str(temporary)])
        if args.task == 'check':
            run(npm('run', 'typecheck'), frontend=True)
            run(npm('run', 'test:deployment'), frontend=True)
    elif args.task == 'build':
        run(npm('run', 'build'), frontend=True)
    elif args.task == 'verify-models':
        run([python(), '-m', 'backend.training.verify'])
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (RuntimeError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
    except subprocess.CalledProcessError as exc:
        raise SystemExit(exc.returncode)
    except KeyboardInterrupt:
        raise SystemExit(130)
