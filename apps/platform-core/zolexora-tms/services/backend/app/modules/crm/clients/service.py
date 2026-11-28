import uuid
from typing import Any, List, Optional
from fastapi import HTTPException, status
from pydantic import ValidationError
from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from app.core.tenant import TenantContext
from app.modules.crm.clients.models import Client, ClientLocation, ClientOperatingUnit, ClientLocationOUHistory
from app.modules.crm.clients.repository import ClientRepository, ClientLocationRepository, ClientOperatingUnitRepository, ClientLocationOUHistoryRepository
from app.modules.crm.clients.schemas import (
    ClientBulkCreateResponse, ClientBulkItemError, ClientResponse,
    ClientCreate, ClientUpdate, ClientLocationCreate, ClientLocationUpdate,
    ClientOURelationshipRequest, ClientLocationTransferRequest
)
from app.modules.operations.operating_units.repository import OperatingUnitRepository


def _generate_client_code() -> str:
    return f"CLT-{uuid.uuid4().hex[:8].upper()}"


class ClientService:
    def __init__(self, db: AsyncSession, tenant: TenantContext, current_user_id: uuid.UUID = None):
        self.db = db
        self.tenant = tenant
        self.current_user_id = current_user_id
        self.client_repo = ClientRepository(db, tenant)
        self.location_repo = ClientLocationRepository(db, tenant)
        self.client_ou_repo = ClientOperatingUnitRepository(db, tenant)
        self.history_repo = ClientLocationOUHistoryRepository(db, tenant)
        self.ou_repo = OperatingUnitRepository(db, tenant)

    async def _ensure_unique_tax_ids(
        self,
        gstin: Optional[str],
        pan: Optional[str],
        exclude_client_id: Optional[uuid.UUID] = None,
    ) -> None:
        org_id = self.tenant.organisation_id
        if gstin:
            stmt = select(Client.id).where(Client.organisation_id == org_id, Client.gstin == gstin)
            if exclude_client_id is not None:
                stmt = stmt.where(Client.id != exclude_client_id)
            if (await self.db.execute(stmt.limit(1))).scalar_one_or_none() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Client with GSTIN / Aadhaar No '{gstin}' already exists",
                )
        if pan:
            stmt = select(Client.id).where(Client.organisation_id == org_id, Client.pan == pan)
            if exclude_client_id is not None:
                stmt = stmt.where(Client.id != exclude_client_id)
            if (await self.db.execute(stmt.limit(1))).scalar_one_or_none() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Client with PAN '{pan}' already exists",
                )

    async def list_clients(self, search: Optional[str] = None) -> List[Client]:
        if not search or not search.strip():
            return await self.client_repo.list_all()
        term = f"%{search.strip()}%"
        stmt = (
            select(Client)
            .where(
                Client.organisation_id == self.tenant.organisation_id,
                or_(
                    Client.name.ilike(term),
                    Client.client_code.ilike(term),
                    Client.gstin.ilike(term),
                    Client.pan.ilike(term),
                    Client.phone.ilike(term),
                    Client.email.ilike(term),
                ),
            )
            .order_by(desc(Client.created_at))
        )
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def get_client(self, client_id: uuid.UUID) -> Client:
        client = await self.client_repo.get_by_id(client_id)
        if not client:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
        return client

    async def create_client(self, data: ClientCreate) -> Client:
        payload = data.model_dump()
        payload["name"] = payload["name"].strip()
        payload["gstin"] = payload["gstin"].strip().upper() if payload.get("gstin") else None
        payload["pan"] = payload["pan"].strip().upper() if payload.get("pan") else None
        payload["client_code"] = _generate_client_code()

        await self._ensure_unique_tax_ids(payload["gstin"], payload["pan"])
        try:
            return await self.client_repo.create(**payload)
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Client code, GSTIN, or PAN conflict")

    async def bulk_create_clients(self, items: list[dict[str, Any]]) -> ClientBulkCreateResponse:
        org_id = self.tenant.organisation_id
        created_clients: list[Client] = []
        errors: list[ClientBulkItemError] = []
        parsed_rows: list[tuple[int, ClientCreate]] = []

        for idx, raw in enumerate(items, start=1):
            cleaned = {
                k: (v.strip() if isinstance(v, str) else v)
                for k, v in raw.items()
                if not (isinstance(v, str) and v.strip() == "")
            }
            try:
                req = ClientCreate.model_validate(cleaned)
            except ValidationError as exc:
                msg = "; ".join(f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors())
                errors.append(
                    ClientBulkItemError(
                        row=idx,
                        name=str(cleaned.get("name")) if cleaned.get("name") else None,
                        error=msg,
                    )
                )
                continue
            parsed_rows.append((idx, req))

        candidate_gstins = {req.gstin for _, req in parsed_rows if req.gstin}
        candidate_pans = {req.pan for _, req in parsed_rows if req.pan}

        existing_gstins: set[str] = set()
        if candidate_gstins:
            res = await self.db.execute(
                select(Client.gstin).where(Client.organisation_id == org_id, Client.gstin.in_(candidate_gstins))
            )
            existing_gstins = {g for g in res.scalars().all() if g}

        existing_pans: set[str] = set()
        if candidate_pans:
            res = await self.db.execute(
                select(Client.pan).where(Client.organisation_id == org_id, Client.pan.in_(candidate_pans))
            )
            existing_pans = {p for p in res.scalars().all() if p}

        seen_gstins: set[str] = set()
        seen_pans: set[str] = set()

        for idx, req in parsed_rows:
            if req.gstin and (req.gstin in existing_gstins or req.gstin in seen_gstins):
                errors.append(
                    ClientBulkItemError(
                        row=idx,
                        name=req.name,
                        error=f"Duplicate GSTIN / Aadhaar No '{req.gstin}' already exists",
                    )
                )
                continue
            if req.pan and (req.pan in existing_pans or req.pan in seen_pans):
                errors.append(
                    ClientBulkItemError(
                        row=idx,
                        name=req.name,
                        error=f"Duplicate PAN '{req.pan}' already exists",
                    )
                )
                continue

            if req.gstin:
                seen_gstins.add(req.gstin)
            if req.pan:
                seen_pans.add(req.pan)

            client = Client(
                id=uuid.uuid4(),
                organisation_id=org_id,
                client_code=_generate_client_code(),
                name=req.name.strip(),
                contact_person=req.contact_person.strip() if req.contact_person else None,
                email=req.email.strip() if req.email else None,
                phone=req.phone.strip() if req.phone else None,
                billing_address=req.billing_address.strip() if req.billing_address else None,
                gstin=req.gstin,
                pan=req.pan,
                payment_terms_days=req.payment_terms_days if req.payment_terms_days is not None else 30,
                credit_limit=req.credit_limit if req.credit_limit is not None else 0.0,
                notes=req.notes.strip() if req.notes else None,
            )
            self.db.add(client)
            created_clients.append(client)

        if created_clients:
            await self.db.commit()
            for client in created_clients:
                await self.db.refresh(client)

        errors.sort(key=lambda e: e.row)
        return ClientBulkCreateResponse(
            created_count=len(created_clients),
            failed_count=len(errors),
            created=[ClientResponse.model_validate(c) for c in created_clients],
            errors=errors,
        )

    async def update_client(self, client_id: uuid.UUID, data: ClientUpdate) -> Client:
        update_data = data.model_dump(exclude_unset=True)
        if "name" in update_data and update_data["name"]:
            update_data["name"] = update_data["name"].strip()
        if "gstin" in update_data:
            update_data["gstin"] = update_data["gstin"].strip().upper() if update_data["gstin"] else None
        if "pan" in update_data:
            update_data["pan"] = update_data["pan"].strip().upper() if update_data["pan"] else None

        await self._ensure_unique_tax_ids(
            update_data.get("gstin"),
            update_data.get("pan"),
            exclude_client_id=client_id,
        )
        try:
            client = await self.client_repo.update(client_id, **update_data)
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Client code, GSTIN, or PAN conflict")
        
        if not client:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
        return client

    # Client Locations
    async def list_locations(self, client_id: uuid.UUID) -> List[ClientLocation]:
        await self.get_client(client_id) # validate
        return await self.location_repo.list_by_client(client_id)

    async def get_location(self, client_id: uuid.UUID, location_id: uuid.UUID) -> ClientLocation:
        await self.get_client(client_id) # validate
        loc = await self.location_repo.get_by_id(location_id)
        if not loc or loc.client_id != client_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client Location not found")
        return loc

    async def create_location(self, client_id: uuid.UUID, data: ClientLocationCreate) -> ClientLocation:
        await self.get_client(client_id) # validate
        create_data = data.model_dump()
        create_data["client_id"] = client_id
        
        # Verify OU if provided
        ou_id = create_data.get("operating_unit_id")
        if ou_id:
            ou = await self.ou_repo.get_by_id(ou_id)
            if not ou:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Operating Unit not found or invalid tenant")
                
        loc = await self.location_repo.create(**create_data)
        
        # Record initial history if OU is assigned
        if ou_id:
            await self.history_repo.create(
                client_location_id=loc.id,
                previous_operating_unit_id=None,
                new_operating_unit_id=ou_id,
                actor_id=self.current_user_id,
                reason="Initial Assignment"
            )
        return loc

    async def update_location(self, client_id: uuid.UUID, location_id: uuid.UUID, data: ClientLocationUpdate) -> ClientLocation:
        await self.get_client(client_id) # validate
        # We must prevent updating operating_unit_id directly via simple update!
        # Users must use the transfer endpoint to maintain history.
        update_data = data.model_dump(exclude_unset=True)
        if "operating_unit_id" in update_data:
            update_data.pop("operating_unit_id")
            
        loc = await self.location_repo.update(location_id, **update_data)
        if not loc or loc.client_id != client_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client Location not found")
        return loc

    # Explicit Client <-> OU Relationships
    async def list_ou_relationships(self, client_id: uuid.UUID) -> List[ClientOperatingUnit]:
        await self.get_client(client_id)
        return await self.client_ou_repo.list_by_client(client_id)
        
    async def add_ou_relationship(self, client_id: uuid.UUID, data: ClientOURelationshipRequest) -> ClientOperatingUnit:
        await self.get_client(client_id)
        ou = await self.ou_repo.get_by_id(data.operating_unit_id)
        if not ou:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Operating Unit not found or invalid tenant")
            
        # check if exists
        existing = await self.client_ou_repo.get_relationship(client_id, data.operating_unit_id)
        if existing:
            return existing
            
        return await self.client_ou_repo.create(
            client_id=client_id,
            operating_unit_id=data.operating_unit_id,
            status=data.status
        )
        
    async def remove_ou_relationship(self, client_id: uuid.UUID, ou_id: uuid.UUID) -> bool:
        await self.get_client(client_id)
        rel = await self.client_ou_repo.get_relationship(client_id, ou_id)
        if not rel:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Relationship not found")
        return await self.client_ou_repo.delete(rel.id)

    # Transfers
    async def transfer_location(self, client_id: uuid.UUID, location_id: uuid.UUID, data: ClientLocationTransferRequest) -> ClientLocation:
        loc = await self.get_location(client_id, location_id)
        
        # Verify new OU
        new_ou_id = data.new_operating_unit_id
        ou = await self.ou_repo.get_by_id(new_ou_id)
        if not ou:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New Operating Unit not found or invalid tenant")
            
        prev_ou_id = loc.operating_unit_id
        if prev_ou_id == new_ou_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Location is already assigned to this Operating Unit")
            
        # 1. Update assignment
        updated_loc = await self.location_repo.update(location_id, operating_unit_id=new_ou_id)
        
        # 2. Record history
        await self.history_repo.create(
            client_location_id=location_id,
            previous_operating_unit_id=prev_ou_id,
            new_operating_unit_id=new_ou_id,
            actor_id=self.current_user_id,
            reason=data.reason or "Transfer"
        )
        
        return updated_loc
        
    async def list_location_history(self, client_id: uuid.UUID, location_id: uuid.UUID) -> List[ClientLocationOUHistory]:
        await self.get_location(client_id, location_id)
        return await self.history_repo.list_history(location_id)
