import asyncio
from app.db.base import Base
import app.db.models
from app.db.session import engine

async def main():
    print("Starting database schema initialization...", flush=True)
    async with engine.begin() as conn:
        print(f"Creating {len(Base.metadata.tables)} tables in PostgreSQL...", flush=True)
        for table_name in Base.metadata.tables.keys():
            print(f"  - {table_name}", flush=True)
        await conn.run_sync(Base.metadata.create_all)
    print("All tables created successfully!", flush=True)
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
