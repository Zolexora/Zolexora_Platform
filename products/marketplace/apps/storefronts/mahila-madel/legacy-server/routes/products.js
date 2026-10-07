const express = require('express');
const router = express.Router();
const {
  getProducts, getProduct, getFeatured, getCategories,
  createReview, createProduct, updateProduct, deleteProduct, getAllProductsAdmin
} = require('../controllers/productController');
const { protect, admin } = require('../middleware/auth');

router.get('/', getProducts);
router.get('/featured', getFeatured);
router.get('/categories', getCategories);
router.get('/:id', getProduct);
router.post('/:id/reviews', protect, createReview);

// Admin
router.post('/', protect, admin, createProduct);
router.put('/:id', protect, admin, updateProduct);
router.delete('/:id', protect, admin, deleteProduct);
router.get('/admin/all', protect, admin, getAllProductsAdmin);

module.exports = router;
