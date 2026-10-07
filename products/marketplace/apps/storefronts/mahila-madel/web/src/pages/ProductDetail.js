import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProduct, createReview } from '../utils/api';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import './ProductDetail.css';

const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN');

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { toggle, isInWishlist } = useWishlist();
  const { user } = useAuth();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImg, setSelectedImg] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [qty, setQty] = useState(1);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    setLoading(true);
    getProduct(id).then(r => { setProduct(r.data); setLoading(false); }).catch(() => navigate('/'));
  }, [id, navigate]);

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;
  if (!product) return null;

  const liked = isInWishlist(product._id);
  const disc = Math.round(((product.mrp - product.price) / product.mrp) * 100);
  const deliveryDate = new Date(Date.now() + product.deliveryDays * 86400000).toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' });

  const handleAddCart = () => {
    if (product.sizes?.length > 0 && !selectedSize) { toast.warning('Please select a size'); return; }
    addItem(product._id, qty, selectedSize, selectedColor);
  };

  const handleBuyNow = async () => {
    if (product.sizes?.length > 0 && !selectedSize) { toast.warning('Please select a size'); return; }
    const ok = await addItem(product._id, qty, selectedSize, selectedColor);
    if (ok) navigate('/cart');
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!user) { toast.info('Please login to submit a review'); return; }
    setSubmittingReview(true);
    try {
      await createReview(id, { rating: reviewRating, comment: reviewComment });
      toast.success('Review submitted!');
      setReviewComment('');
      const r = await getProduct(id);
      setProduct(r.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review');
    } finally { setSubmittingReview(false); }
  };

  return (
    <div className="pd container">
      <div className="pd-breadcrumb">
        <span onClick={() => navigate('/')}>Home</span> /
        <span onClick={() => navigate(`/products?category=${product.category}`)}>{product.category}</span> /
        <span>{(product.name || '').slice(0, 30)}...</span>
      </div>

      <div className="pd-layout">
        {/* Images */}
        <div className="pd-gallery">
          <div className="pd-thumbs">
            {product.images.map((img, i) => (
              <img key={i} src={img} alt="" className={`pd-thumb ${i === selectedImg ? 'active' : ''}`} onClick={() => setSelectedImg(i)} />
            ))}
          </div>
          <div className="pd-main-img">
            <img src={product.images[selectedImg] || 'https://via.placeholder.com/500?text=No+Image'} alt={product.name} />
            <button className="pd-wish-btn" onClick={() => toggle(product._id)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill={liked ? '#e53935' : 'none'} stroke={liked ? '#e53935' : '#999'} strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="pd-info">
          <p className="pd-brand">{product.brand}</p>
          <h1 className="pd-name">{product.name}</h1>

          {product.numReviews > 0 && (
            <div className="pd-rating-row">
              <span className="pd-stars">{product.ratings.toFixed(1)} ★</span>
              <span className="pd-rating-count">{product.numReviews.toLocaleString()} ratings & reviews</span>
            </div>
          )}

          <div className="pd-price-row">
            <span className="pd-price">{fmt(product.price)}</span>
            {disc > 0 && <>
              <span className="pd-mrp">{fmt(product.mrp)}</span>
              <span className="pd-disc">{disc}% off</span>
            </>}
          </div>

          {product.stock > 0 && product.stock <= 5 && (
            <p className="pd-low-stock">⚡ Only {product.stock} left in stock!</p>
          )}
          {product.stock === 0 && <p className="pd-out-stock">❌ Out of Stock</p>}

          {product.colors?.length > 0 && (
            <div className="pd-options">
              <p className="pd-option-label">Color: <strong>{selectedColor || 'Select'}</strong></p>
              <div className="pd-colors">
                {product.colors.map(c => (
                  <button key={c} className={`color-btn ${selectedColor === c ? 'selected' : ''}`} onClick={() => setSelectedColor(c)}>{c}</button>
                ))}
              </div>
            </div>
          )}

          {product.sizes?.length > 0 && (
            <div className="pd-options">
              <p className="pd-option-label">Size: <strong>{selectedSize || 'Select'}</strong></p>
              <div className="pd-sizes">
                {product.sizes.map(s => (
                  <button key={s} className={`size-btn ${selectedSize === s ? 'selected' : ''}`} onClick={() => setSelectedSize(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          <div className="pd-qty-row">
            <span className="pd-option-label">Qty:</span>
            <div className="qty-control">
              <button onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
              <span>{qty}</span>
              <button onClick={() => setQty(q => Math.min(product.stock, q + 1))}>+</button>
            </div>
          </div>

          {product.stock > 0 && (
            <div className="pd-actions">
              <button className="btn btn-secondary btn-lg" onClick={handleAddCart}>🛒 Add to Cart</button>
              <button className="btn btn-primary btn-lg" onClick={handleBuyNow}>⚡ Buy Now</button>
            </div>
          )}

          <div className="pd-delivery">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            <span>Delivery by <strong>{deliveryDate}</strong> | Free above ₹499</span>
          </div>

          <div className="pd-specs">
            <h3>Specifications</h3>
            <table>
              <tbody>
                <tr><td>Category</td><td>{product.category}</td></tr>
                {product.subCategory && <tr><td>Sub-Category</td><td>{product.subCategory}</td></tr>}
                <tr><td>Brand</td><td>{product.brand || 'N/A'}</td></tr>
                {product.specifications?.map(s => <tr key={s.key}><td>{s.key}</td><td>{s.value}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="pd-section card">
        <h2>Product Description</h2>
        <p>{product.description}</p>
      </div>

      {/* Reviews */}
      <div className="pd-section card">
        <h2>Ratings & Reviews ({product.numReviews})</h2>
        {product.numReviews > 0 && (
          <div className="reviews-summary">
            <div className="rating-big">
              <span className="rating-num">{product.ratings.toFixed(1)}</span>
              <span className="rating-star">★</span>
              <p>{product.numReviews.toLocaleString()} reviews</p>
            </div>
          </div>
        )}
        <div className="reviews-list">
          {(product.reviews || []).slice(0, 5).map(r => (
            <div key={r._id} className="review-card">
              <div className="review-header">
                <span className="review-stars">{r.rating} ★</span>
                <strong>{r.name}</strong>
                <span className="review-date">{new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
              </div>
              <p className="review-comment">{r.comment}</p>
            </div>
          ))}
        </div>

        {user && (
          <form className="review-form" onSubmit={submitReview}>
            <h3>Write a Review</h3>
            <div className="review-rating-select">
              {[1,2,3,4,5].map(n => (
                <button type="button" key={n} className={`star-btn ${n <= reviewRating ? 'filled' : ''}`} onClick={() => setReviewRating(n)}>★</button>
              ))}
              <span>{reviewRating}/5</span>
            </div>
            <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="Share your experience with this product..." className="form-control" rows="3" required />
            <button type="submit" className="btn btn-primary mt-1" disabled={submittingReview}>{submittingReview ? 'Submitting...' : 'Submit Review'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
