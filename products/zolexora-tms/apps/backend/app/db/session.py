from contextlib import asynccontextmanager
from typing import AsyncGenerator
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session
from app.core.config import settings

connect_args = {"statement_cache_size": 0}
# Enable SSL for remote Postgres instances (Render, Supabase, Neon, etc.)
if "localhost" not in settings.DATABASE_URL and "127.0.0.1" not in settings.DATABASE_URL:
    connect_args["ssl"] = "require"

engine = create_async_engine(
    settings.ASYNC_DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    connect_args=connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@event.listens_for(Session, "after_begin")
def _apply_tenant_context(session, transaction, connection):
    """Re-apply the RLS tenant context at the start of every transaction.
    set_config(..., true) is transaction-local, so without this a commit() would
    drop the context and later queries in the same request would see no rows."""
    org_id = session.info.get("organisation_id")
    if org_id:
        connection.execute(
            text("SELECT set_config('app.current_organisation_id', :org_id, true)"), {"org_id": org_id}
        )


async def set_tenant_context(db: AsyncSession, org_id) -> None:
    """Pin the session to one tenant for RLS: applied now and on every later transaction."""
    db.info["organisation_id"] = str(org_id)
    await db.execute(text("SELECT set_config('app.current_organisation_id', :org_id, true)"), {"org_id": str(org_id)})


@asynccontextmanager
async def rls_bypass(db: AsyncSession):
    """Transaction-local RLS bypass for lookups that run before the tenant is known
    (a user's own memberships). Keep the block to the lookup itself; on error the
    rollback discards the setting."""
    await db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
    yield
    await db.execute(text("SELECT set_config('app.bypass_rls', 'off', true)"))


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
