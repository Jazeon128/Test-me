"""Standard-library uncertainty and agreement calculations."""

import math
import random


def wilson(successes, total):
    if not total:
        return (0.0, 1.0)
    z = 1.959963984540054
    p = successes / total
    denominator = 1 + z * z / total
    center = (p + z * z / (2 * total)) / denominator
    radius = z * math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denominator
    return max(0, center - radius), min(1, center + radius)


def agreement(pairs):
    pairs = list(pairs)
    n = len(pairs)
    if not n:
        return {'n': 0, 'percent': None, 'kappa': None}
    observed = sum(a == b for a, b in pairs) / n
    labels = {x for pair in pairs for x in pair}
    expected = sum(sum(a == label for a, _ in pairs) *
                   sum(b == label for _, b in pairs) / n ** 2 for label in labels)
    return {'n': n, 'percent': observed * 100,
            'kappa': (observed - expected) / (1 - expected) if expected < 1 else None}


def bootstrap(left, right, seed, resamples=2000):
    """Inputs map passage IDs to binary question outcomes. Pair shared passages."""
    shared = sorted(set(left) & set(right))
    if not shared:
        return None

    def difference(ids):
        a = [v for identifier in ids for v in left[identifier]]
        b = [v for identifier in ids for v in right[identifier]]
        return sum(a) / len(a) - sum(b) / len(b)

    rng = random.Random(seed)
    values = sorted(difference(rng.choices(shared, k=len(shared))) for _ in range(resamples))
    return difference(shared), values[int(.025 * resamples)], values[int(.975 * resamples) - 1]
