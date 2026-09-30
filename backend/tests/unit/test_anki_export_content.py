import json
import re
import sqlite3
import zipfile

import pytest

from app.services.anki_export import AnkiExporter


@pytest.mark.parametrize("correct_index", range(4))
def test_exported_anki_content(sample_question, tmp_path, correct_index):
    sample_question.question_text = 'What is List<T>?\n"Examples" & details'
    sample_question.explanation = "Use <T>\nA & B"
    sample_question.source_reference = {"text": "Use <stdio.h>\nA & B"}
    for option in sample_question.options:
        option.option_text = "Use <stdio.h>\nA & B"
        option.is_correct = option.order == correct_index
    sample_question.options.reverse()

    exporter = AnkiExporter()
    path = tmp_path / "content.apkg"
    exporter.export_questions([sample_question], "Content", str(path))
    with zipfile.ZipFile(path) as package:
        package.extract("collection.anki2", tmp_path)
    with sqlite3.connect(tmp_path / "collection.anki2") as connection:
        fields = connection.execute("SELECT flds FROM notes").fetchone()[0].split("\x1f")
        models = json.loads(connection.execute("SELECT models FROM col").fetchone()[0])

    model = models[str(exporter.model.model_id)]
    names = [field["name"] for field in model["flds"]]
    assert names[-4:] == ["CorrectA", "CorrectB", "CorrectC", "CorrectD"]
    assert len(fields) == len(names)
    content = dict(zip(names, fields))
    assert content["Question"] == 'What is List&lt;T&gt;?<br>"Examples" &amp; details'
    for letter in "ABCD":
        assert content[f"Option{letter}"] == "Use &lt;stdio.h&gt;<br>A &amp; B"
        assert content[f"Correct{letter}"] == ("1" if letter == "ABCD"[correct_index] else "")
    assert content["CorrectAnswer"] == "ABCD"[correct_index]
    assert content["Explanation"] == "Use &lt;T&gt;<br>A &amp; B"
    assert content["Reference"] == '"Use &lt;stdio.h&gt;<br>A &amp; B"'
    conditionals = set()
    for template in model["tmpls"]:
        for side in ("qfmt", "afmt"):
            conditionals.update(re.findall(r"{{#(Correct[A-D])}}", template[side]))
    assert conditionals == {"CorrectA", "CorrectB", "CorrectC", "CorrectD"}
    assert conditionals <= set(names)
    assert AnkiExporter().model.model_id == exporter.model.model_id
