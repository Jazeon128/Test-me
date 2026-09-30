import re
from urllib.parse import quote, unquote

import pytest


@pytest.mark.parametrize("name", ["日本語", 'a"b', "plain"])
@pytest.mark.parametrize("api", ["decks", "tests"])
@pytest.mark.parametrize("format", ["anki", "csv", "anki-csv"])
def test_export_filename_header(client, db_session, sample_test, name, api, format):
    sample_test.name = name
    db_session.commit()
    response = client.get(f"/api/{api}/{sample_test.id}/export/{format}")
    assert response.status_code == 200
    assert response.content
    suffix = {"anki": ".apkg", "csv": ".csv", "anki-csv": "_AllInOne.csv"}[format]
    filename = name + suffix
    fallback = "".join(c if c.isascii() and c not in '\\"' else "_" for c in filename)
    header = response.headers["content-disposition"]
    assert header == f'attachment; filename="{fallback}"; filename*=UTF-8\'\'{quote(filename, safe="")}'
    assert re.fullmatch(r'attachment; filename="[^"\\]*"; filename\*=UTF-8\'\'[^\s]+', header)
    header.encode("ascii")
    assert unquote(header.split("UTF-8''", 1)[1]) == filename


@pytest.mark.parametrize("filename,expected", [("", "export"), (".csv", "export.csv"), ('a\\b".csv', "a_b_.csv")])
def test_filename_fallback(filename, expected):
    from app.utils.http_headers import content_disposition

    assert content_disposition(filename).startswith(f'attachment; filename="{expected}";')
