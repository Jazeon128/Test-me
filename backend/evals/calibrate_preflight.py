"""Offline report maths and budgeted calibration. Run: python -m evals.calibrate_preflight."""

import argparse
import csv
import json
import math
import os
from pathlib import Path
from unittest.mock import patch

from app.services.ai import sourcing
from . import corpus
from .budget import Budget, run_lock
from .config import ROOT, digest, load, write

FLOORS = [value / 100 for value in range(30, 81, 5)]
LABELS = {"study": False, "not": True, "not study": True, "not_study": True,
          "not-study": True}


def wilson(successes, total):
    """95% Wilson score interval. Undefined metrics have no interval."""
    if not total:
        return None
    z = 1.959963984540054
    proportion = successes / total
    denominator = 1 + z * z / total
    centre = (proportion + z * z / (2 * total)) / denominator
    radius = z * math.sqrt(proportion * (1 - proportion) / total
                           + z * z / (4 * total * total)) / denominator
    return [0.0 if successes == 0 else max(0.0, centre - radius),
            1.0 if successes == total else min(1.0, centre + radius)]


def rejected(score, floor=None):
    if not score["checked"]:
        return False
    if floor is None:
        return score["is_teachable"] < sourcing.TEACHABLE_FLOOR
    return (score["reason"] == "empty"
            or score["is_teachable"] < sourcing.TEACHABLE_FLOOR
            or score["has_study_content"] < floor)


def metrics(records, floor=None):
    matrix = dict(tp=0, fp=0, tn=0, fn=0)
    for record in records:
        actual = record["not_study"]
        predicted = rejected(record["score"], floor)
        cell = ("tp" if actual else "fp") if predicted else ("fn" if actual else "tn")
        matrix[cell] += 1
    tp, fp, fn = matrix["tp"], matrix["fp"], matrix["fn"]
    return {"confusion_matrix": matrix,
            "precision": tp / (tp + fp) if tp + fp else None,
            "precision_95_wilson": wilson(tp, tp + fp),
            "recall": tp / (tp + fn) if tp + fn else None,
            "recall_95_wilson": wilson(tp, tp + fn),
            "study_source_rejections": fp}


def report(records):
    sweep = [dict(floor=floor, **metrics(records, floor)) for floor in FLOORS]
    eligible = [row for row in sweep if row["study_source_rejections"] <= 1]
    best = max(eligible, key=lambda row: (
        row["recall"] or 0, -row["study_source_rejections"], -row["floor"],
    ), default=None)
    return {"positive_class": "not study", "labelled_rows": len(records),
            "old_rule": metrics(records),
            "new_rule": metrics(records, sourcing.STUDY_CONTENT_FLOOR),
            "floor_sweep": sweep, "recommended_floor": best["floor"] if best else None,
            "unchecked_rows": sum(not record["score"]["checked"] for record in records)}


def labelled_rows(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    labelled = []
    for row in rows:
        label = row["label_study_or_not"].strip().lower()
        if not label:
            continue
        if label not in LABELS:
            raise ValueError(f"Unknown label: {label!r}")
        labelled.append(dict(row, not_study=LABELS[label]))
    if len(labelled) < 20:
        raise ValueError("Calibration requires at least 20 labelled rows")
    return labelled


def score_rows(rows, key, budget, cache_path, assessor=None):
    assessor = assessor or corpus.assess
    cache = load(cache_path) if Path(cache_path).exists() else {}
    records = []
    for row in rows:
        path = Path(row["path"])
        sha = digest(path.read_bytes())
        preparation = corpus.prepared(path, sha, row["set"])
        cache_key = preparation[2]
        if cache_key not in cache or not cache[cache_key]["checked"]:
            # Calibration keeps usage in its own ledger, never the application DB.
            with patch.object(corpus.jev, "record"):
                cache[cache_key] = assessor(path, key, budget, sha, row["set"], preparation)
            write(cache_path, cache)
        records.append({"file": row["file"], "set": row["set"],
                        "not_study": row["not_study"], "score": cache[cache_key]})
    return records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--labels", type=Path, default=ROOT / "corpus" / "preflight_labels.csv")
    parser.add_argument("--output", type=Path, default=ROOT / "corpus" / "preflight_calibration")
    parser.add_argument("--cap", default="0.25")
    args = parser.parse_args()
    rows = labelled_rows(args.labels)
    key = os.environ.get("TYPESAFE_API_KEY", "")
    if not key:
        parser.error("Set TYPESAFE_API_KEY to run calibration")
    with run_lock(args.output):
        budget = Budget(args.output / "calibration_ledger.jsonl", args.cap,
                        phase="calibration", recover=True)
        records = score_rows(rows, key, budget, args.output / "screen_cache.json")
        result = report(records)
        result["model"] = sourcing.PREFLIGHT_MODEL
        result["spent_or_reserved_usd"] = str(budget.total)
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
