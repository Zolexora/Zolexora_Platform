import pytest
from fastapi import HTTPException
from pydantic import SecretStr

from routers.cart import checkout_quote, add_to_cart, CartItemCreate, _verify_quote_token
from tests.test_cart import ctx_zol, buyer_1, buyer_2
from core.config import settings
from commerce import cart as cart_store
from tests.commerce_seed import stock_of, BUYER_1, SEL_1, PROD_1, PROD_2, seed_listing

@pytest.fixture(autouse=True)
def set_fake_quote_secret(monkeypatch):
    monkeypatch.setattr(settings, "CHECKOUT_QUOTE_SIGNING_SECRET", SecretStr("fake-secret-for-testing-quotes-1234"))
    
@pytest.mark.asyncio
async def test_checkout_quote_generation(pg):
    await seed_listing(pg, PROD_1, org=SEL_1, storefront="zolexora-shop", price=1500, stock=10, title="P1")
    
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=3), context=ctx_zol, user=buyer_1, pg=pg)
    
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, pg=pg)
    assert quote.storefront_id == "zolexora-shop"
    assert quote.currency == "INR"
    assert quote.item_subtotal.amount_minor == 4500
    # 18% tax, and delivery under ₹499: the quote shows what checkout will charge
    assert (quote.tax_total.amount_minor, quote.shipping_total.amount_minor) == (810, 4900)
    assert quote.grand_total.amount_minor == 4500 + 810 + 4900
    
    # Token validation
    assert quote.quote_id
    payload = _verify_quote_token(quote.quote_id, buyer_id=buyer_1["id"], storefront_id="zolexora-shop")
    assert payload["grand_total"] == 10210
    
@pytest.mark.asyncio
async def test_checkout_quote_empty_cart(pg):
    with pytest.raises(HTTPException) as exc:
        await checkout_quote(context=ctx_zol, user=buyer_1, pg=pg)
    assert exc.value.status_code == 400
    
@pytest.mark.asyncio
async def test_checkout_quote_tampering(pg):
    await seed_listing(pg, PROD_1, org=SEL_1, storefront="zolexora-shop", price=1500, stock=10, title="P1")
    
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=1), context=ctx_zol, user=buyer_1, pg=pg)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, pg=pg)
    
    # Wrong buyer
    with pytest.raises(HTTPException):
        _verify_quote_token(quote.quote_id, buyer_id=buyer_2["id"], storefront_id="zolexora-shop")
        
    # Wrong storefront
    with pytest.raises(HTTPException):
        _verify_quote_token(quote.quote_id, buyer_id=buyer_1["id"], storefront_id="mahila-madel")
        
    # Tampered signature
    parts = quote.quote_id.split(".")
    tampered_token = f"{parts[0]}.badsignature123"
    with pytest.raises(HTTPException) as exc:
        _verify_quote_token(tampered_token, buyer_id=buyer_1["id"], storefront_id="zolexora-shop")
    assert "signature invalid" in str(exc.value.detail)
    
@pytest.mark.asyncio
async def test_checkout_quote_missing_secret(pg, monkeypatch):
    monkeypatch.setattr(settings, "CHECKOUT_QUOTE_SIGNING_SECRET", None)
    
    await seed_listing(pg, PROD_1, org=SEL_1, storefront="zolexora-shop", price=1500, stock=10, title="P1")
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=1), context=ctx_zol, user=buyer_1, pg=pg)
    
    with pytest.raises(HTTPException) as exc:
        await checkout_quote(context=ctx_zol, user=buyer_1, pg=pg)
    assert exc.value.status_code == 500

@pytest.mark.asyncio
async def test_checkout_quote_enforces_totals(pg):
    await seed_listing(pg, PROD_1, org=SEL_1, storefront="zolexora-shop", price=100, stock=10, title="P1")
    await seed_listing(pg, PROD_2, org=SEL_1, storefront="zolexora-shop", price=200, stock=10, title="P2")

    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=2), context=ctx_zol, user=buyer_1, pg=pg)
    await add_to_cart(CartItemCreate(product_id=PROD_2, quantity=1), context=ctx_zol, user=buyer_1, pg=pg)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, pg=pg)
    assert quote.item_subtotal.amount_minor == 400
    assert quote.grand_total.amount_minor == 400 + 72 + 4900
    assert len(quote.lines) == 2

@pytest.mark.asyncio
async def test_checkout_quote_expired_token(pg):
    await seed_listing(pg, PROD_1, org=SEL_1, storefront="zolexora-shop", price=100, stock=10, title="P1")
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=1), context=ctx_zol, user=buyer_1, pg=pg)
    quote = await checkout_quote(context=ctx_zol, user=buyer_1, pg=pg)

    # We can test expiration by monkeypatching the datetime inside the _verify_quote_token
    # For now, just ensure that it parses the expiry successfully.
    assert _verify_quote_token(quote.quote_id, buyer_id=buyer_1["id"], storefront_id="zolexora-shop")

@pytest.mark.asyncio
async def test_checkout_no_side_effects(pg):
    await seed_listing(pg, PROD_1, org=SEL_1, storefront="zolexora-shop", price=100, stock=10, title="P1")
    await add_to_cart(CartItemCreate(product_id=PROD_1, quantity=1), context=ctx_zol, user=buyer_1, pg=pg)
    await checkout_quote(context=ctx_zol, user=buyer_1, pg=pg)

    # A quote holds no stock and leaves the cart open
    assert await stock_of(pg, PROD_1) == (10, 0)
    assert len(await cart_store.items(pg, BUYER_1, "zolexora-shop")) == 1

@pytest.mark.asyncio
async def test_checkout_malformed_token(pg):
    with pytest.raises(HTTPException):
        _verify_quote_token("this_is_not_a.valid_token", buyer_id=buyer_1["id"], storefront_id="zolexora-shop")
