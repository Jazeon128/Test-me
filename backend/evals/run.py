"""Manual harness CLI."""

import argparse

from . import checks, corpus, generate, judge, report, review
from .config import load, run_path, write


def generation_settings(config):
    """Settings that change what generate produces. Judge settings may change mid-run."""
    return {key: value for key, value in config.items() if not key.startswith('judge')}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['freeze', 'generate', 'check', 'judge', 'report', 'agreement'])
    parser.add_argument('--config', default='evals/pilot.json')
    parser.add_argument('--run')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--no-screen', action='store_true', help='Freeze without paid source screening')
    args = parser.parse_args()
    if args.command == 'freeze':
        try:
            corpus.freeze(load(args.config), no_screen=args.no_screen)
        except ValueError as error:
            parser.error(str(error))
        return
    if not args.run:
        parser.error('--run is required')
    directory = run_path(args.run)
    offline_commands = {'report': report.report, 'agreement': review.review_agreement,
                        'check': checks.check}
    if args.command in offline_commands:
        offline_commands[args.command](directory)
        return
    if args.command == 'judge':
        config = load(args.config)
        judge.judge(config, directory, config.get('catalog_prices', {}), dry=args.dry_run)
        return
    generate_run(args, directory, parser)


def generate_run(args, directory, parser):
    try:
        config = load(args.config)
    except ValueError as error:
        parser.error(str(error))
    if args.dry_run:
        # Dry-run must never fetch the catalog. An optional saved public catalog
        # provides prices offline. Missing prices remain unknown, never invented.
        prices = config.get('catalog_prices', {})
    else:
        from app.services.ai.openrouter_catalog import get_models
        prices = {m['id']: m for m in get_models()['models']}
        snapshot = directory / 'config.json'
        if snapshot.exists() and generation_settings(load(snapshot)) != generation_settings(config):
            parser.error('Run configuration changed. Use a new run name.')
        write(snapshot, config)
    generate.generate(config, corpus.frozen(config), directory, prices, dry=args.dry_run)


if __name__ == '__main__':
    main()
