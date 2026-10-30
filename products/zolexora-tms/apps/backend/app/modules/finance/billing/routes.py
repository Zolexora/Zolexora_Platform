import datetime
import uuid
from decimal import Decimal
from typing import List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.auth.dependencies import OrgContext, get_org_context
from app.core.audit import record_audit
from app.modules.crm.clients.models import Client
from app.modules.finance.billing.enums import RateRuleType
from app.modules.finance.billing.models import RateCard, RateCardRule, RateCardVersion

router = APIRouter(tags=["Billing"], prefix="/api/v1")

RULE_FIELDS = ("rule_type", "name", "base_amount", "quantity_included", "rate_per_unit",
               "is_percentage", "percentage_value", "sequence", "conditions")


def _rule_dict(rule: RateCardRule) -> dict:
    d = {f: getattr(rule, f) for f in RULE_FIELDS}
    d.update(id=rule.id, rate_card_version_id=rule.rate_card_version_id,
             rate=rule.rate_per_unit, parameter=rule.name)  # aliases used by EditRatesModal
    return d


async def _versions(ctx: OrgContext, rate_card_id: uuid.UUID) -> list[RateCardVersion]:
    res = await ctx.db.execute(
        select(RateCardVersion).where(RateCardVersion.rate_card_id == rate_card_id).order_by(RateCardVersion.version_number.desc())
    )
    return list(res.scalars().all())


async def _rules(ctx: OrgContext, version_id: uuid.UUID) -> list[RateCardRule]:
    res = await ctx.db.execute(
        select(RateCardRule).where(RateCardRule.rate_card_version_id == version_id).order_by(RateCardRule.sequence)
    )
    return list(res.scalars().all())


async def _card_response(ctx: OrgContext, card: RateCard, customer_name: Optional[str]) -> dict:
    versions = []
    for v in await _versions(ctx, card.id):
        versions.append({
            "id": v.id, "version_number": v.version_number, "effective_from": v.effective_from,
            "effective_to": v.effective_to, "is_immutable": v.is_immutable,
            "rules": [_rule_dict(r) for r in await _rules(ctx, v.id)],
        })
    return {
        "id": card.id, "name": card.name, "customer_id": card.customer_id, "vendor_id": None,
        "customer_name": customer_name, "vendor_name": None,
        "service_type": card.booking_type, "vehicle_type": card.vehicle_type, "is_active": card.is_active,
        "rules": versions[0]["rules"] if versions else [],
        "created_at": card.created_at, "versions": versions,
    }


@router.get("/rate-cards")
async def list_rate_cards(ctx: OrgContext = Depends(get_org_context)):
    res = await ctx.db.execute(
        select(RateCard, Client.name)
        .outerjoin(Client, Client.id == RateCard.customer_id)
        .where(RateCard.organisation_id == ctx.organisation_id)
        .order_by(RateCard.created_at.desc())
    )
    return [await _card_response(ctx, card, customer_name) for card, customer_name in res.all()]


class RuleIn(BaseModel):
    rule_type: RateRuleType
    name: str = Field(..., min_length=1, max_length=100)
    base_amount: Decimal = Decimal("0")
    quantity_included: Decimal = Decimal("0")
    rate_per_unit: Decimal = Decimal("0")
    is_percentage: bool = False
    percentage_value: Decimal = Decimal("0")
    sequence: int = 0
    conditions: dict = Field(default_factory=dict)


class VersionIn(BaseModel):
    effective_from: Optional[datetime.datetime] = None
    is_immutable: bool = True
    rules: List[RuleIn] = Field(default_factory=list)


class RateCardCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    side: Literal["CUSTOMER", "VENDOR"] = "CUSTOMER"
    service_type: str = Field(..., min_length=1, max_length=64)
    vehicle_type: str = Field("ANY", min_length=1, max_length=64)
    customer_id: Optional[uuid.UUID] = None
    active: bool = True
    initial_version: VersionIn = Field(default_factory=VersionIn)


@router.post("/rate-cards", status_code=status.HTTP_201_CREATED)
async def create_rate_card(payload: RateCardCreate, ctx: OrgContext = Depends(get_org_context)):
    if payload.side == "VENDOR":
        # The rate_cards schema only models customer pricing (no vendor_id column).
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Vendor rate cards are not supported yet")
    customer_name = None
    if payload.customer_id:
        res = await ctx.db.execute(
            select(Client.name).where(Client.id == payload.customer_id, Client.organisation_id == ctx.organisation_id)
        )
        customer_name = res.scalar()
        if customer_name is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found in organisation")

    card = RateCard(
        organisation_id=ctx.organisation_id, name=payload.name, booking_type=payload.service_type,
        vehicle_type=payload.vehicle_type, is_active=payload.active, customer_id=payload.customer_id,
    )
    ctx.db.add(card)
    await ctx.db.flush()
    version = RateCardVersion(
        rate_card_id=card.id, version_number=1, is_immutable=payload.initial_version.is_immutable,
        effective_from=payload.initial_version.effective_from or datetime.datetime.now(datetime.timezone.utc),
    )
    ctx.db.add(version)
    await ctx.db.flush()
    for i, r in enumerate(payload.initial_version.rules):
        ctx.db.add(RateCardRule(rate_card_version_id=version.id, **{**r.model_dump(), "sequence": r.sequence or i}))
    record_audit(ctx.db, ctx.organisation_id, ctx.user_id, "RATE_CARD_CREATED", "rate_card", card.id, {"name": card.name})
    await ctx.db.commit()
    return await _card_response(ctx, card, customer_name)


class RuleUpdate(BaseModel):
    id: uuid.UUID
    rate: Decimal


class RateCardRulesUpdate(BaseModel):
    rules: List[RuleUpdate]


@router.put("/rate-cards/{rate_card_id}/rules")
async def update_rate_card_rules(
    rate_card_id: uuid.UUID,
    payload: RateCardRulesUpdate,
    ctx: OrgContext = Depends(get_org_context),
):
    res = await ctx.db.execute(
        select(RateCard).where(RateCard.id == rate_card_id, RateCard.organisation_id == ctx.organisation_id)
    )
    if not res.scalars().first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rate card not found")
    versions = await _versions(ctx, rate_card_id)
    if not versions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rate card has no versions")
    current = versions[0]
    rules = await _rules(ctx, current.id)
    new_rates = {u.id: u.rate for u in payload.rules}
    unknown = set(new_rates) - {r.id for r in rules}
    if unknown:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rule does not belong to the current rate card version")

    if current.is_immutable:
        # Bookings and billing snapshots pin a version, so price changes create a new version.
        now = datetime.datetime.now(datetime.timezone.utc)
        current.effective_to = now
        new_version = RateCardVersion(rate_card_id=rate_card_id, version_number=current.version_number + 1,
                                      is_immutable=True, effective_from=now)
        ctx.db.add(new_version)
        await ctx.db.flush()
        for r in rules:
            data = {f: getattr(r, f) for f in RULE_FIELDS}
            data["rate_per_unit"] = new_rates.get(r.id, r.rate_per_unit)
            ctx.db.add(RateCardRule(rate_card_version_id=new_version.id, **data))
        version_number = new_version.version_number
    else:
        for r in rules:
            if r.id in new_rates:
                r.rate_per_unit = new_rates[r.id]
        version_number = current.version_number

    record_audit(ctx.db, ctx.organisation_id, ctx.user_id, "RATE_CARD_RULES_UPDATED", "rate_card", rate_card_id,
                 {"version_number": version_number, "rules": {str(k): str(v) for k, v in new_rates.items()}})
    await ctx.db.commit()
    return {"status": "success", "version_number": version_number}
