import asyncio

import pytest

from database import Database, DatabaseError


def test_path_is_required(monkeypatch):
    monkeypatch.delenv("DATABASE_PATH", raising=False)
    with pytest.raises(DatabaseError, match="DATABASE_PATH"):
        asyncio.run(Database().init())


def test_creates_the_file_and_folder_and_uses_wal(tmp_path):
    db = Database(str(tmp_path / "data" / "ims.db"))

    async def run():
        await db.init()
        await db.init()  # idempotent
        return (await db.fetch_one("PRAGMA journal_mode;"))["journal_mode"]

    assert asyncio.run(run()) == "wal"
    assert (tmp_path / "data" / "ims.db").exists()


def test_transaction_is_all_or_nothing(tmp_path):
    db = Database(str(tmp_path / "ims.db"))
    insert = "INSERT INTO settings (org_id, key, value) VALUES (?, ?, ?);"

    async def run():
        await db.init()
        with pytest.raises(RuntimeError):
            async with db.transaction() as tx:
                await tx.execute(insert, ["o", "a", "1"])
                raise RuntimeError("fail half way")
        async with db.transaction() as tx:
            await tx.execute(insert, ["o", "b", "2"])
        return [r["key"] for r in await db.query("SELECT key FROM settings WHERE org_id = 'o';")]

    assert asyncio.run(run()) == ["b"]
