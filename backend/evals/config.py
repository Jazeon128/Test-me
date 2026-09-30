"""Configuration and stable artifact serialization."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).parent


def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def digest(value):
    if isinstance(value, str):
        value = value.encode('utf-8')
    return hashlib.sha256(value).hexdigest()


def write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + '\n',
                    encoding='utf-8')


def append(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a', encoding='utf-8') as stream:
        stream.write(json.dumps(value, sort_keys=True, ensure_ascii=False) + '\n')
        stream.flush()


def rows(path):
    path = Path(path)
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines()]


def run_path(name):
    if not name or Path(name).name != name or name in {'.', '..'}:
        raise ValueError('Run name must be a single directory name')
    return ROOT / 'runs' / name
