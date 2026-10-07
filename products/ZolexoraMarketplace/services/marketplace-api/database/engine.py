from shared.database.postgres import connection, is_pool_ready

SCHEMA_HEAD = "0010_erp_outbox_inbox"



async def check_readiness() -> bool:
    if not is_pool_ready():
        return False
    try:
        async with connection() as value:
            return await value.fetchval("SELECT version_num FROM alembic_version") == SCHEMA_HEAD
    except Exception:
        return False
