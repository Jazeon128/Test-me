"""Global pytest configuration.

The environment is redirected here, in the rootdir conftest, because pytest
loads this before any test package and before any application module is
imported. app.db.database builds its engine at import time from
settings.DATABASE_URL, and the upload endpoint writes to settings.UPLOAD_DIR.

Without this, a test that exercises the upload endpoint writes into the
developer's real database and upload folder: background tasks such as
process_document open their own SessionLocal, which no dependency override can
reach. It really happened, overwriting a real document's title with a
fixture's.
"""

import os
import tempfile

_TEST_STATE = tempfile.mkdtemp(prefix="testme-tests-")
os.environ["DATABASE_URL"] = "sqlite:///" + os.path.join(_TEST_STATE, "test.db")
os.environ["UPLOAD_DIR"] = os.path.join(_TEST_STATE, "uploads")
os.makedirs(os.environ["UPLOAD_DIR"], exist_ok=True)

from hypothesis import settings, HealthCheck  # noqa: E402,F401

# Register Hypothesis profiles for different environments
settings.register_profile("ci", max_examples=1000, deadline=None)
settings.register_profile("dev", max_examples=100, deadline=None)

# Load the dev profile by default (can be overridden with --hypothesis-profile=ci)
settings.load_profile("dev")
