from unittest.mock import MagicMock, patch
from app.db.connections import generate_r2_presigned_url, get_r2_bucket_for_product

def test_r2_bucket_product_resolution():
    """Verify products resolve to their dedicated Cloudflare R2 storage buckets."""
    assert get_r2_bucket_for_product("zolexora-ims") == "zolexora-ims-files"
    assert get_r2_bucket_for_product("zolexora-marketplace") == "zolexora-marketplace-files"
    assert get_r2_bucket_for_product("zolexora-tms") == "zolexora-tms-files"
    assert get_r2_bucket_for_product("other-product") == "zolexora-platform-files"

def test_presigned_url_endpoint(client):
    """POST /api/storage/presigned-url returns presigned S3/R2 URL."""
    payload = {
        "product": "zolexora-ims",
        "file_key": "catalog/product-image-44.jpg",
        "operation": "get_object",
        "expiry_seconds": 1800
    }
    response = client.post("/api/storage/presigned-url", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "url" in data
    assert "catalog/product-image-44.jpg" in data["url"]
    assert data["bucket"] == "zolexora-ims-files"
    assert data["file_key"] == "catalog/product-image-44.jpg"
    assert data["expires_in_seconds"] == 1800

def test_boto3_presigned_url_generation():
    """Verify boto3 client method is invoked when boto3 is initialized."""
    mock_s3 = MagicMock()
    mock_s3.generate_presigned_url.return_value = "https://r2.cloudflarestorage.com/signed-url-boto3"

    with patch("app.db.connections.get_r2_client", return_value=mock_s3):
        url = generate_r2_presigned_url("zolexora-tms-files", "bol/bol-001.pdf", "get_object", 3600)
        assert url == "https://r2.cloudflarestorage.com/signed-url-boto3"
        mock_s3.generate_presigned_url.assert_called_once_with(
            ClientMethod="get_object",
            Params={"Bucket": "zolexora-tms-files", "Key": "bol/bol-001.pdf"},
            ExpiresIn=3600
        )
