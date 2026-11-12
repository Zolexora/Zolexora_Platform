import axios from 'axios';
import { expireStoredSession, storedSessionToken } from '@zolexora/shop-sign-in';
import { config as runtimeConfig } from './runtime';

const API = axios.create();

API.interceptors.request.use((config) => {
  config.baseURL = runtimeConfig('MARKETPLACE_API_URL');
  const token = storedSessionToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['X-Storefront-Key'] = 'mahila-madel';

  if (process.env.NODE_ENV !== 'production') {
    console.log(`%c[MM API Request] %c${config.method?.toUpperCase()} ${config.url}`, 'color: #B5445A; font-weight: bold;', 'color: #2C1520;', config.data || config.params || '');
  }

  return config;
});

API.interceptors.response.use(
  (res) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`%c[MM API Response] %c${res.config.method?.toUpperCase()} ${res.config.url} → ${res.status}`, 'color: #2D7A4F; font-weight: bold;', 'color: #2C1520;', res.data);
    }
    return res;
  },
  (err) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`%c[MM API Error] %c${err.config?.method?.toUpperCase()} ${err.config?.url} → ${err.response?.status || 'Network Error'}`, 'color: #B5445A; font-weight: bold;', 'color: #2C1520;', err.response?.data || err.message);
    }
    if (err.response?.status === 401) expireStoredSession();
    return Promise.reject(err);
  }
);

// Marketplace profile; sign-in itself is the Zolexora auth service.
export const getProfile = () => API.get('/users/me');
export const updateProfile = (data) => API.put('/users/me', data);
export const addAddress = (data) => API.post('/users/me/addresses', data);
export const getAddresses = () => API.get('/users/me/addresses');
export const updateAddress = (id, data) => API.put(`/users/me/addresses/${id}`, data);
export const deleteAddress = (id) => API.delete(`/users/me/addresses/${id}`);
export const lookupPincode = (pincode) => API.get('/users/me/addresses/pincode-lookup', { params: { pincode } });
export const checkServiceability = (pincode) => API.post('/users/me/addresses/check-serviceability', { pincode });
export const getUserProfile = () => API.get('/users/me/profile');
export const getCoinBalance = () => API.get('/coins/balance');
export const verifyRazorpay = (data) => API.post('/cart/checkout/verify-payment', data);
export const verifyCashfree = (data) => API.post('/cart/checkout/verify-cashfree', data);
export const verifyUpiPaid = (data) => API.post('/cart/checkout/upi-paid', data);


const mapProduct = (p) => ({
  ...p,
  _id: p.id || p._id,
  name: p.title || p.name,
  brand: p.seller_name || p.brand,
  price: (typeof p.price === 'object' && p.price !== null) ? parseFloat(p.price.amount_minor) / 100 : p.price,
  mrp: (p.original_price && typeof p.original_price === 'object') ? parseFloat(p.original_price.amount_minor) / 100 : ((typeof p.price === 'object' && p.price !== null) ? parseFloat(p.price.amount_minor) / 100 : (p.mrp || p.price)),
  numReviews: p.reviews_count ?? p.numReviews ?? 0,
  ratings: p.rating ?? p.ratings ?? 0,
});

const PAGE_SIZE = 24;
const SORTS = { 'price-asc': 'price_asc', 'price-desc': 'price_desc', rating: 'popular' };

// The page's filters in the API's names (search, min_price, skip...).
export const getProducts = async ({ category, keyword, sort, page = 1, minPrice, maxPrice } = {}) => {
  const params = { limit: PAGE_SIZE, skip: (Math.max(1, Number(page) || 1) - 1) * PAGE_SIZE, sort: SORTS[sort] || sort || 'newest' };
  if (category && category !== 'All') params.category = category;
  if (keyword) params.search = keyword;
  if (minPrice) params.min_price = minPrice;
  if (maxPrice) params.max_price = maxPrice;
  const res = await API.get('/products', { params });
  const arr = Array.isArray(res.data) ? res.data : (res.data.products || []);
  const mapped = arr.map(mapProduct);
  const current = Math.max(1, Number(page) || 1);
  // The API returns a page, not a count: offer a next page while pages come back full.
  return { data: { products: mapped, total: (current - 1) * PAGE_SIZE + mapped.length, pages: mapped.length === PAGE_SIZE ? current + 1 : current } };
};
export const getProduct = async (id) => {
  const res = await API.get(`/products/${id}`);
  return { data: mapProduct(res.data) };
};
export const getFeatured = async () => {
  const res = await API.get('/products/featured');
  const arr = Array.isArray(res.data) ? res.data : (res.data.products || []);
  return { data: arr.map(mapProduct) };
};
export const getCategories = () => API.get('/products/categories');
export const createReview = (id, data) => API.post(`/products/${id}/reviews`, data);
export const createProduct = (data) => API.post('/products', data);
export const updateProduct = (id, data) => API.put(`/products/${id}`, data);
export const deleteProduct = (id) => API.delete(`/products/${id}`);
export const getAllProductsAdmin = () => API.get('/products/admin/all');

