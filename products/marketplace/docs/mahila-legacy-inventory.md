# Mahila Legacy Server Inventory

## Models

1. **User** (`models/User.js`)
   - Fields: `name`, `email`, `password`, `phone`, `avatar`, `isAdmin`, `isActive`, `addresses` (array of objects), `wishlist` (refs to Product), `cart` (objects with product ref, qty, size, color).
   - Methods: `matchPassword`, pre-save password hashing.

2. **Product** (`models/Product.js`)
   - Fields: `name`, `description`, `price`, `mrp`, `images`, `category`, `subCategory`, `brand`, `stock`, `sold`, `sizes`, `colors`, `tags`, `ratings`, `numReviews`, `reviews` (subdocument with user ref, name, rating, comment, helpful), `isFeatured`, `isActive`, `specifications` (key-value), `deliveryDays`.
   - Indexes: Text index on `name`, `description`, `brand`, `tags`.

3. **Order** (`models/Order.js`)
   - Fields: `user` (ref), `orderItems` (objects with product ref, name, image, price, qty, size, color), `shippingAddress`, `paymentMethod`, `paymentResult`, `itemsPrice`, `shippingPrice`, `taxPrice`, `totalPrice`, `discountAmount`, `isPaid`, `paidAt`, `isDelivered`, `deliveredAt`, `status` (Pending, Confirmed, Processing, Shipped, Out for Delivery, Delivered, Cancelled, Returned), `trackingNumber`, `trackingHistory`, `cancelReason`, `returnReason`, `estimatedDelivery`.

## Endpoints (Routes)

- **Auth** (`routes/auth.js`)
  - Handles login, registration.
- **Users** (`routes/users.js`)
  - Profile, updating addresses, fetching wishlist.
- **Products** (`routes/products.js`)
  - Fetching products, adding reviews.
- **Orders** (`routes/orders.js`)
  - Creating orders, viewing user's orders, admin order updates.
- **Cart/Wishlist** (`routes/cartWishlist.js`)
  - Managing user cart and wishlist items.
