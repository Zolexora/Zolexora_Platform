require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');
const connectDB = require('./config/db');

const users = [
  { name: 'Admin User', email: 'admin@shopkart.com', password: 'admin123', isAdmin: true, phone: '9999999999' },
  { name: 'Priya Sharma', email: 'priya@example.com', password: 'user123', phone: '9876543210' },
  { name: 'Neha Gupta', email: 'neha@example.com', password: 'user123', phone: '9123456789' },
];

const products = [
  { name: 'Gold Plated Kundan Necklace Set', description: 'Elegant Kundan necklace set with matching earrings. Perfect for weddings and festive occasions. Made with high quality alloy metal with gold plating.', price: 899, mrp: 1999, category: 'Jewellery', subCategory: 'Necklaces', brand: 'Zaveri Pearls', stock: 50, sold: 230, ratings: 4.3, numReviews: 128, isFeatured: true, images: ['https://via.placeholder.com/400x400?text=Necklace+Set'], tags: ['necklace', 'kundan', 'wedding', 'gold'], sizes: [], colors: ['Gold', 'Silver'], deliveryDays: 3, specifications: [{ key: 'Material', value: 'Alloy' }, { key: 'Plating', value: 'Gold' }, { key: 'Style', value: 'Traditional' }] },
  { name: 'Pearl Drop Earrings', description: 'Classic pearl drop earrings suitable for office and casual wear. Hypoallergenic studs with genuine freshwater pearls.', price: 349, mrp: 799, category: 'Jewellery', subCategory: 'Earrings', brand: 'Shining Diva', stock: 80, sold: 412, ratings: 4.5, numReviews: 256, isFeatured: true, images: ['https://via.placeholder.com/400x400?text=Pearl+Earrings'], tags: ['earrings', 'pearl', 'classic', 'office'], sizes: [], colors: ['White', 'Cream'], deliveryDays: 3 },
  { name: 'Designer Silk Saree with Blouse Piece', description: 'Beautiful Banarasi silk saree with intricate zari work. Comes with unstitched blouse piece. Perfect for weddings and festivals.', price: 2499, mrp: 5999, category: 'Clothing', subCategory: 'Sarees', brand: 'Meena Bazaar', stock: 25, sold: 89, ratings: 4.6, numReviews: 67, isFeatured: true, images: ['https://via.placeholder.com/400x400?text=Silk+Saree'], tags: ['saree', 'silk', 'banarasi', 'wedding'], sizes: ['Free Size'], colors: ['Red', 'Blue', 'Green', 'Pink', 'Yellow'], deliveryDays: 5 },
  { name: 'Oxidised Silver Bangles Set of 12', description: 'Trendy oxidised silver bangles set. Lightweight and comfortable. Ideal for casual and ethnic wear.', price: 249, mrp: 599, category: 'Jewellery', subCategory: 'Bangles', brand: 'Sansar India', stock: 120, sold: 567, ratings: 4.2, numReviews: 389, isFeatured: false, images: ['https://via.placeholder.com/400x400?text=Silver+Bangles'], tags: ['bangles', 'oxidised', 'silver', 'set'], sizes: ['2.4', '2.6', '2.8'], colors: ['Silver', 'Antique Gold'] },
  { name: 'Embroidered Anarkali Suit', description: 'Gorgeous embroidered Anarkali suit with dupatta. Semi-stitched for perfect fit. Georgette fabric with heavy embroidery work.', price: 1799, mrp: 3999, category: 'Clothing', subCategory: 'Suits', brand: 'Libas', stock: 35, sold: 145, ratings: 4.4, numReviews: 92, isFeatured: true, images: ['https://via.placeholder.com/400x400?text=Anarkali+Suit'], tags: ['anarkali', 'suit', 'embroidered', 'ethnic'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], colors: ['Navy Blue', 'Maroon', 'Bottle Green', 'Purple'], deliveryDays: 4 },
  { name: 'Women Leather Tote Bag', description: 'Premium genuine leather tote bag. Spacious interior with multiple pockets. Ideal for office and daily use.', price: 1299, mrp: 2999, category: 'Bags', subCategory: 'Tote Bags', brand: 'Hidesign', stock: 40, sold: 198, ratings: 4.7, numReviews: 145, isFeatured: true, images: ['https://via.placeholder.com/400x400?text=Leather+Tote'], tags: ['bag', 'tote', 'leather', 'office'], sizes: [], colors: ['Black', 'Brown', 'Tan', 'Burgundy'], deliveryDays: 3 },
  { name: 'Silk Printed Kurti', description: 'Lightweight silk printed kurti with beautiful floral patterns. Perfect for summer wear. Machine washable.', price: 599, mrp: 1299, category: 'Clothing', subCategory: 'Kurtis', brand: 'Biba', stock: 75, sold: 320, ratings: 4.3, numReviews: 211, isFeatured: false, images: ['https://via.placeholder.com/400x400?text=Silk+Kurti'], tags: ['kurti', 'silk', 'printed', 'summer'], sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], colors: ['Pink', 'Yellow', 'Blue', 'Orange'] },
  { name: 'Gold Plated Maang Tikka', description: 'Traditional maang tikka with Kundan work. Adjustable chain. Perfect bridal and party accessory.', price: 449, mrp: 999, category: 'Jewellery', subCategory: 'Maang Tikka', brand: 'Jewels Galaxy', stock: 60, sold: 178, ratings: 4.5, numReviews: 134, isFeatured: false, images: ['https://via.placeholder.com/400x400?text=Maang+Tikka'], tags: ['tikka', 'bridal', 'gold', 'kundan'], sizes: [], colors: ['Gold', 'Gold with Red', 'Gold with Green'] },
  { name: 'Block Heel Ethnic Sandals', description: 'Comfortable block heel sandals with ethnic motifs. Perfect for festive occasions. Cushioned footbed for all-day comfort.', price: 899, mrp: 1999, category: 'Footwear', subCategory: 'Sandals', brand: 'Metro', stock: 55, sold: 267, ratings: 4.1, numReviews: 189, isFeatured: false, images: ['https://via.placeholder.com/400x400?text=Ethnic+Sandals'], tags: ['sandals', 'heels', 'ethnic', 'festive'], sizes: ['4', '5', '6', '7', '8', '9'], colors: ['Gold', 'Silver', 'Copper', 'Bronze'] },
  { name: 'Pashmina Embroidered Shawl', description: 'Soft pashmina shawl with beautiful hand embroidery. Warm and stylish. Perfect gift for women.', price: 1499, mrp: 3499, category: 'Accessories', subCategory: 'Shawls', brand: 'Fabindia', stock: 30, sold: 112, ratings: 4.8, numReviews: 87, isFeatured: true, images: ['https://via.placeholder.com/400x400?text=Pashmina+Shawl'], tags: ['shawl', 'pashmina', 'embroidered', 'winter'], sizes: ['Free Size'], colors: ['Ivory', 'Beige', 'Sky Blue', 'Mustard'] },
  { name: 'Multicolor Beaded Bracelet Set', description: 'Fun and vibrant beaded bracelet set of 10 pieces. Mix and match with any outfit. Elastic band for easy wearing.', price: 199, mrp: 499, category: 'Jewellery', subCategory: 'Bracelets', brand: 'Priyaasi', stock: 200, sold: 834, ratings: 4.0, numReviews: 567, isFeatured: false, images: ['https://via.placeholder.com/400x400?text=Beaded+Bracelets'], tags: ['bracelet', 'beaded', 'colorful', 'casual'], sizes: [], colors: ['Multicolor', 'Pastels', 'Neons'] },
  { name: 'Floral Printed Palazzo Pants', description: 'Breezy floral printed palazzo pants. High waist with elastic band. Pairs well with crop tops and kurtis.', price: 449, mrp: 999, category: 'Clothing', subCategory: 'Bottomwear', brand: 'Global Desi', stock: 90, sold: 445, ratings: 4.2, numReviews: 312, isFeatured: false, images: ['https://via.placeholder.com/400x400?text=Palazzo+Pants'], tags: ['palazzo', 'floral', 'casual', 'summer'], sizes: ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'], colors: ['Pink Floral', 'Blue Floral', 'Yellow Floral', 'White Floral'] },
];

