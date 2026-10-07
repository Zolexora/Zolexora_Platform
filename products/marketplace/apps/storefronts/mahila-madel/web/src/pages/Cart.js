import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import './Cart.css';

const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN');

export default function Cart() {
  const { cart, cartTotal, cartMrp, discount, updateItem, removeItem } = useCart();
  const navigate = useNavigate();

  if (cart.length === 0) return (
    <div className="container">
      <div className="empty-state" style={{ padding: '80px 20px' }}>
        <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        <h3>Your cart is empty!</h3>
        <p>Add items to it now.</p>
        <Link to="/products" className="btn btn-primary">Shop Now</Link>
      </div>
    </div>
  );

  const shipping = cartTotal >= 499 ? 0 : 40;

  return (
    <div className="cart-page container">
      <h1 className="page-title">Shopping Cart ({cart.length} items)</h1>
      <div className="cart-layout">
        <div className="cart-items-section">
          {cart.map(item => {
            const p = item.product;
            if (!p) return null;
            return (
              <div key={item.product_id || item.id} className="cart-item card">
                <Link to={`/products/${p._id || p.id}`} className="ci-img">
                  <img src={p.images?.[0] || 'https://via.placeholder.com/120'} alt={p.name} />
                </Link>
                <div className="ci-info">
                  <Link to={`/products/${p._id || p.id}`} className="ci-name">{p.name || p.title}</Link>
                  <p className="ci-brand">{p.brand}</p>
                  {item.size && <p className="ci-attr">Size: {item.size}</p>}
                  {item.color && <p className="ci-attr">Color: {item.color}</p>}
                  <div className="ci-price-row">
                    <span className="ci-price">{fmt(p.price)}</span>
                    {(p.mrp || p.original_price) > p.price && <span className="ci-mrp">{fmt(p.mrp || p.original_price)}</span>}
                    {(p.mrp || p.original_price) > p.price && <span className="ci-disc">{Math.round((((p.mrp || p.original_price) - p.price) / (p.mrp || p.original_price)) * 100)}% off</span>}
                  </div>
                  <div className="ci-actions">
                    <div className="qty-control">
                      <button onClick={() => updateItem(item.product_id || item.product?.id, Math.max(1, (item.quantity || item.qty) - 1))}>−</button>
                      <span>{item.quantity || item.qty}</span>
                      <button onClick={() => updateItem(item.product_id || item.product?.id, (item.quantity || item.qty) + 1)}>+</button>
                    </div>
                    <button className="ci-remove" onClick={() => removeItem(item.product_id || item.product?.id)}>Remove</button>
                    <button className="ci-save">Save for Later</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="cart-summary card">
          <h3>Price Details</h3>
          <div className="summary-row"><span>Price ({cart.length} items)</span><span>{fmt(cartMrp)}</span></div>
          {discount > 0 && <div className="summary-row green"><span>Discount</span><span>− {fmt(discount)}</span></div>}
          <div className="summary-row"><span>Delivery Charges</span><span className={shipping === 0 ? 'green' : ''}>{shipping === 0 ? 'FREE' : fmt(shipping)}</span></div>
          <div className="summary-divider"/>
          <div className="summary-row total"><span>Total Amount</span><span>{fmt(cartTotal + shipping)}</span></div>
          {discount > 0 && <p className="summary-saving">You will save {fmt(discount)} on this order</p>}
          <button className="btn btn-primary btn-full btn-lg" onClick={() => navigate('/checkout')}>Place Order</button>
        </div>
      </div>
    </div>
  );
}
