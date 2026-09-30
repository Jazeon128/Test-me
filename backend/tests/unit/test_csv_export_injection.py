import csv
from io import StringIO

import pytest

from app.services.anki_all_in_one_export import AnkiAllInOneExporter
from app.services.csv_export import CSVExporter


@pytest.mark.parametrize("text", ["=1+1", "+1", "-1", "@SUM(A1)", "\tvalue", "\rvalue", "plain text", ""])
@pytest.mark.parametrize("method", ["export_to_string", "export_questions", "export_test"])
def test_spreadsheet_csv_cells(sample_test, tmp_path, text, method):
    question = sample_test.questions[0]
    question.question_text = text
    question.explanation = text
    question.difficulty = text
    for option in question.options:
        option.option_text = text

    exporter = CSVExporter()
    path = tmp_path / "spreadsheet.csv"
    if method == "export_to_string":
        content = exporter.export_to_string([question])
    else:
        if method == "export_questions":
            exporter.export_questions([question], str(path))
        else:
            exporter.export_test(None, sample_test, str(path))
        with path.open(encoding="utf-8-sig", newline="") as file:
            content = file.read()
    row = next(csv.DictReader(StringIO(content)))
    expected = "'" + text if text.startswith(("=", "+", "-", "@", "\t", "\r")) else text
    assert row["Question"] == expected
    for letter in "ABCD":
        assert row[f"Option{letter}"] == expected
    assert row["Explanation"] == (expected or "No explanation provided.")
    assert row["Difficulty"] == (expected or "medium")
    assert row["CorrectAnswer"] == "A"
    assert row["Source"] == 'Page 1, Section: Introduction, "Python programming"'


def test_anki_csv_keeps_formula_and_escapes_html(sample_test, tmp_path):
    question = sample_test.questions[0]
    question.question_text = "=1+1"
    question.explanation = '=1+1 <T>\n"A" & B'
    for option in question.options:
        option.option_text = "=1+1 <stdio.h>\nA & B"
    path = tmp_path / "anki.csv"
    AnkiAllInOneExporter().export_test(None, sample_test, str(path))
    with path.open(encoding="utf-8-sig", newline="") as file:
        row = next(csv.DictReader(file))
    assert row["Question"] == "=1+1"
    for index in range(1, 5):
        assert row[f"Q_{index}"] == "=1+1 &lt;stdio.h&gt;<br>A &amp; B"
    assert '=1+1 &lt;T&gt;<br>"A" &amp; B' in row["Extra 1"]
    assert "=1+1 &lt;stdio.h&gt;<br>A &amp; B" in row["Extra 1"]
    assert '<div class="explanation">' in row["Extra 1"]
    assert "<li><strong>Option A:</strong>" in row["Extra 1"]
    assert "<stdio.h>" not in row["Extra 1"]
    question.question_text = "What is List<T>?\nA & B"
    AnkiAllInOneExporter().export_test(None, sample_test, str(path))
    with path.open(encoding="utf-8-sig", newline="") as file:
        row = next(csv.DictReader(file))
    assert row["Question"] == "What is List&lt;T&gt;?<br>A &amp; B"
