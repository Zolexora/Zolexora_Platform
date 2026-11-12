import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from .. import clients
from ..connections import (
    PROVIDERS, ConnectionInput, ConnectionStatus,
    add_connection, check_input, delete_connection, list_connections, public_view, set_status,
)

router = APIRouter(prefix="/api/connections", tags=["Connections"])


class StatusUpdate(BaseModel):
    status: ConnectionStatus


@router.get("/providers")
def list_providers():
    """Connection types and the fields each needs (drives the add form). Each field takes an Infisical key name."""
    return [p.model_dump() for p in PROVIDERS.values()]


@router.get("")
async def get_connections():
    return [public_view(c) for c in await list_connections()]


async def _candidate(data: ConnectionInput):
    try:
        return await check_input(data)
    except ValueError as e:
        raise HTTPException(422, str(e))


@router.post("/test")
async def test_connection(data: ConnectionInput):
    """Reads the named keys from Infisical and probes them, without saving."""
    conn = (await _candidate(data)).model_copy(update={"id": f"test-{uuid.uuid4().hex[:8]}"})
    try:
        return (await clients.probe(conn)).model_dump()
    finally:
        await clients.close(conn.id)


@router.post("", status_code=201)
async def create_connection(data: ConnectionInput):
    """Saves the connection (key names only) to Infisical <admin path>/connections.
    Fails with 422 if a named key is not in Infisical."""
    try:
        return public_view(await add_connection(data))
    except ValueError as e:
        raise HTTPException(422, str(e))


@router.put("/{conn_id}/status")
async def update_status(conn_id: str, body: StatusUpdate):
    conn = await set_status(conn_id, body.status)
    if conn is None:
        raise HTTPException(404, "Connection not found")
    return public_view(conn)


@router.delete("/{conn_id}", status_code=204)
async def remove_connection(conn_id: str):
    if not await delete_connection(conn_id):
        raise HTTPException(404, "Connection not found")
    await clients.close(conn_id)
