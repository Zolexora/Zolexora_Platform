import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import './Header.css';

const Header = () => {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const [search, setSearch] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef();

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) { navigate(`/products?keyword=${encodeURIComponent(search.trim())}`); setSearch(''); }
  };

  return (
    <>
      <div className="announce-bar">
        <span>✦ Free delivery on orders above ₹499 &nbsp;&nbsp;✦ Easy 10-day returns &nbsp;&nbsp;✦ 100% Authentic products &nbsp;&nbsp;✦ Cash on Delivery Available</span>
      </div>

      <header className={`header ${scrolled ? 'scrolled' : ''}`}>
        <div className="header-inner container">
          <nav className="header-nav-left hide-mobile">
            <Link to="/products?category=Jewellery" className="hn-link">Jewellery</Link>
            <Link to="/products?category=Clothing" className="hn-link">Clothing</Link>
            <Link to="/products?category=Bags" className="hn-link">Bags</Link>
            <Link to="/products?category=Footwear" className="hn-link">Footwear</Link>
          </nav>

          <Link to="/" className="header-logo">
            <span className="logo-main">Mahila</span>
            <span className="logo-dot">✦</span>
            <span className="logo-sub">Madel</span>
          </Link>

          <div className="header-actions">
            <Link to="/wishlist" className="ha-btn hide-mobile" title="Wishlist">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </Link>

            {user ? (
              <div className="ha-user" ref={menuRef}>
                <button className="ha-btn user-btn" onClick={() => setShowMenu(p => !p)}>
                  <div className="user-avatar">{user.name[0].toUpperCase()}</div>
                </button>
                {showMenu && (
                  <div className="user-dropdown">
                    <div className="ud-header">
                      <p className="ud-name">{user.name}</p>
                      <p className="ud-email">{user.email}</p>
                      {user.isAdmin && <span className="ud-admin-badge">Admin</span>}
                    </div>
                    <div className="ud-body">
                      <Link to="/profile" className="ud-item" onClick={() => setShowMenu(false)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        My Profile
                      </Link>
                      <Link to="/orders" className="ud-item" onClick={() => setShowMenu(false)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="13" y2="12"/></svg>
                        My Orders
                      </Link>
                      <Link to="/wishlist" className="ud-item" onClick={() => setShowMenu(false)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        Wishlist
                      </Link>
                      {user.isAdmin && (
                        <Link to="/admin" className="ud-item ud-admin" onClick={() => setShowMenu(false)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                          Admin Dashboard
                        </Link>
                      )}
                    </div>
                    <div className="ud-footer">
                      <button className="ud-logout" onClick={() => { logout(); setShowMenu(false); navigate('/'); }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="ha-btn ha-login">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span className="hide-mobile">Login</span>
              </Link>
            )}

            <Link to="/cart" className="ha-btn ha-cart">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              {cartCount > 0 && <span className="cart-badge">{cartCount > 9 ? '9+' : cartCount}</span>}
            </Link>
          </div>
        </div>

        <div className="header-search-bar">
          <div className="container">
            <form onSubmit={handleSearch} className="search-form">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jewellery, sarees, bags and more..." className="search-input" />
              {search && <button type="button" className="search-clear" onClick={() => setSearch('')}>✕</button>}
            </form>
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;
