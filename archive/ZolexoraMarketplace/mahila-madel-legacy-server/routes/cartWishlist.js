const express = require('express');
const cartRouter = express.Router();
const wishlistRouter = express.Router();
const { getCart, addToCart, updateCartItem, removeFromCart, clearCart } = require('../controllers/cartController');
const { getWishlist, toggleWishlist } = require('../controllers/wishlistController');
const { protect } = require('../middleware/auth');

cartRouter.get('/', protect, getCart);
cartRouter.post('/', protect, addToCart);
cartRouter.put('/:itemId', protect, updateCartItem);
cartRouter.delete('/', protect, clearCart);
cartRouter.delete('/:itemId', protect, removeFromCart);

wishlistRouter.get('/', protect, getWishlist);
wishlistRouter.post('/:productId', protect, toggleWishlist);

module.exports = { cartRouter, wishlistRouter };
