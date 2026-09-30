import pytest

from app.services.generation import question_split


@pytest.mark.parametrize("counts,total,expected", [
    ([8, 1, 1], 10, [8, 1, 1]),
    ([5, 5, 5], 3, [1, 1, 1]),
    ([5, 5, 5], 2, [1, 1, 0]),
    ([0, 4], 7, [0, 7]),
    ([0, 0], 3, [2, 1]),
])
def test_split(counts, total, expected):
    split = question_split(dict(enumerate(counts, 1)), total)
    assert [share["num_questions"] for share in split] == expected
    assert sum(share["num_questions"] for share in split) == total


@pytest.mark.parametrize("total", range(1, 101))
def test_rounding_preserves_total(total):
    split = question_split({9: 17, 3: 29, 1: 7, 4: 0}, total)
    assert sum(share["num_questions"] for share in split) == total
    assert split[-2] == {"source_id": 4, "num_questions": 0}


def test_ties_use_id_not_input_order():
    assert question_split({30: 5, 10: 5, 20: 5}, 2) == [
        {"source_id": 10, "num_questions": 1},
        {"source_id": 20, "num_questions": 1},
        {"source_id": 30, "num_questions": 0},
    ]
