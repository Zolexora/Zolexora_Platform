const asyncHandler = require('express-async-handler');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

// @POST /api/orders
const createOrder = asyncHandler(async (req, res) => {
  const { orderItems, shippingAddress, paymentMethod, itemsPrice, shippingPrice, taxPrice, totalPrice, discountAmount } = req.body;
  if (!orderItems || orderItems.length === 0) {
    res.status(400); throw new Error('No order items');
  }
  const trackingNumber = 'SK' + Date.now();
  const estimatedDelivery = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

  const order = await Order.create({
    user: req.user._id, orderItems, shippingAddress, paymentMethod,
    itemsPrice, shippingPrice, taxPrice, totalPrice, discountAmount,
    trackingNumber, estimatedDelivery,
    trackingHistory: [{ status: 'Pending', message: 'Order placed successfully', location: 'ShopKart Warehouse' }],
  });

  // Update stock & sold
  for (const item of orderItems) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.qty, sold: item.qty } });
  }
  // Clear user cart
  await User.findByIdAndUpdate(req.user._id, { cart: [] });

  res.status(201).json(order);
});

// @GET /api/orders/myorders
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(orders);
});

// @GET /api/orders/:id
const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email phone');
  if (!order) { res.status(404); throw new Error('Order not found'); }
  if (order.user._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
    res.status(403); throw new Error('Not authorized');
  }
  res.json(order);
});

// @PUT /api/orders/:id/pay
const payOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error('Order not found'); }
  order.isPaid = true;
  order.paidAt = Date.now();
  order.paymentResult = req.body;
  order.status = 'Confirmed';
  order.trackingHistory.push({ status: 'Confirmed', message: 'Payment received, order confirmed', location: 'ShopKart' });
  await order.save();
  res.json(order);
});

// @PUT /api/orders/:id/cancel
const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error('Order not found'); }
  if (order.user.toString() !== req.user._id.toString()) { res.status(403); throw new Error('Not authorized'); }
  if (['Shipped', 'Delivered'].includes(order.status)) { res.status(400); throw new Error('Cannot cancel after shipping'); }
  order.status = 'Cancelled';
  order.cancelReason = req.body.reason || 'Cancelled by user';
  order.trackingHistory.push({ status: 'Cancelled', message: req.body.reason || 'Order cancelled by customer', location: 'ShopKart' });
  for (const item of order.orderItems) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.qty, sold: -item.qty } });
  }
  await order.save();
  res.json(order);
});

// Admin
const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({}).populate('user', 'name email').sort({ createdAt: -1 });
  res.json(orders);
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error('Order not found'); }
  order.status = req.body.status;
  const messages = {
    Confirmed: 'Order confirmed by seller',
    Processing: 'Order is being packed',
    Shipped: 'Order shipped via courier',
    'Out for Delivery': 'Out for delivery',
    Delivered: 'Order delivered successfully',
  };
  order.trackingHistory.push({ status: req.body.status, message: messages[req.body.status] || req.body.status, location: req.body.location || 'ShopKart' });
  if (req.body.status === 'Delivered') { order.isDelivered = true; order.deliveredAt = Date.now(); }
  await order.save();
  res.json(order);
});

const getAdminStats = asyncHandler(async (req, res) => {
  const totalOrders = await Order.countDocuments();
  const totalRevenue = await Order.aggregate([{ $group: { _id: null, total: { $sum: '$totalPrice' } } }]);
  const totalProducts = await Product.countDocuments({ isActive: true });
  const totalUsers = await User.countDocuments({ isAdmin: false });
  const recentOrders = await Order.find({}).populate('user', 'name').sort({ createdAt: -1 }).limit(5);
  const ordersByStatus = await Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const monthlyRevenue = await Order.aggregate([
    { $group: { _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } }, revenue: { $sum: '$totalPrice' }, orders: { $sum: 1 } } },
    { $sort: { '_id.year': -1, '_id.month': -1 } }, { $limit: 6 }
  ]);
  res.json({ totalOrders, totalRevenue: totalRevenue[0]?.total || 0, totalProducts, totalUsers, recentOrders, ordersByStatus, monthlyRevenue });
});

module.exports = { createOrder, getMyOrders, getOrder, payOrder, cancelOrder, getAllOrders, updateOrderStatus, getAdminStats };
