"""Manual harness CLI."""

import argparse

from . import checks, corpus, generate
from .config import load, run_path, write


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['freeze', 'generate', 'check'])
    parser.add_argument('--config', default='evals/pilot.json')
    parser.add_argument('--run')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    if args.command == 'freeze':
        corpus.freeze(load(args.config))
        return
    if not args.run:
        parser.error('--run is required')
    directory = run_path(args.run)
    if args.command == 'check':
        checks.check(directory)
        return
    config = load(args.config)
    if args.dry_run:
        # Dry-run must never fetch the catalog. An optional saved public catalog
        # provides prices offline. Missing prices remain unknown, never invented.
        prices = config.get('catalog_prices', {})
    else:
        from app.services.ai.openrouter_catalog import get_models
        prices = {m['id']: m for m in get_models()['models']}
        snapshot = directory / 'config.json'
        if snapshot.exists() and load(snapshot) != config:
            parser.error('Run configuration changed. Use a new run name.')
        write(snapshot, config)
    generate.generate(config, corpus.frozen(config), directory, prices, dry=args.dry_run)


if __name__ == '__main__':
    main()
