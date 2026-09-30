import logging

import pytest

from app.services.ai import completion


@pytest.mark.parametrize('status', [None, 418])
def test_connection_failure_redacts_response_and_logs(client, monkeypatch, caplog, status):
    configured_key = 'FAKE_CONFIGURED_KEY_456'
    assert client.post('/api/settings/ai-config', json={
        'provider': 'gemini', 'api_key': configured_key, 'model': 'fake-model',
    }).status_code == 200

    class ProviderError(Exception):
        status_code = status

    def fail(*args, **kwargs):
        raise ProviderError(f'{configured_key} https://example.test/?key=FAKE_SECRET_123&model=fake')

    monkeypatch.setattr(completion, 'complete', fail)
    with caplog.at_level(logging.WARNING):
        response = client.post('/api/settings/ai-config/test')
    assert response.status_code == 400
    assert '[redacted]' in response.text
    assert caplog.records
    for secret in [configured_key, 'FAKE_SECRET_123']:
        assert secret not in response.text
        assert all(secret not in record.getMessage() for record in caplog.records)
