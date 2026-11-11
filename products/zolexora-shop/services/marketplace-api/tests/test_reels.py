"""Reels in PostgreSQL: watching earns coins once a day per reel, the creator earns too, and
only the creator (or an admin) changes a reel."""

import uuid

import pytest
from fastapi import HTTPException

from commerce import coins
from core.config import settings
from routers import reels as r
from routers.other import admin_stats, admin_toggle_reel
from routers.reels import ReelCreate
from tests.commerce_seed import BUYER_1, BUYER_2
from tests.test_storefront_isolation import ctx_mah, ctx_zol

creator, viewer = {"id": BUYER_1, "name": "Asha"}, {"id": BUYER_2}
admin = {"id": "admin-1", "is_admin": True}


async def balance(pg, user_id):
    return await pg.fetchval("SELECT coin_balance FROM user_profile WHERE user_id = $1", uuid.UUID(user_id))


@pytest.mark.asyncio
async def test_a_view_earns_coins_once_a_day_and_pays_the_creator(pg):
    reel = await r.create_reel(ReelCreate(title="Saree drape"), context=ctx_zol, user=creator, pg=pg)
    assert reel["storefront_id"] == "zolexora-shop" and reel["creator_name"] == "Asha"
    assert [x["id"] for x in await r.list_reels(context=ctx_zol, pg=pg)] == [reel["id"]]
    assert await r.list_reels(context=ctx_mah, pg=pg) == []

    out = await r.view_reel(reel["id"], context=ctx_zol, user=viewer, pg=pg)
    assert out["coins_earned"] == settings.COINS_PER_REEL_VIEW
    out = await r.view_reel(reel["id"], context=ctx_zol, user=viewer, pg=pg)
    assert out["coins_earned"] == 0
    await r.view_reel(reel["id"], context=ctx_zol, user=None, pg=pg)

    assert await balance(pg, BUYER_2) == settings.COINS_PER_REEL_VIEW
    assert await balance(pg, BUYER_1) == 1000 + settings.COINS_CREATOR_PER_VIEW
    assert [t["type"] for t in await coins.history(pg, BUYER_2)] == ["earned"]
    assert (await r.my_reels(context=None, user=creator, pg=pg))[0]["views_count"] == 3
    stats = await admin_stats(u=admin, context=ctx_zol, user_repo=type("R", (), {"count_users": lambda self: _zero()})(), pg=pg)
    assert (stats["total_reels"], stats["total_reel_views"]) == (1, 1)


async def _zero():
    return 0


@pytest.mark.asyncio
async def test_only_the_creator_or_an_admin_changes_a_reel(pg):
    reel = await r.create_reel(ReelCreate(title="Old"), context=ctx_zol, user=creator, pg=pg)
    await r.update_reel(reel["id"], {"title": "Hacked"}, context=None, user=viewer, pg=pg)
    await r.delete_reel(reel["id"], context=None, user=viewer, pg=pg)
    assert (await r.my_reels(context=None, user=creator, pg=pg))[0]["title"] == "Old"

    await r.update_reel(reel["id"], {"title": "New", "views_count": 10**6}, context=None, user=creator, pg=pg)
    [mine] = await r.my_reels(context=None, user=creator, pg=pg)
    assert (mine["title"], mine["views_count"]) == ("New", 0)

    assert await admin_toggle_reel(reel["id"], u=admin, context=None, pg=pg) == {"is_active": False}
    with pytest.raises(HTTPException):  # hidden reels can't be watched
        await r.view_reel(reel["id"], context=ctx_zol, user=viewer, pg=pg)
    await r.delete_reel(reel["id"], context=None, user=admin, pg=pg)
    assert await r.my_reels(context=None, user=creator, pg=pg) == []
