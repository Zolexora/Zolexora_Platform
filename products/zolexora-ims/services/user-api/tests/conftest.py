import os
import sys
import tempfile

import pytest

# A fresh SQLite file per test run.
os.environ["DATABASE_PATH"] = os.path.join(tempfile.mkdtemp(prefix="ims-test-"), "ims.db")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from auth import get_current_user  # noqa: E402
from catalog import PERMISSIONS  # noqa: E402
from main import app  # noqa: E402
from models import UserProfile  # noqa: E402


def member(*permissions: str, org_id: str = "ZX-ORG-TEST-0001-AAAA") -> UserProfile:
    return UserProfile(id="mem_1", org_id=org_id, org_name="Test Business", email="owner@example.com", name="Owner", role="owner", permissions=list(permissions))


@pytest.fixture
def as_member():
    """as_member("ims:items:view") signs requests in as a member holding those permissions."""
    def use(*permissions: str, **kw) -> UserProfile:
        user = member(*permissions, **kw)
        app.dependency_overrides[get_current_user] = lambda: user
        return user
    yield use
    app.dependency_overrides.clear()


@pytest.fixture
def as_owner(as_member):
    return as_member(*PERMISSIONS)
