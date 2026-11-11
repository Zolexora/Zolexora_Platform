import argparse
import asyncio

from database.repositories.storefronts import bootstrap_storefronts
from database.session import connection
from shared.database.postgres import close_pool, init_pool


async def run(*, dry_run: bool) -> list[str]:
    await init_pool()
    try:
        async with connection() as value:
            return await bootstrap_storefronts(value, dry_run=dry_run)
    finally:
        await close_pool()


def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap canonical Marketplace storefronts")
    parser.add_argument("--apply", action="store_true", help="apply changes; default is dry-run")
    args = parser.parse_args()
    actions = asyncio.run(run(dry_run=not args.apply))
    print("No changes." if not actions else "\n".join(actions))


if __name__ == "__main__":
    main()