const seedData = async () => {
  try {
    await connectDB();
    await Order.deleteMany();
    await Product.deleteMany();
    await User.deleteMany();

    const createdUsers = await User.create(users);
    console.log('✅ Users seeded');

    const createdProducts = await Product.create(products);
    console.log('✅ Products seeded');

    // Sample order
    await Order.create({
      user: createdUsers[1]._id,
      orderItems: [{ product: createdProducts[0]._id, name: createdProducts[0].name, image: createdProducts[0].images[0], price: createdProducts[0].price, qty: 1 }],
      shippingAddress: { name: 'Priya Sharma', phone: '9876543210', address: '123 MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
      paymentMethod: 'UPI',
      itemsPrice: 899,
      shippingPrice: 0,
      taxPrice: 161,
      totalPrice: 1060,
      status: 'Shipped',
      trackingNumber: 'SK1700000001',
      isPaid: true,
      paidAt: new Date(),
      trackingHistory: [
        { status: 'Pending', message: 'Order placed', location: 'ShopKart', time: new Date(Date.now() - 4 * 86400000) },
        { status: 'Confirmed', message: 'Payment received', location: 'ShopKart', time: new Date(Date.now() - 3 * 86400000) },
        { status: 'Processing', message: 'Order packed', location: 'Mumbai Warehouse', time: new Date(Date.now() - 2 * 86400000) },
        { status: 'Shipped', message: 'Dispatched via BlueDart', location: 'Mumbai Hub', time: new Date(Date.now() - 86400000) },
      ],
      estimatedDelivery: new Date(Date.now() + 86400000),
    });
    console.log('✅ Sample order seeded');

    console.log('\n🎉 Database seeded successfully!');
    console.log('👤 Admin: admin@shopkart.com / admin123');
    console.log('👤 User:  priya@example.com / user123');
    process.exit();
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    process.exit(1);
  }
};

seedData();
