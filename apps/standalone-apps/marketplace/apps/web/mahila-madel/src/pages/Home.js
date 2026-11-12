import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getFeatured, getCategories } from '../utils/api';
import ProductCard from '../components/ProductCard';
import './Home.css';

const CAT_DATA = {
  Jewellery: { emoji: '💎', tagline: 'Gold & Kundan' },
  Clothing: { emoji: '👗', tagline: 'Sarees & Suits' },
  Bags: { emoji: '👜', tagline: 'Designer Picks' },
  Footwear: { emoji: '👠', tagline: 'Heels & Flats' },
  Accessories: { emoji: '🧣', tagline: 'Scarves & More' },
  Beauty: { emoji: '💄', tagline: 'Glow Up' },
};

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const [f, c] = await Promise.all([getFeatured(), getCategories()]);
        setFeatured(Array.isArray(f.data) ? f.data : []);
        setCategories(Array.isArray(c.data) ? c.data : []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  return (
    <div className="home">
      {/* HERO */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="container hero-content">
          <div className="hero-left">
            <div className="hero-eyebrow">New Collection 2025 ✦</div>
            <h1 className="hero-title">
              Every Woman<br/>
              <em>Deserves to</em><br/>
              <span>Shine</span>
            </h1>
            <p className="hero-desc">Handpicked jewellery, ethnic wear &amp; accessories crafted for the modern Indian woman.</p>
            <div className="hero-actions">
              <button className="btn btn-primary btn-lg" onClick={() => navigate('/products')}>Shop Collection</button>
              <button className="btn btn-outline-dark btn-lg" onClick={() => navigate('/products?category=Jewellery')}>View Jewellery</button>
            </div>
            <div className="hero-stats">
              <div className="hero-stat"><span>500+</span><p>Products</p></div>
              <div className="hero-stat-div" />
              <div className="hero-stat"><span>10K+</span><p>Happy Customers</p></div>
              <div className="hero-stat-div" />
              <div className="hero-stat"><span>4.8★</span><p>Avg Rating</p></div>
            </div>
          </div>
          <div className="hero-right">
            <div className="hero-card hc-1"><div className="hc-emoji">💍</div><p>Bridal Collection</p></div>
            <div className="hero-card hc-2"><div className="hc-emoji">👗</div><p>Ethnic Wear</p></div>
            <div className="hero-card hc-3"><div className="hc-emoji">✨</div><p>New Arrivals</p></div>
            <div className="hero-orb ho-1" />
            <div className="hero-orb ho-2" />
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <div className="trust-bar">
        <div className="container trust-inner">
          {[
            { icon: '🚚', t: 'Free Delivery', s: 'Orders above ₹499' },
            { icon: '↩️', t: 'Easy Returns', s: '10-day policy' },
            { icon: '🔒', t: 'Secure Payment', s: 'SSL encrypted' },
            { icon: '✅', t: '100% Authentic', s: 'Verified products' },
            { icon: '💬', t: '24/7 Support', s: 'Always here' },
          ].map(i => (
            <div key={i.t} className="trust-item">
              <span className="trust-icon">{i.icon}</span>
              <div><p className="trust-t">{i.t}</p><p className="trust-s">{i.s}</p></div>
            </div>
          ))}
        </div>
      </div>

      <div className="container">
        {/* CATEGORIES */}
        <section className="home-section">
          <div className="section-head">
            <div><p className="section-eyebrow">Browse By</p><h2 className="section-title">Shop Categories</h2></div>
            <Link to="/products" className="section-link">View All →</Link>
          </div>
          <div className="cats-grid">
            {categories.map(cat => {
              const info = CAT_DATA[cat] || { emoji: '🛍️', tagline: 'Explore' };
              return (
                <Link key={cat} to={`/products?category=${cat}`} className="cat-card">
                  <div className="cat-inner">
                    <div className="cat-emoji">{info.emoji}</div>
                    <div className="cat-name">{cat}</div>
                    <div className="cat-tag">{info.tagline}</div>
                    <div className="cat-arrow">→</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* FEATURED */}
        <section className="home-section">
          <div className="section-head">
            <div><p className="section-eyebrow">Handpicked</p><h2 className="section-title">Featured Products</h2></div>
            <Link to="/products" className="section-link">See All →</Link>
          </div>
          {loading ? <div className="spinner-wrap"><div className="spinner" /></div> : (
            <div className="feat-grid">{featured.map(p => <ProductCard key={p._id} product={p} />)}</div>
          )}
        </section>

        {/* PROMO */}
        <section className="promo-banner">
          <div className="promo-left">
            <p className="promo-eye">Limited Time</p>
            <h2 className="promo-title">Festive Season<br/><em>Grand Sale</em></h2>
            <p className="promo-sub">Up to 70% off on select jewellery, sarees &amp; more</p>
            <Link to="/products" className="btn btn-primary">Shop the Sale</Link>
          </div>
          <div className="promo-right">
            <div className="promo-num"><span className="pn-pct">70</span><span className="pn-off">%<br/>OFF</span></div>
          </div>
        </section>

        {/* MINI PROMOS */}
        <section className="home-section">
          <div className="mini-promos">
            <Link to="/products?category=Jewellery" className="mini-promo mp-1"><div><h3>Bridal Jewellery</h3><p>Starting ₹299</p><span>Shop Now →</span></div><div className="mp-emoji">💍</div></Link>
            <Link to="/products?category=Clothing" className="mini-promo mp-2"><div><h3>Ethnic Wear</h3><p>Up to 70% off</p><span>Shop Now →</span></div><div className="mp-emoji">👘</div></Link>
            <Link to="/products?category=Bags" className="mini-promo mp-3"><div><h3>Designer Bags</h3><p>Min 40% off</p><span>Shop Now →</span></div><div className="mp-emoji">👛</div></Link>
          </div>
        </section>
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-top container">
          <div className="footer-brand">
            <div className="footer-logo">Mahila <em>✦</em> <span>Madel</span></div>
            <p>Your one-stop destination for women's fashion, jewellery and accessories.</p>
          </div>
          <div className="footer-col">
            <h4>Quick Links</h4>
            <Link to="/products">All Products</Link>
            <Link to="/orders">My Orders</Link>
            <Link to="/wishlist">Wishlist</Link>
            <Link to="/profile">My Account</Link>
          </div>
          <div className="footer-col">
            <h4>Categories</h4>
            {categories.slice(0, 5).map(c => <Link key={c} to={`/products?category=${c}`}>{c}</Link>)}
          </div>
          <div className="footer-col">
            <h4>Support</h4>
            <button className="footer-link-btn">Help Center</button>
            <button className="footer-link-btn">Track Order</button>
            <button className="footer-link-btn">Return Policy</button>
            <button className="footer-link-btn">Contact Us</button>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="container footer-bottom-inner">
            <p>© 2024 Mahila Madel. All rights reserved. Made with ❤️ in India</p>
            <div className="footer-pays">
              {['💳 UPI', '🏦 Net Banking', '💵 COD'].map(p => <span key={p} className="pay-tag">{p}</span>)}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
