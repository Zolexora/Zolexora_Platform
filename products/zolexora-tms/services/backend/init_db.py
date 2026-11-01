import asyncio
from app.db.base import Base
import app.db.models
from app.db.session import engine, AsyncSessionLocal
from sqlalchemy import select
from app.modules.core.platform.models import TenantDatabaseRegistry, TenantMongodbRegistry, ProviderType, RegistryStatus
from app.modules.identity.roles.seed_platform_templates import seed as seed_role_templates

async def main():
    print("Starting database schema initialization...", flush=True)
    async with engine.begin() as conn:
        print(f"Creating {len(Base.metadata.tables)} tables in PostgreSQL...", flush=True)
        for table_name in Base.metadata.tables.keys():
            print(f"  - {table_name}", flush=True)
        await conn.run_sync(Base.metadata.create_all)
    print("All tables created successfully!", flush=True)
    
    async with AsyncSessionLocal() as session:
        # Seed databases if empty
        res = await session.execute(select(TenantDatabaseRegistry).limit(1))
        if not res.scalars().first():
            print("Seeding initial tenant database registry...", flush=True)
            for i in range(1, 6):
                session.add(TenantDatabaseRegistry(
                    provider=ProviderType.POSTGRESQL,
                    database_identifier=f"zolexora-tms-dev-d1-0{i}",
                    database_name=f"tms_tenant_0{i}",
                    region="auto",
                    status=RegistryStatus.AVAILABLE,
                    schema_version=1,
                    capacity_status="OPTIMAL",
                ))
            await session.commit()
            
        res_mongo = await session.execute(select(TenantMongodbRegistry).limit(1))
        if not res_mongo.scalars().first():
            print("Seeding initial tenant mongodb registry...", flush=True)
            for i in range(1, 6):
                session.add(TenantMongodbRegistry(
                    provider=ProviderType.MONGODB,
                    cluster_identifier="Zolexora-tms",
                    database_name=f"zolexora_tms_tenant_0{i}",
                    status=RegistryStatus.AVAILABLE,
                    schema_version=1,
                ))
            await session.commit()

    print("Seeding role templates...", flush=True)
    await seed_role_templates()
    print("Initialization complete!", flush=True)
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
