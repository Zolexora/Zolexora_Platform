require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const app = express();

// ✅ CORS must be FIRST before anything else
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'https://mahilamadel.store',
    'https://www.mahilamadel.store',
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

connectDB();

// Routes
// Legacy runtime disabled for MR-15 cutover.
// All client traffic must be pointed to api.zolexora.com.
app.use('/api', (req, res) => {
  res.status(410).json({
    message: 'The Mahila legacy API has been permanently retired. Please update your client to use api.zolexora.com',
    deprecated: true
  });
});


app.get('/api/health', (req, res) => res.json({ status: 'OK', message: 'ShopKart API running 🚀' }));

// Error handler
app.use((err, req, res, next) => {
  const status = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(status).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 ShopKart Server running on port ${PORT}`));
