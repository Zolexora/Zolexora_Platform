# Mahila Madel transitional implementation

`web/` is the permanent customer storefront package. `legacy-server/` is the intact transitional Express/Mongoose backend and will be retired after shared FastAPI parity. This container is not a workspace package and must not gain a wrapper manifest.

The following historical ShopKart notes describe the retained transitional implementation.

# ShopKart — Full Stack MERN E-Commerce

A production-ready e-commerce platform built with MongoDB, Express, React, and Node.js.
Inspired by Flipkart/Amazon for the Indian market.

---

## 🗂️ Project Structure

```
shopkart/
├── server/                  # Node.js + Express backend
│   ├── config/db.js         # MongoDB connection
│   ├── controllers/         # Business logic
│   │   ├── authController.js
│   │   ├── productController.js
│   │   ├── orderController.js
│   │   ├── cartController.js
│   │   └── wishlistController.js
│   ├── middleware/auth.js    # JWT protect + admin guard
│   ├── models/              # Mongoose schemas
│   │   ├── User.js
│   │   ├── Product.js
│   │   └── Order.js
│   ├── routes/              # Express routers
│   ├── seed.js              # Sample data seeder
│   ├── server.js            # Entry point
│   └── .env                 # Environment variables
│
└── client/                  # React frontend
    └── src/
        ├── context/         # Auth, Cart, Wishlist contexts
        ├── pages/           # All pages
        │   ├── Home.js
        │   ├── Products.js      (listing + filters)
        │   ├── ProductDetail.js (detail + reviews)
        │   ├── Cart.js
        │   ├── Checkout.js      (3-step checkout)
        │   ├── Orders.js        (order history)
        │   ├── OrderDetail.js   (tracking)
        │   ├── Login.js
        │   ├── Wishlist.js
        │   ├── Profile.js
        │   └── admin/
        │       ├── Admin.js     (dashboard + tables)
        │       └── ProductForm.js
        ├── components/
        │   ├── Header.js
        │   ├── ProductCard.js
        │   └── ProtectedRoute.js
        ├── utils/api.js     # Axios API calls
        └── App.js           # Routes
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 16
- MongoDB (local or MongoDB Atlas)

---

### 1. Setup Environment

```bash
cd server
cp .env .env.local
```

Edit `server/.env`:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/shopkart
JWT_SECRET=your_super_secret_key_change_this_in_production
NODE_ENV=development
```

---

### 2. Install & Run Backend

```bash
cd server
npm install
node seed.js       # Seed database with sample data
npm run dev        # Start server (nodemon)
```

Server runs on: http://localhost:5000

---

### 3. Install & Run Frontend

```bash
cd client
npm install
npm start
```

Frontend runs on: http://localhost:3000

---

## 🔑 Demo Accounts

| Role  | Email                   | Password  |
|-------|-------------------------|-----------|
| Admin | admin@shopkart.com      | admin123  |
| User  | priya@example.com       | user123   |

---

## ✨ Features

### Customer
- 🏠 **Homepage** — Hero banner, categories, featured products, promo banners
- 🔍 **Product Listing** — Filters (category, price range, rating), sort, pagination
- 📦 **Product Detail** — Images, size/color picker, reviews & ratings
- 🛒 **Cart** — Add, remove, qty update, price summary
- 💳 **Checkout** — 3-step: Address → Summary → Payment (COD/UPI/Card/Net Banking)
- 📋 **Order Tracking** — Live status timeline with tracking history
- ❤️ **Wishlist** — Save & manage favourite products
- 👤 **Profile** — Update info, manage addresses, change password
- 🔐 **Auth** — JWT login/register with protected routes

### Admin (login as admin@shopkart.com)
- 📊 **Dashboard** — Revenue, orders, product, user stats + charts
- 📦 **Order Management** — View all orders, change status inline
- 🛍️ **Product Management** — Add, edit, delete products with full form
- 👥 **User Management** — View users, promote/demote admin role

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login user |
| GET | /api/auth/profile | Get profile (protected) |
| PUT | /api/auth/profile | Update profile (protected) |
| POST | /api/auth/address | Add address (protected) |
| DELETE | /api/auth/address/:id | Remove address (protected) |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/products | List with filters & pagination |
| GET | /api/products/:id | Product detail |
| GET | /api/products/featured | Featured products |
| GET | /api/products/categories | All categories |
| POST | /api/products/:id/reviews | Add review (protected) |
| POST | /api/products | Create product (admin) |
| PUT | /api/products/:id | Update product (admin) |
| DELETE | /api/products/:id | Delete product (admin) |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/orders | Create order (protected) |
| GET | /api/orders/myorders | My orders (protected) |
| GET | /api/orders/:id | Order detail (protected) |
| PUT | /api/orders/:id/pay | Mark paid (protected) |
| PUT | /api/orders/:id/cancel | Cancel order (protected) |
| GET | /api/orders/admin/all | All orders (admin) |
| PUT | /api/orders/:id/status | Update status (admin) |
| GET | /api/orders/admin/stats | Dashboard stats (admin) |

### Cart & Wishlist
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST/DELETE | /api/cart | Cart operations (protected) |
| PUT | /api/cart/:itemId | Update qty (protected) |
| GET | /api/wishlist | Get wishlist (protected) |
| POST | /api/wishlist/:productId | Toggle wishlist (protected) |

---

## 🏗️ Tech Stack

**Backend:** Node.js, Express.js, MongoDB, Mongoose, JWT, bcryptjs  
**Frontend:** React 18, React Router v6, Axios, React Toastify  
**State:** Context API (Auth, Cart, Wishlist)

---

## 🚢 Deploy to Production

### Backend (Railway / Render / Heroku)
1. Set `MONGO_URI` to MongoDB Atlas connection string
2. Set `NODE_ENV=production`
3. Set `JWT_SECRET` to a strong random string

### Frontend (Vercel / Netlify)
1. Set `REACT_APP_API_URL` to your backend URL
2. Update `proxy` in package.json or use env variable in api.js

---

## 📝 Notes

- Payment is UI-only (no real payment gateway integrated)
- Images use placeholder URLs — replace with Cloudinary or S3 for production
- For production, add rate limiting, helmet, and input sanitization
