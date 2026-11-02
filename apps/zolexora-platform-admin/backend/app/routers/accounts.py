from fastapi import APIRouter, HTTPException
from ..connections import set_status
from ..schemas.accounts import AccountsListResponse, AccountStatusUpdateRequest, AccountSyncResponse, DiscoveredAccount
from ..services.accounts import get_accounts_list, sync_from_infisical, to_account

router = APIRouter(prefix="/api/accounts", tags=["Accounts"])


@router.get("", response_model=AccountsListResponse)
async def list_accounts() -> AccountsListResponse:
    """One row per connection, with email quota state."""
    return await get_accounts_list()


@router.post("/sync", response_model=AccountSyncResponse)
async def trigger_accounts_sync() -> AccountSyncResponse:
    """Re-reads connections from Infisical."""
    return await sync_from_infisical()


@router.put("/{account_id}/status", response_model=DiscoveredAccount)
async def change_account_status(account_id: str, request: AccountStatusUpdateRequest) -> DiscoveredAccount:
    """ACTIVE or DRAINING (DRAINING connections are skipped by email routing)."""
    conn = await set_status(account_id, request.status)
    if conn is None:
        raise HTTPException(status_code=404, detail=f"Account '{account_id}' not found.")
    return to_account(conn)
