"""
users/router.py
────────────────
FastAPI router for the Users domain.

Endpoints
─────────
GET  /users/me                    – The signed-in user's marketplace profile
PUT  /users/me                    – Update name / picture
POST /users/me/avatar             – Upload a profile picture
GET  /users/me/addresses          – List the authenticated buyer's saved addresses
POST /users/me/addresses          – Add a new delivery address
PUT  /users/me/addresses/{id}     – Update an existing address
DELETE /users/me/addresses/{id}   – Remove an address

GET  /users/{user_id}             – Fetch a user's public profile (authenticated)
GET  /users/                      – List users (admin only)
"""

import logging
import uuid
import re
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from core.deps import current_user, admin_only
from users.models import (
    AddressCreate,
    AddressResponse,
    ProfileUpdate,
    UserProfile,
    PublicUserProfile,
    UserProfileDetails,
    UserContacts,
)
from users.repositories import UserRepository, get_user_repository
from shared.database.postgres import connection, is_pool_ready, transaction
from shared.address import (
    PincodeResult,
    ShippingServiceabilityResult,
    get_pincode_provider,
    get_shipping_provider,
)

logger = logging.getLogger("zolexora.users.router")
router = APIRouter(prefix="/users", tags=["users"])


def _normalize_text(val: Optional[str]) -> Optional[str]:
    """Trim leading/trailing spaces, collapse multiple spaces, and uppercase."""
    if not val:
        return None
    return re.sub(r"\s+", " ", val.strip()).upper()


class ServiceabilityRequest(BaseModel):
    pincode: str = Field(..., min_length=6, max_length=6)


# ── Me ────────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserProfile)
async def get_me(user: dict = Depends(current_user)) -> UserProfile:
    """The signed-in user's marketplace profile (role, coins, picture)."""
    return UserProfile(**user)


@router.put("/me", response_model=UserProfile)
async def update_me(
    data: ProfileUpdate,
    user: dict = Depends(current_user),
    repo: UserRepository = Depends(get_user_repository),
) -> UserProfile:
    if user["role"] == "admin":
        raise HTTPException(400, "Administrator profiles are managed in the auth service")
    await repo.update_fields(user["id"], data.model_dump(exclude_none=True))
    return UserProfile(**(await repo.get_by_id(user["id"])))


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    user: dict = Depends(current_user),
    repo: UserRepository = Depends(get_user_repository),
) -> dict:
    if user["role"] == "admin":
        raise HTTPException(400, "Administrator profiles are managed in the auth service")
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(400, "Invalid image format. Allowed formats: JPEG, PNG, WebP")
    content = await file.read(5 * 1024 * 1024 + 1)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(400, "Image size exceeds 5MB limit")
    from core.cloudinary_client import upload_avatar as upload
    url = await upload(user["id"], content, file.content_type)
    await repo.update_picture(user["id"], url)
    return {"picture": url}


# ── Profile Details (Contacts & Addresses) ───────────────────────────────────

@router.get("/me/profile", response_model=UserProfileDetails)
async def get_my_profile_details(
    user: dict = Depends(current_user),
    repo: UserRepository = Depends(get_user_repository),
) -> UserProfileDetails:
    """Return the authenticated user's full profile structured into Contacts and Addresses sections."""
    profile = await repo.get_by_id(user["id"])
    if not profile:
        raise HTTPException(404, "User not found")

    # Fetch saved addresses
    addresses: list[AddressResponse] = []
    if is_pool_ready():
        async with connection() as conn:
            rows = await conn.fetch(
                """
                SELECT id, buyer_id, name, phone, address_line, city, state,
                       pincode, is_default, created_at
                FROM   public.buyer_address
                WHERE  buyer_id = $1
                ORDER  BY is_default DESC, created_at DESC
                """,
                _as_uuid(user["id"]),
            )
            addresses = [AddressResponse(**_format_address(r)) for r in rows]

    verified_emails = [profile["email"]] if profile.get("is_email_verified") else []
    phone = profile.get("phone_number")
    phone_verified = bool(phone and profile.get("is_phone_verified"))

    contacts = UserContacts(
        primary_email=profile["email"],
        is_email_verified=profile.get("is_email_verified", False),
        verified_emails=verified_emails,
        primary_phone=phone,
        is_phone_verified=phone_verified,
        verified_phones=[phone] if phone_verified else [],
    )

    return UserProfileDetails(
        id=profile["id"],
        name=profile["name"],
        role=profile["role"],
        picture=profile.get("picture"),
        coin_balance=profile.get("coin_balance", 0),
        created_at=profile["created_at"],
        contacts=contacts,
        addresses=addresses,
    )


