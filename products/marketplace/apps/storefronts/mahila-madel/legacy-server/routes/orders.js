const express = require('express');
const router = express.Router();
const {
  createOrder, getMyOrders, getOrder, payOrder, cancelOrder,
  getAllOrders, updateOrderStatus, getAdminStats
} = require('../controllers/orderController');
const { protect, admin } = require('../middleware/auth');

router.post('/', protect, createOrder);
router.get('/myorders', protect, getMyOrders);
router.get('/admin/stats', protect, admin, getAdminStats);
router.get('/admin/all', protect, admin, getAllOrders);
router.get('/:id', protect, getOrder);
router.put('/:id/pay', protect, payOrder);
router.put('/:id/cancel', protect, cancelOrder);
router.put('/:id/status', protect, admin, updateOrderStatus);

module.exports = router;
