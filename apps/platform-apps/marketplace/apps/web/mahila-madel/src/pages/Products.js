import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getProducts, getCategories } from '../utils/api';
import ProductCard from '../components/ProductCard';
import './Products.css';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'popular', label: 'Popularity' },
  { value: 'rating', label: 'Best Rating' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
];

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const category = searchParams.get('category') || '';
  const keyword = searchParams.get('keyword') || '';
  const sort = searchParams.get('sort') || 'newest';
  const page = parseInt(searchParams.get('page') || '1');
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const rating = searchParams.get('rating') || '';

  const [priceRange, setPriceRange] = useState([minPrice, maxPrice]);

  useEffect(() => { getCategories().then(r => setCategories(Array.isArray(r.data) ? r.data : [])); }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getProducts({ category, keyword, sort, page, minPrice, maxPrice, rating });
      setProducts(data.products);
      setTotal(data.total);
      setPages(data.pages);
    } finally { setLoading(false); }
  }, [category, keyword, sort, page, minPrice, maxPrice, rating]);

  useEffect(() => { fetchProducts(); window.scrollTo(0, 0); }, [fetchProducts]);

  const setParam = (key, value) => {
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value); else p.delete(key);
    p.delete('page');
    setSearchParams(p);
  };

  const applyPrice = () => {
    const p = new URLSearchParams(searchParams);
    if (priceRange[0]) p.set('minPrice', priceRange[0]); else p.delete('minPrice');
    if (priceRange[1]) p.set('maxPrice', priceRange[1]); else p.delete('maxPrice');
    p.delete('page');
    setSearchParams(p);
  };

  const clearAll = () => { setPriceRange(['', '']); setSearchParams({}); };

  const FilterPanel = () => (
    <aside className="filter-panel">
      <div className="filter-head">
        <h3>Filters</h3>
        {(category || minPrice || maxPrice || rating) && (
          <button className="clear-btn" onClick={clearAll}>Clear All</button>
        )}
      </div>

      <div className="filter-section">
        <h4>Categories</h4>
        <label className={`filter-option ${!category ? 'active' : ''}`}>
          <input type="radio" name="cat" checked={!category} onChange={() => setParam('category', '')} /> All
        </label>
        {categories.map(cat => (
          <label key={cat} className={`filter-option ${category === cat ? 'active' : ''}`}>
            <input type="radio" name="cat" checked={category === cat} onChange={() => setParam('category', cat)} /> {cat}
          </label>
        ))}
      </div>

      <div className="filter-section">
        <h4>Price Range</h4>
        <div className="price-inputs">
          <input type="number" placeholder="Min" value={priceRange[0]} onChange={e => setPriceRange([e.target.value, priceRange[1]])} className="form-control" />
          <span>—</span>
          <input type="number" placeholder="Max" value={priceRange[1]} onChange={e => setPriceRange([priceRange[0], e.target.value])} className="form-control" />
        </div>
        <button className="btn btn-outline btn-sm btn-full mt-1" onClick={applyPrice}>Apply</button>
      </div>

      <div className="filter-section">
        <h4>Customer Rating</h4>
        {[4, 3, 2, 1].map(r => (
          <label key={r} className={`filter-option ${rating === String(r) ? 'active' : ''}`}>
            <input type="radio" name="rating" checked={rating === String(r)} onChange={() => setParam('rating', r)} />
            {r}★ & above
          </label>
        ))}
        {rating && <label className="filter-option"><input type="radio" name="rating" checked={false} onChange={() => setParam('rating', '')} /> All Ratings</label>}
      </div>
    </aside>
  );

  return (
    <div className="products-page container">
      <div className="products-layout">
        <div className={`filter-overlay ${showFilters ? 'show' : ''}`} onClick={() => setShowFilters(false)} />
        <div className={`filter-sidebar ${showFilters ? 'open' : ''}`}>
          <FilterPanel />
        </div>

        <main className="products-main">
          <div className="products-toolbar">
            <div className="toolbar-left">
              <button className="filter-toggle-btn hide-desktop" onClick={() => setShowFilters(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="11" y2="18"/></svg>
                Filters
              </button>
              <span className="result-count">
                {loading ? '...' : `${total.toLocaleString()} results`}
                {keyword && ` for "${keyword}"`}
                {category && ` in ${category}`}
              </span>
            </div>
            <div className="toolbar-right">
              <span className="sort-label hide-mobile">Sort by:</span>
              <select value={sort} onChange={e => setParam('sort', e.target.value)} className="sort-select">
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="spinner-wrap"><div className="spinner" /></div>
          ) : products.length === 0 ? (
            <div className="empty-state">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <h3>No products found</h3>
              <p>Try adjusting your filters or search terms</p>
              <button className="btn btn-primary" onClick={clearAll}>Clear Filters</button>
            </div>
          ) : (
            <>
              <div className="products-grid-main">
                {products.map(p => <ProductCard key={p._id} product={p} />)}
              </div>
              {pages > 1 && (
                <div className="pagination">
                  <button className="pg-btn" disabled={page <= 1} onClick={() => setParam('page', page - 1)}>← Prev</button>
                  {Array.from({ length: pages }, (_, i) => i + 1).map(n => (
                    <button key={n} className={`pg-btn ${n === page ? 'active' : ''}`} onClick={() => setParam('page', n)}>{n}</button>
                  ))}
                  <button className="pg-btn" disabled={page >= pages} onClick={() => setParam('page', page + 1)}>Next →</button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