# ── Profile ───────────────────────────────────────────────────────────────────

@router.get("/{user_id}", response_model=UserProfile | PublicUserProfile)
async def get_user_profile(
    user_id: str,
    user: dict = Depends(current_user),
    repo: UserRepository = Depends(get_user_repository),
) -> UserProfile | PublicUserProfile:
    """Return a user's profile by ID. Returns full profile for self/admin, public profile for others."""
    profile = await repo.get_by_id(user_id)
    if not profile:
        raise HTTPException(404, "User not found")
    is_self_or_admin = str(user.get("id")) == str(user_id) or user.get("role") == "admin"
    if is_self_or_admin:
        return UserProfile(**profile)
    return PublicUserProfile(
        id=profile["id"],
        name=profile["name"],
        role=profile["role"],
        picture=profile.get("picture"),
        created_at=profile["created_at"],
    )


@router.get("/", response_model=list[UserProfile])
async def list_users(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    role: Optional[str] = None,
    _: dict = Depends(admin_only),
    repo: UserRepository = Depends(get_user_repository),
) -> list[UserProfile]:
    """List all users (admin only)."""
    users = await repo.list_users(limit=limit, offset=offset, role=role)
    return [UserProfile(**u) for u in users]


def _as_uuid(value: str | uuid.UUID) -> uuid.UUID:
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError) as exc:
        raise HTTPException(404, "Invalid identifier") from exc


def _format_address(row) -> dict:
    d = dict(row)
    d["id"] = str(d["id"])
    d["buyer_id"] = str(d["buyer_id"])
    if hasattr(d.get("created_at"), "isoformat"):
        d["created_at"] = d["created_at"].isoformat()
    return d


# ── Delivery addresses ────────────────────────────────────────────────────────

@router.get("/me/addresses", response_model=list[AddressResponse])
async def list_addresses(user: dict = Depends(current_user)) -> list[AddressResponse]:
    """Return all saved delivery addresses for the authenticated buyer."""
    _require_pool()
    async with connection() as conn:
        rows = await conn.fetch(
            """
            SELECT id, buyer_id, name, phone, address_line, city, state,
                   pincode, is_default, created_at
            FROM   public.buyer_address
            WHERE  buyer_id = $1
            ORDER  BY is_default DESC, created_at DESC
            """,
            _as_uuid(user["id"]),
        )
    return [AddressResponse(**_format_address(r)) for r in rows]


@router.get("/me/addresses/pincode-lookup", response_model=PincodeResult)
async def pincode_lookup(
    pincode: str = Query(..., min_length=6, max_length=6),
    user: dict = Depends(current_user),
) -> PincodeResult:
    """
    Look up and resolve Indian postal geography metadata from a 6-digit Pincode.
    Results are cached in Redis with 24-hour TTL.
    """
    clean_pin = pincode.strip()
    if not re.match(r"^\d{6}$", clean_pin):
        raise HTTPException(400, "PINCODE must be exactly 6 digits numeric")
    provider = get_pincode_provider()
    res = await provider.lookup(clean_pin)
    if not res:
        raise HTTPException(404, "Pincode not found or invalid")
    return res


@router.post("/me/addresses/check-serviceability", response_model=ShippingServiceabilityResult)
async def check_address_serviceability(
    req: ServiceabilityRequest,
    user: dict = Depends(current_user),
) -> ShippingServiceabilityResult:
    """Check courier and shipping serviceability for a delivery pincode."""
    clean_pin = req.pincode.strip()
    if not re.match(r"^\d{6}$", clean_pin):
        raise HTTPException(400, "PINCODE must be exactly 6 digits numeric")
    shipping_provider = get_shipping_provider()
    return await shipping_provider.check_serviceability(clean_pin)


