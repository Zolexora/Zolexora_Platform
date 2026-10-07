const asyncHandler = require('express-async-handler');
const User = require('../models/User');

// @GET /api/wishlist
const getWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('wishlist');
  res.json(user.wishlist);
});

// @POST /api/wishlist/:productId
const toggleWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const pid = req.params.productId;
  const idx = user.wishlist.indexOf(pid);
  if (idx === -1) {
    user.wishlist.push(pid);
  } else {
    user.wishlist.splice(idx, 1);
  }
  await user.save();
  const updated = await User.findById(req.user._id).populate('wishlist');
  res.json({ wishlist: updated.wishlist, added: idx === -1 });
});

module.exports = { getWishlist, toggleWishlist };
