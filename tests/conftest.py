import pytest
from backend.app.main import app
from backend.app.core.auth import require_user

@pytest.fixture
def authenticated_user():
    app.dependency_overrides[require_user] = lambda: {"id": "test-user", "role": "authenticated"}
    yield
    app.dependency_overrides.pop(require_user, None)
