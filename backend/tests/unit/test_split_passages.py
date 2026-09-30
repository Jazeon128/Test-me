from app.services.passages import split_passages
from app.services.parsers.base_parser import ParsedSection


def test_exact_limit():
    passages = split_passages([ParsedSection("x" * 1500)])
    assert len(passages) == 1
    assert passages[0]["text"] == "x" * 1500


def test_hard_cut_overlap():
    text = "x" * 4000
    passages = split_passages([ParsedSection(text)])
    assert [(p["char_start"], p["char_end"]) for p in passages] == [
        (0, 1500), (1300, 2800), (2600, 4000),
    ]
    assert all(len(p["text"]) <= 1500 for p in passages)
    for previous, current in zip(passages, passages[1:]):
        assert previous["text"][-200:] == current["text"][:200]


def test_whitespace_break_overlap():
    text = ("a" * 99 + " ") * 40
    passages = split_passages([ParsedSection(text)])
    assert passages[0]["char_end"] == 1499
    for previous, current in zip(passages, passages[1:]):
        raw_start = previous["char_end"] - 200
        stripped_start = raw_start + len(text[raw_start:]) - len(text[raw_start:].lstrip())
        assert current["char_start"] == stripped_start
        overlap = previous["char_end"] - current["char_start"]
        assert previous["text"][-overlap:] == current["text"][:overlap]
    assert all(len(p["text"]) <= 1500 for p in passages)
    assert all(text[p["char_start"]:p["char_end"]] == p["text"] for p in passages)


def test_sections_and_locators():
    passages = split_passages([
        ParsedSection(" a ", page=3), ParsedSection("b", section="Topic"),
        ParsedSection("c"),
    ])
    assert [p["ordinal"] for p in passages] == [0, 1, 2]
    assert [p["section_index"] for p in passages] == [0, 1, 2]
    assert [p["locator"] for p in passages] == ["Page 3", "Section: Topic", "Part 3"]
    assert [p["text"] for p in passages] == ["a", "b", "c"]
    assert [p["char_start"] for p in passages] == [1, 0, 0]


def test_no_overlap_across_sections():
    passages = split_passages([ParsedSection("x" * 1600), ParsedSection("y" * 100)])
    assert passages[-1]["char_start"] == 0
    assert passages[-1]["text"] == "y" * 100


def test_empty():
    assert split_passages([]) == []
    assert split_passages([ParsedSection(""), ParsedSection(" " * 4000)]) == []
