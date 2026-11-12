from functools import cache
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

from shared.database.postgres import connection, is_pool_ready


@cache
def schema_head() -> str:
    """The newest migration on disk; the database is ready only when it is applied."""
    return ScriptDirectory.from_config(Config(str(Path(__file__).parent.parent / "alembic.ini"))).get_current_head()


async def check_readiness() -> bool:
    if not is_pool_ready():
        return False
    try:
        async with connection() as value:
            return await value.fetchval("SELECT version_num FROM alembic_version") == schema_head()
    except Exception:
        return False
