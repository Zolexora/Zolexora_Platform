import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrder, cancelOrder } from '../utils/api';
import { toast } from 'react-toastify';
import './Orders.css';

const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN');

const TRACK_STEPS = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered'];
const STATUS_COLOR = { Pending: 'warning', Confirmed: 'primary', Processing: 'primary', Shipped: 'primary', 'Out for Delivery': 'warning', Delivered: 'success', Cancelled: 'danger', Returned: 'danger' };

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    getOrder(id).then(r => { setOrder(r.data); setLoading(false); }).catch(() => navigate('/orders'));
  }, [id, navigate]);

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    setCancelling(true);
    try {
      const { data } = await cancelOrder(id, { reason: 'Cancelled by customer' });
      setOrder(data);
      toast.success('Order cancelled successfully');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Cannot cancel this order');
    } finally { setCancelling(false); }
  };

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;
  if (!order) return null;

  const currentStep = TRACK_STEPS.indexOf(order.status);
  const isCancelled = order.status === 'Cancelled' || order.status === 'Returned';

  return (
    <div className="orders-page container">
      <div className="od-header">
        <button className="back-btn" onClick={() => navigate('/orders')}>← Back to Orders</button>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>Order #{order._id.slice(-8).toUpperCase()}</h1>
          <p className="text-muted fs-13">Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <span className={`badge badge-${STATUS_COLOR[order.status] || 'muted'}`} style={{ fontSize: 14, padding: '6px 14px' }}>{order.status}</span>
      </div>

      {/* Tracking */}
      {!isCancelled && (
        <div className="card tracking-card">
          <h2>Order Tracking</h2>
          <p className="tracking-num">Tracking #: <strong>{order.trackingNumber}</strong></p>
          {order.estimatedDelivery && order.status !== 'Delivered' && (
            <p className="est-delivery">📦 Estimated Delivery: <strong>{new Date(order.estimatedDelivery).toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}</strong></p>
          )}

          <div className="track-steps">
            {TRACK_STEPS.map((s, i) => (
              <div key={s} className={`track-step ${i <= currentStep ? 'done' : ''} ${i === currentStep ? 'current' : ''}`}>
                <div className="track-dot">
                  {i < currentStep ? '✓' : i === currentStep ? '●' : '○'}
                </div>
                <span>{s}</span>
                {i < TRACK_STEPS.length - 1 && <div className={`track-line ${i < currentStep ? 'done' : ''}`} />}
              </div>
            ))}
          </div>

          <div className="track-history">
            <h4>Tracking History</h4>
            {[...order.trackingHistory].reverse().map((t, i) => (
              <div key={i} className="th-item">
                <div className="th-dot" />
                <div>
                  <p className="th-status">{t.status}</p>
                  <p className="th-msg">{t.message}</p>
                  <p className="th-time">{new Date(t.time).toLocaleString('en-IN')} · {t.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="od-grid">
        {/* Items */}
        <div className="card od-card">
          <h2>Items Ordered</h2>
          {order.orderItems.map((item, i) => (
            <div key={i} className="oip-item" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 12 }}>
              <img src={item.image || 'https://via.placeholder.com/70'} alt={item.name} style={{ width: 70, height: 70 }} />
              <div style={{ flex: 1 }}>
                <p className="oip-name">{item.name}</p>
                <p className="oip-meta">
                  Qty: {item.qty}
                  {item.size && ` · Size: ${item.size}`}
                  {item.color && ` · Color: ${item.color}`}
                </p>
                <p style={{ fontWeight: 600, fontSize: 15, marginTop: 4 }}>{fmt(item.price * item.qty)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="od-right">
          {/* Address */}
          <div className="card od-card">
            <h2>Delivery Address</h2>
            <p className="fw-500">{order.shippingAddress.name}</p>
            <p className="fs-14">{order.shippingAddress.address}</p>
            <p className="fs-14">{order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode}</p>
            <p className="fs-14 mt-1">📞 {order.shippingAddress.phone}</p>
          </div>

          {/* Price */}
          <div className="card od-card">
            <h2>Price Details</h2>
            <div className="summary-row"><span>Items Total</span><span>{fmt(order.itemsPrice)}</span></div>
            {order.discountAmount > 0 && <div className="summary-row" style={{ color: 'var(--success)' }}><span>Discount</span><span>− {fmt(order.discountAmount)}</span></div>}
            <div className="summary-row"><span>Delivery</span><span>{order.shippingPrice === 0 ? <span style={{ color: 'var(--success)' }}>FREE</span> : fmt(order.shippingPrice)}</span></div>
            <div className="summary-row"><span>Tax</span><span>{fmt(order.taxPrice)}</span></div>
            <hr style={{ border: 'none', borderTop: '1px dashed var(--border)', margin: '8px 0' }} />
            <div className="summary-row" style={{ fontWeight: 600, fontSize: 17 }}><span>Total</span><span>{fmt(order.totalPrice)}</span></div>
            <p className="fs-13 text-muted mt-1">Payment: {order.paymentMethod} · {order.isPaid ? <span style={{ color: 'var(--success)' }}>Paid</span> : <span style={{ color: 'var(--warning)' }}>Pending</span>}</p>
          </div>

          {/* Actions */}
          {!isCancelled && !['Shipped', 'Out for Delivery', 'Delivered'].includes(order.status) && (
            <button className="btn btn-danger btn-full" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling...' : 'Cancel Order'}
            </button>
          )}
          {order.status === 'Delivered' && (
            <button className="btn btn-outline btn-full">Request Return</button>
          )}
        </div>
      </div>
    </div>
  );
}
