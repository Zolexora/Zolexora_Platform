import { Link } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import './Wishlist.css';

const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN');

export default function Wishlist() {
  const { wishlist, toggle } = useWishlist();
  const { addItem } = useCart();

  if (wishlist.length === 0) return (
    <div className="container">
      <div className="empty-state" style={{ padding: '80px 20px' }}>
        <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        <h3>Your wishlist is empty</h3>
        <p>Save items you love to your wishlist.</p>
        <Link to="/products" className="btn btn-primary">Discover Products</Link>
      </div>
    </div>
  );

  return (
    <div className="wishlist-page container">
      <h1 className="page-title">My Wishlist ({wishlist.length})</h1>
      <div className="wishlist-grid">
        {wishlist.map(p => (
          <div key={p._id} className="wl-card card">
            <button className="wl-remove" onClick={() => toggle(p._id)} title="Remove">✕</button>
            <Link to={`/products/${p._id}`}>
              <div className="wl-img">
                <img src={p.images?.[0] || 'https://via.placeholder.com/200'} alt={p.name} />
              </div>
            </Link>
            <div className="wl-info">
              <p className="wl-brand">{p.brand}</p>
              <Link to={`/products/${p._id}`} className="wl-name">{p.name}</Link>
              <div className="wl-prices">
                <span className="wl-price">{fmt(p.price)}</span>
                {p.mrp > p.price && <>
                  <span className="wl-mrp">{fmt(p.mrp)}</span>
                  <span className="wl-disc">{Math.round(((p.mrp - p.price) / p.mrp) * 100)}% off</span>
                </>}
              </div>
              <button className="btn btn-primary btn-full btn-sm" onClick={() => addItem(p._id, 1)} disabled={p.stock === 0}>
                {p.stock === 0 ? 'Out of Stock' : '🛒 Add to Cart'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
