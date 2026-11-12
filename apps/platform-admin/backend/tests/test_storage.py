from unittest.mock import MagicMock, patch

R2 = {"provider": "r2", "name": "Files", "config": {"account_id": "acct", "bucket": "ims-files", "access_key_id": "AK", "secret_access_key": "SK"}}


def test_presigned_url_from_r2_connection(client, post_conn):
    conn_id = post_conn(R2).json()["id"]
    s3 = MagicMock()
    s3.generate_presigned_url.return_value = "https://acct.r2.cloudflarestorage.com/ims-files/a.jpg?X-Amz-Signature=x"
    with patch("app.routers.storage.clients.r2_client", return_value=s3):
        res = client.post("/api/storage/presigned-url", json={"connection_id": conn_id, "file_key": "a.jpg", "expiry_seconds": 600})
    assert res.status_code == 200 and res.json()["bucket"] == "ims-files"
    s3.generate_presigned_url.assert_called_once_with(ClientMethod="get_object", Params={"Bucket": "ims-files", "Key": "a.jpg"}, ExpiresIn=600)


def test_unknown_or_non_r2_connection_is_404(client, post_conn):
    other = post_conn({"provider": "resend", "name": "r", "config": {"api_key": "k"}}).json()["id"]
    for conn_id in ("missing", other):
        assert client.post("/api/storage/presigned-url", json={"connection_id": conn_id, "file_key": "a"}).status_code == 404


def test_draining_r2_is_409(client, post_conn):
    conn_id = post_conn(R2).json()["id"]
    client.put(f"/api/connections/{conn_id}/status", json={"status": "DRAINING"})
    assert client.post("/api/storage/presigned-url", json={"connection_id": conn_id, "file_key": "a"}).status_code == 409


def test_limits(client):
    assert client.post("/api/storage/presigned-url", json={"connection_id": "x", "file_key": "a", "expiry_seconds": 604800}).status_code == 422
    assert client.post("/api/storage/presigned-url", json={"connection_id": "x", "file_key": ""}).status_code == 422