@router.post("/me/addresses", response_model=AddressResponse, status_code=201)
async def add_address(
    req: AddressCreate,
    user: dict = Depends(current_user),
) -> AddressResponse:
    """Add a new delivery address for the authenticated buyer."""
    _require_pool()
    buyer_uuid = _as_uuid(user["id"])

    clean_pin = req.pincode.strip()
    if not re.match(r"^\d{6}$", clean_pin):
        raise HTTPException(400, "PINCODE must be exactly 6 digits numeric")

    # 1. Pincode and Post Office verification
    provider = get_pincode_provider()
    pincode_data = await provider.lookup(clean_pin)
    if pincode_data and req.post_office:
        valid_pos = [po.name.upper() for po in pincode_data.post_offices]
        if valid_pos and req.post_office.strip().upper() not in valid_pos:
            raise HTTPException(
                400,
                f"Selected Post Office '{req.post_office}' is not valid for PINCODE {clean_pin}. "
                f"Allowed: {', '.join(valid_pos)}"
            )

    # 2. Server-side uppercase normalization & canonical address compilation
    house_no = _normalize_text(req.house_no)
    village_town = _normalize_text(req.village_town)
    landmark = _normalize_text(req.landmark)
    post_office = _normalize_text(req.post_office) or (pincode_data.post_offices[0].name if pincode_data and len(pincode_data.post_offices) == 1 else None)
    district = _normalize_text(req.district) or (pincode_data.district if pincode_data else None)
    division = _normalize_text(req.division) or (pincode_data.division if pincode_data else None)
    region = _normalize_text(req.region) or (pincode_data.region if pincode_data else None)
    state = _normalize_text(req.state) or (pincode_data.state if pincode_data else "INDIA")
    country = _normalize_text(req.country) or "INDIA"
    name = _normalize_text(req.name) or "CUSTOMER"

    parts = []
    if house_no:
        parts.append(house_no)
    if village_town:
        parts.append(village_town)
    if landmark:
        parts.append(landmark)
    if not parts and req.address_line:
        parts.append(_normalize_text(req.address_line))

    final_address_line = ", ".join(parts) if parts else _normalize_text(req.address_line)
    city = village_town or district or _normalize_text(req.city) or "TOWN"

    new_id = uuid.uuid4()
    async with transaction() as conn:
        # Quota guard: max 20 addresses per buyer account
        count = await conn.fetchval(
            "SELECT COUNT(*) FROM public.buyer_address WHERE buyer_id = $1", buyer_uuid
        )
        if count and count >= 20:
            raise HTTPException(400, "Maximum address limit reached (20 addresses per account)")

        if req.is_default:
            await conn.execute(
                "UPDATE public.buyer_address SET is_default = false WHERE buyer_id = $1",
                buyer_uuid,
            )
        row = await conn.fetchrow(
            """
            INSERT INTO public.buyer_address
                (id, buyer_id, name, phone, address_line, city, state, pincode, is_default)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, buyer_id, name, phone, address_line, city, state,
                      pincode, is_default, created_at
            """,
            new_id,
            buyer_uuid,
            name,
            req.phone.strip(),
            final_address_line,
            city,
            state,
            clean_pin,
            req.is_default,
        )
    res_dict = _format_address(row)
    res_dict.update({
        "house_no": house_no,
        "village_town": village_town,
        "landmark": landmark,
        "post_office": post_office,
        "district": district,
        "division": division,
        "region": region,
        "country": country,
        "postal_delivery_status": pincode_data.postal_delivery_status if pincode_data else "DELIVERY AVAILABLE",
    })
    return AddressResponse(**res_dict)


