from fastapi import APIRouter, HTTPException
from ..schemas.accounts import (
    AccountsListResponse,
    AccountSyncResponse,
    DiscoveredAccount,
    AccountStatusUpdateRequest,
)
from ..services.accounts import (
    get_accounts_list,
    sync_accounts_from_infisical,
    update_account_status,
)

router = APIRouter(prefix="/api/accounts", tags=["Accounts"])

@router.get("", response_model=AccountsListResponse)
def list_accounts() -> AccountsListResponse:
    """
    Returns all discovered accounts across Firebase, Cloudflare, Supabase, and email providers.
    Includes count summaries and missing-credential diagnostic alerts.
    """
    return get_accounts_list()

@router.post("/sync", response_model=AccountSyncResponse)
def trigger_accounts_sync() -> AccountSyncResponse:
    """
    Triggers dynamic re-sync and live discovery of accounts from Infisical / environment variables.
    Evaluates 90% quota thresholds and updates account states.
    """
    return sync_accounts_from_infisical()

@router.put("/{account_id}/status", response_model=DiscoveredAccount)
def change_account_status(account_id: str, request: AccountStatusUpdateRequest) -> DiscoveredAccount:
    """
    Updates the operational status of an account (e.g. toggling DRAINING for maintenance).
    """
    account = update_account_status(account_id, request.status)
    if not account:
        raise HTTPException(status_code=404, detail=f"Account '{account_id}' not found.")
    return account
