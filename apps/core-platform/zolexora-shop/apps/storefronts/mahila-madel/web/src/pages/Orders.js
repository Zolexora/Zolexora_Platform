import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMyOrders } from '../utils/api';
import './Orders.css';

const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN');

const STATUS_COLOR = {
  Pending: 'warning', Confirmed: 'primary', Processing: 'primary',
  Shipped: 'primary', 'Out for Delivery': 'warning',
  Delivered: 'success', Cancelled: 'danger', Returned: 'danger',
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyOrders().then(r => { setOrders(r.data); setLoading(false); });
  }, []);

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;

  if (orders.length === 0) return (
    <div className="container">
      <div className="empty-state" style={{ padding: '80px 20px' }}>
        <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="13" y2="16"/></svg>
        <h3>No orders yet</h3>
        <p>Order something and track it here.</p>
        <Link to="/products" className="btn btn-primary">Start Shopping</Link>
      </div>
    </div>
  );

  return (
    <div className="orders-page container">
      <h1 className="page-title">My Orders</h1>
      <div className="orders-list">
        {orders.map(order => (
          <div key={order.order_id} className="order-card card">
            <div className="order-header">
              <div>
                <p className="order-id">Order #{order.order_id.slice(-8).toUpperCase()}</p>
                <p className="order-date">{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <div className="order-header-right">
                <span className={`badge badge-${STATUS_COLOR[order.status] || 'muted'}`}>{order.status}</span>
                <span className="order-total">{fmt((order.grand_total?.amount_minor || 0) / 100)}</span>
              </div>
            </div>

            <div className="order-items-preview">
                <div className="oip-item">
                  <div>
                    <p className="oip-name">Order containing {order.item_count} item{order.item_count !== 1 && 's'}</p>
                    <p className="oip-meta">Fulfillment: {order.fulfillment_status.replace(/_/g, ' ')}</p>
                  </div>
                </div>
            </div>

            <div className="order-footer">
              <div className="order-tracking-mini">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                <span>
                  {order.status === 'Delivered' ? `Delivered on ${new Date(order.deliveredAt).toLocaleDateString('en-IN')}` :
                   order.status === 'Cancelled' ? 'Order Cancelled' :
                   order.estimatedDelivery ? `Est. delivery: ${new Date(order.estimatedDelivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : order.status}
                </span>
              </div>
              <Link to={`/orders/${order.order_id}`} className="btn btn-outline btn-sm">View Details</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
