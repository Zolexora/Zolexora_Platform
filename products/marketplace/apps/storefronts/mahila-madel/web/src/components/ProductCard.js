import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import './ProductCard.css';

const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN');
const disc = (p, m) => Math.round(((m - p) / m) * 100);

const ProductCard = ({ product }) => {
  const { addItem } = useCart();
  const { toggle, isInWishlist } = useWishlist();
  const navigate = useNavigate();
  const liked = isInWishlist(product._id);
  const d = disc(product.price, product.mrp);

  return (
    <div className="pc">
      <div className="pc-img-wrap">
        <Link to={`/products/${product._id}`}>
          <img
            src={product.images?.[0] || 'https://via.placeholder.com/300x360?text=No+Image'}
            alt={product.name}
            className="pc-img"
            loading="lazy"
          />
        </Link>
        {d > 0 && <span className="pc-badge pc-badge-disc">{d}% OFF</span>}
        {product.stock === 0 && <span className="pc-badge pc-badge-oos">Sold Out</span>}
        {product.isFeatured && product.stock > 0 && d === 0 && <span className="pc-badge pc-badge-feat">Featured</span>}

        <div className="pc-overlay">
          <button className="pc-wish" onClick={(e) => { e.preventDefault(); toggle(product._id); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
          <div className="pc-actions">
            <button className="pc-quick-add" onClick={(e) => { e.preventDefault(); addItem(product._id, 1); }} disabled={product.stock === 0}>
              {product.stock === 0 ? 'Sold Out' : 'Quick Add'}
            </button>
            <button className="pc-buy" onClick={async (e) => { e.preventDefault(); const ok = await addItem(product._id, 1); if (ok) navigate('/cart'); }} disabled={product.stock === 0}>
              Buy
            </button>
          </div>
        </div>
      </div>

      <Link to={`/products/${product._id}`} className="pc-body">
        <p className="pc-brand">{product.brand}</p>
        <h3 className="pc-name">{product.name}</h3>
        {product.numReviews > 0 && (
          <div className="pc-rating">
            <span className="pc-stars">{product.ratings?.toFixed(1)} ★</span>
            <span className="pc-review-count">({product.numReviews.toLocaleString()})</span>
          </div>
        )}
        <div className="pc-price-row">
          <span className="pc-price">{fmt(product.price)}</span>
          {product.mrp > product.price && <span className="pc-mrp">{fmt(product.mrp)}</span>}
        </div>
        {product.stock > 0 && product.stock <= 5 && <p className="pc-stock-warn">Only {product.stock} left!</p>}
      </Link>
    </div>
  );
};

export default ProductCard;
