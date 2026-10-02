from app.models.passage import DocumentPassage


def test_passages_order_and_fields(client, db_session, sample_document):
    for ordinal, page, heading, text in [(2, None, None, "Second"), (1, 3, "Intro", "First")]:
        db_session.add(DocumentPassage(
            document_id=sample_document.id, ordinal=ordinal, section_index=0,
            page=page, heading=heading, text=text, locator="test",
            char_start=0, char_end=len(text),
        ))
    db_session.commit()
    response = client.get(f"/api/documents/{sample_document.id}/passages")
    assert response.status_code == 200
    assert response.json() == {
        "document_id": sample_document.id,
        "passages": [
            {"ordinal": 1, "page": 3, "heading": "Intro", "text": "First"},
            {"ordinal": 2, "page": None, "heading": None, "text": "Second"},
        ],
    }


def test_missing_document_passages(client):
    assert client.get("/api/documents/999999/passages").status_code == 404


def test_document_without_passages(client, sample_document):
    response = client.get(f"/api/documents/{sample_document.id}/passages")
    assert response.json() == {"document_id": sample_document.id, "passages": []}
