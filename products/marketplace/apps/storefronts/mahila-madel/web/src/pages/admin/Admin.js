import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getAdminStats, getAllOrders, updateOrderStatus,
  getAllProductsAdmin, deleteProduct, getAllUsers, updateUser
} from '../../utils/api';
import { toast } from 'react-toastify';
import './Admin.css';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const safe = (v) => Array.isArray(v) ? v : [];
const STATUS_OPTS = ['Pending','Confirmed','Processing','Shipped','Out for Delivery','Delivered','Cancelled'];

const EMPTY_STATS = {
  totalRevenue: 0, totalOrders: 0, totalProducts: 0, totalUsers: 0,
  ordersByStatus: [], recentOrders: [], monthlyRevenue: [],
};

export default function Admin() {
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(EMPTY_STATS);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadTab(tab); }, [tab]);

  const loadTab = async (t) => {
    setLoading(true);
    try {
      if (t === 'dashboard') {
        const { data } = await getAdminStats();
        setStats({
          totalRevenue: data?.totalRevenue || 0,
          totalOrders: data?.totalOrders || 0,
          totalProducts: data?.totalProducts || 0,
          totalUsers: data?.totalUsers || 0,
          ordersByStatus: safe(data?.ordersByStatus),
          recentOrders: safe(data?.recentOrders),
          monthlyRevenue: safe(data?.monthlyRevenue),
        });
      }
      if (t === 'orders') { const { data } = await getAllOrders(); setOrders(safe(data)); }
      if (t === 'products') { const { data } = await getAllProductsAdmin(); setProducts(safe(data)); }
      if (t === 'users') { const { data } = await getAllUsers(); setUsers(safe(data)); }
    } catch (e) {
      toast.error('Failed to load data');
      if (t === 'dashboard') setStats(EMPTY_STATS);
    } finally { setLoading(false); }
  };

  const handleStatusChange = async (orderId, status) => {
    try {
      await updateOrderStatus(orderId, { status });
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status } : o));
      toast.success('Status updated');
    } catch { toast.error('Failed'); }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await deleteProduct(id);
      setProducts(prev => prev.filter(p => p._id !== id));
      toast.success('Deleted');
    } catch { toast.error('Failed'); }
  };

  const handleToggleAdmin = async (userId, isAdmin) => {
    try {
      await updateUser(userId, { isAdmin: !isAdmin });
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, isAdmin: !isAdmin } : u));
      toast.success('Updated');
    } catch { toast.error('Failed'); }
  };

  const TABS = [
    { key: 'dashboard', label: '📊 Dashboard' },
    { key: 'orders', label: '📦 Orders' },
    { key: 'products', label: '🛍️ Products' },
    { key: 'users', label: '👥 Users' },
  ];

  return (
    <div className="admin-page">
      <div className="admin-sidebar">
        <div className="admin-brand">Mahila <span>✦</span> Madel</div>
        {TABS.map(t => (
          <button key={t.key} className={`admin-nav-item ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
        <Link to="/" className="admin-nav-item back-link">← Back to Store</Link>
      </div>

      <div className="admin-main">
        {loading && <div className="spinner-wrap"><div className="spinner" /></div>}

        {/* DASHBOARD */}
        {tab === 'dashboard' && !loading && (
          <div>
            <h1 className="admin-title">Dashboard</h1>
            <div className="stat-cards">
              {[
                { label: 'Total Revenue', value: fmt(stats.totalRevenue), icon: '💰' },
                { label: 'Total Orders', value: stats.totalOrders, icon: '📦' },
                { label: 'Products', value: stats.totalProducts, icon: '🛍️' },
                { label: 'Customers', value: stats.totalUsers, icon: '👥' },
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <div className="stat-icon">{s.icon}</div>
                  <div><p className="stat-value">{s.value}</p><p className="stat-label">{s.label}</p></div>
                </div>
              ))}
            </div>
            <div className="admin-grid-2">
              <div className="admin-card">
                <h3>Orders by Status</h3>
                {stats.ordersByStatus.length === 0
                  ? <p style={{fontSize:13,color:'#999',padding:'8px 0'}}>No orders yet</p>
                  : stats.ordersByStatus.map(s => (
                    <div key={s._id} className="status-row">
                      <span>{s._id}</span><span className="status-count">{s.count}</span>
                    </div>
                  ))
                }
              </div>
              <div className="admin-card">
                <h3>Recent Orders</h3>
                {stats.recentOrders.length === 0
                  ? <p style={{fontSize:13,color:'#999',padding:'8px 0'}}>No orders yet</p>
                  : stats.recentOrders.map(o => (
                    <div key={o._id} className="recent-order">
                      <div>
                        <p className="fs-13 fw-600">#{o._id.slice(-6).toUpperCase()}</p>
                        <p className="fs-12 text-muted">{o.user?.name || 'Unknown'}</p>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <p className="fs-13 fw-600">{fmt(o.totalPrice)}</p>
                        <span className={`badge badge-${o.status==='Delivered'?'success':o.status==='Cancelled'?'danger':'primary'}`}>{o.status}</span>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        {/* ORDERS */}
        {tab === 'orders' && !loading && (
          <div>
            <h1 className="admin-title">All Orders ({orders.length})</h1>
            {orders.length === 0
              ? <div className="empty-state"><h3>No orders yet</h3></div>
              : <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Order ID</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>
                      {orders.map(o => (
                        <tr key={o._id}>
                          <td><span className="order-id-cell">#{o._id.slice(-8).toUpperCase()}</span></td>
                          <td><p className="fw-600">{o.user?.name||'—'}</p><p className="fs-12 text-muted">{o.user?.email||'—'}</p></td>
                          <td>{o.orderItems?.length||0}</td>
                          <td className="fw-600">{fmt(o.totalPrice)}</td>
                          <td>{o.paymentMethod}<br/><span className={`badge badge-${o.isPaid?'success':'warning'}`}>{o.isPaid?'Paid':'Pending'}</span></td>
                          <td><select value={o.status} onChange={e=>handleStatusChange(o._id,e.target.value)} className="status-select">{STATUS_OPTS.map(s=><option key={s} value={s}>{s}</option>)}</select></td>
                          <td className="fs-12 text-muted">{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        )}

        {/* PRODUCTS */}
        {tab === 'products' && !loading && (
          <div>
            <div className="admin-tab-head">
              <h1 className="admin-title">Products ({products.length})</h1>
              <Link to="/admin/product/new" className="btn btn-primary btn-sm">+ Add Product</Link>
            </div>
            {products.length === 0
              ? <div className="empty-state"><h3>No products yet</h3><Link to="/admin/product/new" className="btn btn-primary" style={{marginTop:16}}>Add First Product</Link></div>
              : <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>MRP</th><th>Stock</th><th>Sales</th><th>Rating</th><th>Actions</th></tr></thead>
                    <tbody>
                      {products.map(p => (
                        <tr key={p._id}>
                          <td><div className="prod-cell"><img src={p.images?.[0]||'https://via.placeholder.com/40'} alt=""/><span className="prod-cell-name">{p.name}</span></div></td>
                          <td>{p.category}</td>
                          <td className="fw-600">{fmt(p.price)}</td>
                          <td className="text-muted">{fmt(p.mrp)}</td>
                          <td><span style={{color:p.stock===0?'#B5445A':p.stock<=5?'#B8860B':'#2D7A4F'}}>{p.stock===0?'OOS':p.stock}</span></td>
                          <td>{p.sold||0}</td>
                          <td>{p.ratings?.toFixed(1)||'0'} ★</td>
                          <td><div style={{display:'flex',gap:6}}><Link to={`/admin/product/${p._id}`} className="btn btn-outline btn-sm">Edit</Link><button className="btn btn-danger btn-sm" onClick={()=>handleDeleteProduct(p._id)}>Del</button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        )}

        {/* USERS */}
        {tab === 'users' && !loading && (
          <div>
            <h1 className="admin-title">Users ({users.length})</h1>
            {users.length === 0
              ? <div className="empty-state"><h3>No users yet</h3></div>
              : <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u._id}>
                          <td className="fw-600">{u.name}</td>
                          <td>{u.email}</td>
                          <td>{u.phone||'—'}</td>
                          <td><span className={`badge badge-${u.isAdmin?'danger':'muted'}`}>{u.isAdmin?'Admin':'User'}</span></td>
                          <td className="fs-12 text-muted">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                          <td><button className="btn btn-outline btn-sm" onClick={()=>handleToggleAdmin(u._id,u.isAdmin)}>{u.isAdmin?'Revoke Admin':'Make Admin'}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        )}
      </div>
    </div>
  );
}
