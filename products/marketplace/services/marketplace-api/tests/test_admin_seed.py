import pytest

from core import seed
from core.security import verify_password


class CountedCollection:
    def __init__(self, count=1):
        self.count = count
        self.inserted = []

    async def count_documents(self, _query):
        return self.count

    async def insert_one(self, doc):
        self.inserted.append(doc)


class FakeDB:
    def __init__(self, product_count=1):
        self.products = CountedCollection(product_count)
        self.reels = CountedCollection()


class FakeUserRepository:
    existing = None
    created = []
    password_updates = []
    roles = []

    async def get_by_email(self, _email):
        return self.existing

    async def create_identity(self, **identity):
        self.created.append(identity)
        return {"id": "00000000-0000-4000-8000-000000000001", **identity, "is_active": True}

    async def update_password_hash(self, user_id, password_hash, *, revoke_sessions=False):
        self.password_updates.append((user_id, password_hash, revoke_sessions))

    async def set_role(self, user_id, role):
        self.roles.append((user_id, role))


def _reset():
    FakeUserRepository.existing = None
    FakeUserRepository.created = []
    FakeUserRepository.password_updates = []
    FakeUserRepository.roles = []


@pytest.mark.asyncio
async def test_seed_skips_admin_without_required_env(monkeypatch):
    _reset()
    monkeypatch.setattr(seed.settings, "DEFAULT_ADMIN_EMAIL", "")
    monkeypatch.setattr(seed.settings, "DEFAULT_ADMIN_PASSWORD", "")
    monkeypatch.setattr("shared.database.postgres.is_pool_ready", lambda: True)
    monkeypatch.setattr("users.repositories.UserRepository", FakeUserRepository)

    await seed.seed_data(FakeDB())

    assert FakeUserRepository.created == []


@pytest.mark.asyncio
async def test_seed_creates_canonical_postgres_admin(monkeypatch):
    _reset()
    monkeypatch.setattr(seed.settings, "DEFAULT_ADMIN_EMAIL", "admin@example.invalid")
    monkeypatch.setattr(seed.settings, "DEFAULT_ADMIN_PASSWORD", "test-password-1")
    monkeypatch.setattr("shared.database.postgres.is_pool_ready", lambda: True)
    monkeypatch.setattr("users.repositories.UserRepository", FakeUserRepository)

    await seed.seed_data(FakeDB())

    identity = FakeUserRepository.created[0]
    assert identity["role"] == "admin"
    assert verify_password("test-password-1", identity["password_hash"])


@pytest.mark.asyncio
async def test_seed_rotates_existing_admin_password_and_role(monkeypatch):
    _reset()
    FakeUserRepository.existing = {"id": "00000000-0000-4000-8000-000000000002"}
    monkeypatch.setattr(seed.settings, "DEFAULT_ADMIN_EMAIL", "admin@example.invalid")
    monkeypatch.setattr(seed.settings, "DEFAULT_ADMIN_PASSWORD", "new-test-password-1")
    monkeypatch.setattr("shared.database.postgres.is_pool_ready", lambda: True)
    monkeypatch.setattr("users.repositories.UserRepository", FakeUserRepository)

    await seed.seed_data(FakeDB())

    user_id, password_hash, revoke = FakeUserRepository.password_updates[0]
    assert user_id == FakeUserRepository.existing["id"]
    assert verify_password("new-test-password-1", password_hash)
    assert revoke is True
    assert FakeUserRepository.roles == [(user_id, "admin")]
