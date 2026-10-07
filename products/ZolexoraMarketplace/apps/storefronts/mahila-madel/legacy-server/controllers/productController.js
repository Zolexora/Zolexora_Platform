const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');

// @GET /api/products
const getProducts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 12;
  const skip = (page - 1) * limit;

  const query = { isActive: true };
  if (req.query.category) query.category = req.query.category;
  if (req.query.brand) query.brand = { $in: req.query.brand.split(',') };
  if (req.query.minPrice || req.query.maxPrice) {
    query.price = {};
    if (req.query.minPrice) query.price.$gte = Number(req.query.minPrice);
    if (req.query.maxPrice) query.price.$lte = Number(req.query.maxPrice);
  }
  if (req.query.rating) query.ratings = { $gte: Number(req.query.rating) };
  if (req.query.keyword) {
    query.$text = { $search: req.query.keyword };
  }

  const sortMap = {
    newest: { createdAt: -1 },
    'price-asc': { price: 1 },
    'price-desc': { price: -1 },
    popular: { sold: -1 },
    rating: { ratings: -1 },
  };
  const sort = sortMap[req.query.sort] || { createdAt: -1 };

  const total = await Product.countDocuments(query);
  const products = await Product.find(query).sort(sort).skip(skip).limit(limit);

  res.json({ products, page, pages: Math.ceil(total / limit), total });
});

// @GET /api/products/:id
const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('reviews.user', 'name avatar');
  if (!product) { res.status(404); throw new Error('Product not found'); }
  res.json(product);
});

// @GET /api/products/featured
const getFeatured = asyncHandler(async (req, res) => {
  const products = await Product.find({ isFeatured: true, isActive: true }).limit(8);
  res.json(products);
});

// @GET /api/products/categories
const getCategories = asyncHandler(async (req, res) => {
  const cats = await Product.distinct('category');
  res.json(cats);
});

// @POST /api/products/:id/reviews
const createReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404); throw new Error('Product not found'); }

  const alreadyReviewed = product.reviews.find(r => r.user.toString() === req.user._id.toString());
  if (alreadyReviewed) { res.status(400); throw new Error('Product already reviewed'); }

  product.reviews.push({ user: req.user._id, name: req.user.name, rating: Number(rating), comment });
  product.numReviews = product.reviews.length;
  product.ratings = product.reviews.reduce((a, r) => a + r.rating, 0) / product.reviews.length;
  await product.save();
  res.status(201).json({ message: 'Review added' });
});

// Admin
const createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json(product);
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!product) { res.status(404); throw new Error('Product not found'); }
  res.json(product);
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404); throw new Error('Product not found'); }
  product.isActive = false;
  await product.save();
  res.json({ message: 'Product removed' });
});

const getAllProductsAdmin = asyncHandler(async (req, res) => {
  const products = await Product.find({}).sort({ createdAt: -1 });
  res.json(products);
});

module.exports = {
  getProducts, getProduct, getFeatured, getCategories,
  createReview, createProduct, updateProduct, deleteProduct, getAllProductsAdmin,
};
