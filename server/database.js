const mongoose = require('mongoose');
const { User, Product, Stock, Supplier } = require('./models');

const connectDB = async () => {
    try {
        // Use environment variable or fallback to local
        const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flora_manager';
        
        await mongoose.connect(MONGO_URI);
        console.log('✅ MongoDB Connected Successfully');

        // --- SEEDING DEFAULT DATA (Disabled by default) ---
        // To opt-in to seeding, set environment variable SEED_DB=true when starting the server.
        const shouldSeed = String(process.env.SEED_DB || '').toLowerCase() === 'true';
        if (shouldSeed) {
          console.log('🔁 SEED_DB=true — running initial data seed');

          // 1. Users
          const userCount = await User.countDocuments();
          if (userCount === 0) {
              console.log("🌱 Seeding Users...");
              await User.create([
                  { id: 'u1', username: 'admin', password: 'admin123', name: 'Super Admin', role: 'ADMIN' },
                  { id: 'u2', username: 'staff', password: 'staff123', name: 'John Sales', role: 'SALES_STAFF' }
              ]);
          }

          // 2. Products
          const productCount = await Product.countDocuments();
          if (productCount === 0) {
              console.log("🌱 Seeding Products...");
              await Product.create([
                  { id: 'p1', name: 'Red Rose', defaultPrice: 20, category: 'Roses' },
                  { id: 'p2', name: 'White Lily', defaultPrice: 35, category: 'Lilies' },
                  { id: 'p3', name: 'Pink Tulip', defaultPrice: 40, category: 'Tulips' },
                  { id: 'p4', name: 'Blue Orchid', defaultPrice: 60, category: 'Orchids' },
                  { id: 'p5', name: 'Sunflower', defaultPrice: 25, category: 'Sunflowers' }
              ]);
          }

          // 3. Suppliers
          const supplierCount = await Supplier.countDocuments();
          if (supplierCount === 0) {
              console.log("🌱 Seeding Suppliers...");
              await Supplier.create([
                  { id: 'sup1', name: 'Global Flora Imports', contact: '555-0101', outstandingBalance: 0 },
                  { id: 'sup2', name: 'City Garden Wholesalers', contact: '555-0202', outstandingBalance: 0 }
              ]);
          }

          // 4. Stock (So POS is not empty)
          const stockCount = await Stock.countDocuments();
          if (stockCount === 0) {
              console.log("🌱 Seeding Initial Stock...");
              const today = new Date().toISOString().split('T')[0];
              await Stock.create([
                  { id: 'b1', productId: 'p1', productName: 'Red Rose', quantity: 50, purchasePrice: 10, sellingPrice: 20, purchaseDate: today, originalQuantity: 50, supplierId: 'sup1', supplierName: 'Global Flora Imports', paymentStatus: 'PAID' },
                  { id: 'b2', productId: 'p2', productName: 'White Lily', quantity: 30, purchasePrice: 20, sellingPrice: 35, purchaseDate: today, originalQuantity: 30, supplierId: 'sup2', supplierName: 'City Garden Wholesalers', paymentStatus: 'PAID' },
                  { id: 'b3', productId: 'p3', productName: 'Pink Tulip', quantity: 40, purchasePrice: 25, sellingPrice: 40, purchaseDate: today, originalQuantity: 40, supplierId: 'sup1', supplierName: 'Global Flora Imports', paymentStatus: 'PAID' }
              ]);
          }
        } else {
          console.log('🔕 SEED_DB not set — skipping initial data seed');
        }

    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;