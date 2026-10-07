import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createProduct, updateProduct, getProduct } from '../../utils/api';

import { toast } from 'react-toastify';
import '../admin/Admin.css';

const CATEGORIES = ['Jewellery', 'Clothing', 'Bags', 'Footwear', 'Accessories', 'Beauty', 'Home Decor'];

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = id && id !== 'new';
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', price: '', mrp: '', category: 'Jewellery', subCategory: '',
    brand: '', stock: 10, images: [''], isFeatured: false, sizes: '', colors: '',
    tags: '', deliveryDays: 5,
  });

  useEffect(() => {
    if (isEdit) {
      getProduct(id).then(r => {
        const p = r.data;
        setForm({
          name: p.name, description: p.description, price: p.price, mrp: p.mrp,
          category: p.category, subCategory: p.subCategory || '', brand: p.brand || '',
          stock: p.stock, images: p.images.length ? p.images : [''],
          isFeatured: p.isFeatured, sizes: p.sizes?.join(', ') || '',
          colors: p.colors?.join(', ') || '', tags: p.tags?.join(', ') || '',
          deliveryDays: p.deliveryDays || 5,
        });
      });
    }
  }, [id, isEdit]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price), mrp: Number(form.mrp), stock: Number(form.stock),
        deliveryDays: Number(form.deliveryDays),
        images: form.images.filter(Boolean),
        sizes: form.sizes ? form.sizes.split(',').map(s => s.trim()).filter(Boolean) : [],
        colors: form.colors ? form.colors.split(',').map(s => s.trim()).filter(Boolean) : [],
        tags: form.tags ? form.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
      };
      if (isEdit) await updateProduct(id, payload);
      else await createProduct(payload);
      toast.success(isEdit ? 'Product updated!' : 'Product created!');
      navigate('/admin');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save product');
    } finally { setLoading(false); }
  };

  return (
    <div className="container" style={{ padding: '24px 0', maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate('/admin')} className="btn btn-outline btn-sm">← Back</button>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>{isEdit ? 'Edit Product' : 'Add New Product'}</h1>
      </div>
      <div className="card" style={{ padding: 24 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label className="form-label">Product Name *</label><input className="form-control" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
          <div className="form-group"><label className="form-label">Description *</label><textarea className="form-control" rows={4} value={form.description} onChange={e => set('description', e.target.value)} required /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="form-group"><label className="form-label">Price (₹) *</label><input type="number" className="form-control" value={form.price} onChange={e => set('price', e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">MRP (₹) *</label><input type="number" className="form-control" value={form.mrp} onChange={e => set('mrp', e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">Stock *</label><input type="number" className="form-control" value={form.stock} onChange={e => set('stock', e.target.value)} required /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="form-group"><label className="form-label">Category *</label>
              <select className="form-control" value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Sub-Category</label><input className="form-control" value={form.subCategory} onChange={e => set('subCategory', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Brand</label><input className="form-control" value={form.brand} onChange={e => set('brand', e.target.value)} /></div>
          </div>
          <div className="form-group">
            <label className="form-label">Image URLs (one per line)</label>
            {form.images.map((img, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input className="form-control" value={img} placeholder="https://..." onChange={e => { const imgs = [...form.images]; imgs[i] = e.target.value; set('images', imgs); }} />
                {form.images.length > 1 && <button type="button" style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '0 10px', cursor: 'pointer' }} onClick={() => set('images', form.images.filter((_, idx) => idx !== i))}>✕</button>}
              </div>
            ))}
            <button type="button" className="btn btn-outline btn-sm" onClick={() => set('images', [...form.images, ''])}>+ Add Image</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group"><label className="form-label">Sizes (comma separated)</label><input className="form-control" value={form.sizes} onChange={e => set('sizes', e.target.value)} placeholder="S, M, L, XL" /></div>
            <div className="form-group"><label className="form-label">Colors (comma separated)</label><input className="form-control" value={form.colors} onChange={e => set('colors', e.target.value)} placeholder="Red, Blue, Gold" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group"><label className="form-label">Tags (comma separated)</label><input className="form-control" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="necklace, gold, bridal" /></div>
            <div className="form-group"><label className="form-label">Delivery Days</label><input type="number" className="form-control" value={form.deliveryDays} onChange={e => set('deliveryDays', e.target.value)} /></div>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={form.isFeatured} onChange={e => set('isFeatured', e.target.checked)} />
              Feature this product on homepage
            </label>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}</button>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/admin')}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
