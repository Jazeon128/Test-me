"""Manual, budget-limited question evaluation.

Import application settings without reading the developer's .env file.
"""

from unittest.mock import patch

from pydantic_settings.sources import DotEnvSettingsSource

with patch.object(DotEnvSettingsSource, '__call__', return_value={}):
    import app.config  # initialise settings before importing application services
