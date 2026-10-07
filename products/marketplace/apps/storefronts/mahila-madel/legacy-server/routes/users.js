const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { protect, admin } = require('../middleware/auth');

router.get('/', protect, admin, asyncHandler(async (req, res) => {
  const users = await User.find({}).select('-password').sort({ createdAt: -1 });
  res.json(users);
}));

router.get('/:id', protect, admin, asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) { res.status(404); throw new Error('User not found'); }
  res.json(user);
}));

router.put('/:id', protect, admin, asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) { res.status(404); throw new Error('User not found'); }
  user.name = req.body.name || user.name;
  user.email = req.body.email || user.email;
  user.isAdmin = Boolean(req.body.isAdmin);
  user.isActive = req.body.isActive !== undefined ? req.body.isActive : user.isActive;
  const updated = await user.save();
  res.json({ _id: updated._id, name: updated.name, email: updated.email, isAdmin: updated.isAdmin, isActive: updated.isActive });
}));

router.delete('/:id', protect, admin, asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) { res.status(404); throw new Error('User not found'); }
  user.isActive = false;
  await user.save();
  res.json({ message: 'User deactivated' });
}));

module.exports = router;