const mapOrder = (o) => ({
  ...o,
  _id: o.order_id || o.id || o._id,
  createdAt: o.created_at || o.createdAt,
  status: o.status === 'placed' ? 'Confirmed' : o.status === 'processing' ? 'Processing' : o.status === 'fulfilled' ? 'Delivered' : o.status === 'cancelled' ? 'Cancelled' : 'Pending',
  totalPrice: o.grand_total ? (o.grand_total.amount_minor / 100) : o.totalPrice,
  itemsPrice: o.item_subtotal ? (o.item_subtotal.amount_minor / 100) : o.itemsPrice,
  taxPrice: o.tax_total ? (o.tax_total.amount_minor / 100) : o.taxPrice,
  shippingPrice: o.shipping_total ? (o.shipping_total.amount_minor / 100) : o.shippingPrice,
  discountAmount: o.discount_total ? (o.discount_total.amount_minor / 100) : o.discountAmount,
  paymentMethod: o.payment_status === 'paid' ? 'Paid' : 'Pending',
  isPaid: o.payment_status === 'paid',
  trackingNumber: o.shipments?.[0]?.tracking_number || null,
  estimatedDelivery: o.shipments?.[0]?.events?.[0]?.timestamp || null,
  trackingHistory: o.shipments?.[0]?.events?.map(e => ({ status: e.status, message: e.description, time: e.timestamp, location: e.location })) || [],
  orderItems: o.lines?.map(l => ({
    name: l.title,
    image: l.image_url,
    price: l.unit_price ? l.unit_price.amount_minor / 100 : 0,
    qty: l.quantity,
  })) || [],
  shippingAddress: o.shipping_address ? {
    name: o.shipping_address.full_name,
    phone: o.shipping_address.phone,
    address: o.shipping_address.address_line1,
    city: o.shipping_address.city,
    state: o.shipping_address.state,
    pincode: o.shipping_address.postal_code,
  } : o.shippingAddress,
});

export const createOrder = (data) => API.post('/orders', data);
export const getMyOrders = async () => {
  const res = await API.get('/orders/buyer');
  return { data: res.data };
};
export const getOrder = async (id) => {
  const res = await API.get(`/orders/buyer/${id}`);
  return { data: mapOrder(res.data) };
};
export const payOrder = (id, data) => API.put(`/orders/buyer/${id}/pay`, data);
export const cancelOrder = (id, data) => API.post(`/orders/buyer/${id}/cancel`, data);
export const getAllOrders = () => API.get('/orders/admin/all');
export const updateOrderStatus = (id, data) => API.put(`/orders/admin/${id}/status`, data);
export const getAdminStats = () => API.get('/orders/admin/stats');

export const getCart = () => API.get('/cart');
export const addToCart = (product_id, quantity) => API.post('/cart/items', { product_id, quantity });
export const updateCartItem = (product_id, quantity) => API.put(`/cart/items/${product_id}`, null, { params: { quantity } });
export const removeFromCart = (product_id) => API.delete(`/cart/items/${product_id}`);
export const checkoutCart = (data) => API.post('/cart/checkout', data);
export const clearCart = () => API.delete('/cart');

export const getWishlist = () => API.get('/wishlist');
export const toggleWishlist = (productId) => API.post(`/wishlist/${productId}`);

export const getAllUsers = () => API.get('/users');
export const updateUser = (id, data) => API.put(`/users/${id}`, data);
export const deleteUser = (id) => API.delete(`/users/${id}`);

export default API;
