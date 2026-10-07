const asyncHandler = require('express-async-handler');
const User = require('../models/User');

// @GET /api/cart
const getCart = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('cart.product');
  res.json(user.cart);
});

// @POST /api/cart
const addToCart = asyncHandler(async (req, res) => {
  const { productId, qty, size, color } = req.body;
  const user = await User.findById(req.user._id);
  const existing = user.cart.find(i => i.product.toString() === productId && i.size === size && i.color === color);
  if (existing) {
    existing.qty += qty || 1;
  } else {
    user.cart.push({ product: productId, qty: qty || 1, size, color });
  }
  await user.save();
  const updated = await User.findById(req.user._id).populate('cart.product');
  res.json(updated.cart);
});

// @PUT /api/cart/:itemId
const updateCartItem = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const item = user.cart.id(req.params.itemId);
  if (!item) { res.status(404); throw new Error('Cart item not found'); }
  item.qty = req.body.qty;
  await user.save();
  const updated = await User.findById(req.user._id).populate('cart.product');
  res.json(updated.cart);
});

// @DELETE /api/cart/:itemId
const removeFromCart = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.cart = user.cart.filter(i => i._id.toString() !== req.params.itemId);
  await user.save();
  const updated = await User.findById(req.user._id).populate('cart.product');
  res.json(updated.cart);
});

// @DELETE /api/cart
const clearCart = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { cart: [] });
  res.json([]);
});

module.exports = { getCart, addToCart, updateCartItem, removeFromCart, clearCart };
