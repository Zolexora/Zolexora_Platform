"""Accounts view: one row per connection, with email quota state."""
from datetime import datetime, timezone

from ..connections import PROVIDERS, Connection, list_connections, reload
from ..schemas.accounts import AccountsListResponse, AccountSyncResponse, DiscoveredAccount
from .email import THROTTLE_PCT, daily_limit, get_daily_usage, usage_pct
from .telemetry import identifier


def to_account(conn: Connection) -> DiscoveredAccount:
    is_email = PROVIDERS[conn.provider].category == "email"
    pct = usage_pct(conn) if is_email else 0.0
    if conn.error:
        status = "DISCONNECTED"  # a referenced key is missing in Infisical
    elif conn.status == "ACTIVE" and pct >= THROTTLE_PCT:
        status = "QUOTA_THROTTLED"
    else:
        status = conn.status
    return DiscoveredAccount(
        id=conn.id, provider=conn.provider, alias=conn.name, project_id_or_account_id=identifier(conn),
        status=status, quota_percentage=pct,
        daily_quota_total=daily_limit(conn) if is_email else None,
        daily_quota_used=get_daily_usage(conn.id) if is_email else None,
        last_synced_at=datetime.now(timezone.utc).isoformat(),
    )


async def get_accounts_list() -> AccountsListResponse:
    accounts = [to_account(c) for c in await list_connections()]
    return AccountsListResponse(
        accounts=accounts, total_count=len(accounts),
        active_count=sum(a.status == "ACTIVE" for a in accounts),
        throttled_count=sum(a.status == "QUOTA_THROTTLED" for a in accounts),
    )


async def sync_from_infisical() -> AccountSyncResponse:
    """Re-reads the connections folder (e.g. after editing it directly in Infisical)."""
    accounts = [to_account(c) for c in await reload()]
    return AccountSyncResponse(
        status="success", discovered_count=len(accounts),
        active_count=sum(a.status == "ACTIVE" for a in accounts),
        throttled_count=sum(a.status == "QUOTA_THROTTLED" for a in accounts),
        disconnected_count=0, diagnostics=[], timestamp=datetime.now(timezone.utc).isoformat(),
    )
