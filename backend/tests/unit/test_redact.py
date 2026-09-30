import pytest


def test_configured_secret_and_other_text():
    from app.utils.redact import redact_secrets

    assert redact_secrets('failed FAKE_CONFIGURED_KEY twice FAKE_CONFIGURED_KEY', ['', 'FAKE_CONFIGURED_KEY']) == 'failed [redacted] twice [redacted]'
    assert redact_secrets('ordinary text ?model=example&limit=2', []) == 'ordinary text ?model=example&limit=2'


@pytest.mark.parametrize('name', ['key', 'api_key', 'apikey', 'token', 'access_token', 'KEY', 'Api_Key'])
def test_query_values(name):
    from app.utils.redact import redact_secrets

    assert redact_secrets(f'https://example.test/?{name}=FAKE_SECRET_123&model=test', []) == f'https://example.test/?{name}=[redacted]&model=test'
    assert redact_secrets(f'https://example.test/?model=test&{name}=FAKE_SECRET_123#fragment', []) == f'https://example.test/?model=test&{name}=[redacted]#fragment'