@router.put("/me/addresses/{address_id}", response_model=AddressResponse)
async def update_address(
    address_id: str,
    req: AddressCreate,
    user: dict = Depends(current_user),
) -> AddressResponse:
    """Update a saved delivery address with ownership and location consistency enforcement."""
    _require_pool()
    addr_uuid = _as_uuid(address_id)
    buyer_uuid = _as_uuid(user["id"])

    clean_pin = req.pincode.strip()
    if not re.match(r"^\d{6}$", clean_pin):
        raise HTTPException(400, "PINCODE must be exactly 6 digits numeric")

    provider = get_pincode_provider()
    pincode_data = await provider.lookup(clean_pin)
    if pincode_data and req.post_office:
        valid_pos = [po.name.upper() for po in pincode_data.post_offices]
        if valid_pos and req.post_office.strip().upper() not in valid_pos:
            raise HTTPException(
                400,
                f"Selected Post Office '{req.post_office}' is not valid for PINCODE {clean_pin}. "
                f"Allowed: {', '.join(valid_pos)}"
            )

    house_no = _normalize_text(req.house_no)
    village_town = _normalize_text(req.village_town)
    landmark = _normalize_text(req.landmark)
    post_office = _normalize_text(req.post_office) or (pincode_data.post_offices[0].name if pincode_data and len(pincode_data.post_offices) == 1 else None)
    district = _normalize_text(req.district) or (pincode_data.district if pincode_data else None)
    division = _normalize_text(req.division) or (pincode_data.division if pincode_data else None)
    region = _normalize_text(req.region) or (pincode_data.region if pincode_data else None)
    state = _normalize_text(req.state) or (pincode_data.state if pincode_data else "INDIA")
    country = _normalize_text(req.country) or "INDIA"
    name = _normalize_text(req.name) or "CUSTOMER"

    parts = []
    if house_no:
        parts.append(house_no)
    if village_town:
        parts.append(village_town)
    if landmark:
        parts.append(landmark)
    if not parts and req.address_line:
        parts.append(_normalize_text(req.address_line))

    final_address_line = ", ".join(parts) if parts else _normalize_text(req.address_line)
    city = village_town or district or _normalize_text(req.city) or "TOWN"

    async with transaction() as conn:
        if req.is_default:
            await conn.execute(
                "UPDATE public.buyer_address SET is_default = false WHERE buyer_id = $1",
                buyer_uuid,
            )
        row = await conn.fetchrow(
            """
            UPDATE public.buyer_address
            SET    name = $3, phone = $4, address_line = $5,
                   city = $6, state = $7, pincode = $8, is_default = $9
            WHERE  id = $1 AND buyer_id = $2
            RETURNING id, buyer_id, name, phone, address_line, city, state,
                      pincode, is_default, created_at
            """,
            addr_uuid,
            buyer_uuid,
            name,
            req.phone.strip(),
            final_address_line,
            city,
            state,
            clean_pin,
            req.is_default,
        )
        if not row:
            raise HTTPException(404, "Address not found")
    res_dict = _format_address(row)
    res_dict.update({
        "house_no": house_no,
        "village_town": village_town,
        "landmark": landmark,
        "post_office": post_office,
        "district": district,
        "division": division,
        "region": region,
        "country": country,
        "postal_delivery_status": pincode_data.postal_delivery_status if pincode_data else "DELIVERY AVAILABLE",
    })
    return AddressResponse(**res_dict)


@router.delete("/me/addresses/{address_id}", status_code=204)
async def delete_address(address_id: str, user: dict = Depends(current_user)) -> None:
    """Delete a delivery address."""
    _require_pool()
    addr_uuid = _as_uuid(address_id)
    buyer_uuid = _as_uuid(user["id"])
    async with connection() as conn:
        result = await conn.execute(
            "DELETE FROM public.buyer_address WHERE id = $1 AND buyer_id = $2",
            addr_uuid,
            buyer_uuid,
        )
    if result == "DELETE 0":
        raise HTTPException(404, "Address not found")


# ── Internal ──────────────────────────────────────────────────────────────────

def _require_pool() -> None:
    if not is_pool_ready():
        raise HTTPException(503, "Database is temporarily unavailable.")
