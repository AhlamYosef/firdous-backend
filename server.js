// ==============================================
// Arabic Herbal Store - Backend API
// Node.js + Express + SQLite
// ==============================================

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==============================================
// Database Schema (SQLite)
// ==============================================
import Database from 'better-sqlite3';
const db = new Database('herbal-store.db');

// Initialize database tables
db.exec(`
  -- Users Table
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'Saudi Arabia',
    role TEXT DEFAULT 'customer',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Products Table
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    old_price REAL,
    image TEXT,
    category TEXT NOT NULL,
    sub_category TEXT,
    rating REAL DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    in_stock INTEGER DEFAULT 1,
    featured INTEGER DEFAULT 0,
    ingredients TEXT,
    benefits TEXT,
    shipping_cost REAL DEFAULT 0,
    -- Gulf Countries Prices
    price_sa REAL,
    price_ae REAL,
    price_kw REAL,
    price_bh REAL,
    price_qa REAL,
    price_om REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Categories Table
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Countries Table
  CREATE TABLE IF NOT EXISTS countries (
    id TEXT PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    code TEXT NOT NULL,
    currency TEXT NOT NULL,
    currency_symbol TEXT NOT NULL,
    exchange_rate REAL DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Orders Table
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    status TEXT DEFAULT 'pending',
    total REAL NOT NULL,
    shipping_cost REAL DEFAULT 0,
    customer_name TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    address TEXT,
    city TEXT,
    country TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- Order Items Table
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    product_image TEXT,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  -- Reviews Table
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_id INTEGER,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_approved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

 -- Site Settings Table
  CREATE TABLE IF NOT EXISTS site_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_name TEXT UNIQUE NOT NULL,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Page Views Table
  CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page TEXT NOT NULL,
    referrer TEXT,
    device TEXT DEFAULT 'desktop',
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ==============================================
// Seed Database with Sample Data
// ==============================================
function seedDatabase() {
  // Check if data exists
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get();

  if (productCount.count === 0) {
    console.log('Seeding database with sample data...');

    // Insert categories
    const insertCategory = db.prepare('INSERT INTO categories (name, icon, color, sort_order) VALUES (?, ?, ?, ?)');
    const categories = [
      ['منتجات زوجية', 'Heart', 'bg-rose-100 text-rose-600', 1],
      ['أعشاب طبيعية', 'Leaf', 'bg-herb-100 text-herb-700', 2],
      ['عسل طبيعي', 'Droplets', 'bg-amber-100 text-amber-700', 3],
      ['مساحيق تجميل', 'Sparkles', 'bg-purple-100 text-purple-600', 4],
    ];
    categories.forEach(cat => insertCategory.run(...cat));

    // Insert countries
    const insertCountry = db.prepare('INSERT INTO countries (id, name_ar, name_en, code, currency, currency_symbol, exchange_rate) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const countries = [
      ['sa', 'المملكة العربية السعودية', 'Saudi Arabia', 'SA', 'ريال سعودي', 'ر.س', 1.0000],
      ['ae', 'الإمارات العربية المتحدة', 'United Arab Emirates', 'AE', 'درهم إماراتي', 'د.إ', 1.0200],
      ['kw', 'دولة الكويت', 'Kuwait', 'KW', 'دينار كويتي', 'د.ك', 0.0820],
      ['bh', 'مملكة البحرين', 'Bahrain', 'BH', 'دينار بحريني', 'د.ب', 0.9400],
      ['qa', 'دولة قطر', 'Qatar', 'QA', 'ريال قطري', 'ر.ق', 0.9700],
      ['om', 'سلطنة عُمان', 'Oman', 'OM', 'ريال عماني', 'ر.ع.', 0.9700],
    ];
    countries.forEach(country => insertCountry.run(...country));

    // Insert products
    const insertProduct = db.prepare(`
      INSERT INTO products (name, description, price, old_price, image, category, rating, in_stock, featured, ingredients, benefits, price_sa, price_ae, price_kw, price_bh, price_qa, price_om)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const products = [
      ['زيت الورد المغذي للشعر', 'زيت طبيعي مغصل من بتيل الورد الطازج، يرطب الشعر الجاف والتالف ويمنحه لمعان طبيعي', 89, 120, 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=500', 'cosmetics', 4.8, 1, 1, '["زيت الورد", "زيت الجوجوبا", "فيتامين E"]', '["ترطيب عميق", "تقوية الشعر", "لمعان طبيعي"]', 89, 91, 7.3, 84, 86, 86],
      ['كريم الورد للوجه', 'كريم النهار المرطب بحليب الغزال وزيت الورد الطبيعي للبشرة الدهنية والمختلطة', 145, null, 'https://images.unsplash.com/photo-1617897903246-719242758050?w=500', 'cosmetics', 4.9, 1, 1, '["حليب الغزال", "زيت الورد", "ماء الورد"]', '["ترطيب 24 ساعة", "تفتيح البشرة", "مضاد للأكسدة"]', 145, 148, 11.9, 136, 141, 141],
      ['غسول العسل والزعتر', 'غسول طبيعي للمنطقة الحساسة بمكونات عشبية آمنة وخالية من الكيماويات', 65, null, 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500', 'couples', 4.7, 1, 0, '["عسل طبيعي", "زعتر", "بابونج", "ماء الورد"]', '["تنظيف لطيف", "تعقيم", "رائحة منعشة"]', 65, 66, 5.3, 61, 63, 63],
      ['بودرة الكركم التفتيح', 'بودرة كركم طبيعية مخلوطة بالأعشاب لتفتيح الجسم والمنطقة الحساسة', 55, null, 'https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=500', 'couples', 4.6, 1, 0, '["كركم", "حليب", "نشا أرز", "زعفران"]', '["تفتيح تدريجي", "تنظيف البشرة", "ترطيب"]', 55, 56, 4.5, 52, 53, 53],
      ['خلطة الأعشاب الزوجية', 'خلطة سرية من الأعشاب الطبيعية لزيادة الطاقة والحيوية', 175, 220, 'https://images.unsplash.com/photo-1515023115689-589c33041d3c?w=500', 'couples', 4.9, 1, 1, '["الزعتر البري", "الحلبة", "القرفة", "الزعفران", "الجينسنغ"]', '["زيادة الطاقة", "تحسين الدورة الدموية", "تعزيز المناعة"]', 175, 179, 14.4, 165, 170, 170],
      ['عسل السدر الأصلي', 'عسل سدر يمني أصلي 100% من أعظم المراعي الطبيعية', 195, 250, 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=500', 'honey', 5.0, 1, 1, '["عسل سدر"]', '["طاقة فورية", "تقوية المناعة", "علاج القولون"]', 195, 199, 16.0, 183, 189, 189],
      ['غذاء ملكات النحل', 'غذاء الملكات الطبيعي الغني بالفيتامينات والمعادن', 320, null, 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=500', 'honey', 4.9, 1, 1, '["غذاء الملكات", "عسل طبيعي"]', '["زيادة الطاقة", "تحسين الخصوبة", "مضاد للأكسدة"]', 320, 326, 26.2, 301, 310, 310],
      ['شاي الأعشاب الاسترخائي', 'شاي طبيعي للبابونج والنعناع للاسترخاء وتحسين النوم', 45, null, 'https://images.unsplash.com/photo-1563911892437-f1e3c3bee35a?w=500', 'herbs', 4.8, 1, 0, '["بابونج", "نعناع", "قشر ليمون", "زهور الليلك"]', '["الاسترخاء", "تحسين النوم", "تهدئة الأعصاب"]', 45, 46, 3.7, 42, 44, 44],
    ];
    products.forEach(prod => insertProduct.run(...prod));

    // Insert admin user (password: admin123)
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run('مدير الموقع', 'admin@herbal-store.com', hashedPassword, 'admin');

    // Insert site settings
    const insertSetting = db.prepare('INSERT INTO site_settings (key_name, value) VALUES (?, ?)');
    const settings = [
      ['store_name', 'متجر الطبيعة والعافية'],
      ['store_description', 'منتجات طبيعية 100% للحياة الصحية'],
      ['store_whatsapp', '966501234567'],
      ['free_shipping_threshold', '200'],
      ['shipping_cost', '25'],
      ['currency_rate', '3.75'],
    ];
    settings.forEach(set => insertSetting.run(...set));

    console.log('Database seeded successfully!');
  }
}

seedDatabase();

// ==============================================
// API Routes
// ==============================================

// Products API
app.get('/api/products', (req, res) => {
  const { category, featured, search } = req.query;
  let query = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (featured === 'true') {
    query += ' AND featured = 1';
  }
  if (search) {
    query += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY created_at DESC';
  const products = db.prepare(query).all(...params);
  res.json(products);
});

app.get('/api/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (product) {
    res.json(product);
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

// Categories API
app.get('/api/categories', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.json(categories);
});

// Countries API
app.get('/api/countries', (req, res) => {
  const countries = db.prepare('SELECT * FROM countries WHERE is_active = 1').all();
  res.json(countries);
});

// Orders API
app.get('/api/orders', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  res.json(orders);
});

app.post('/api/orders', (req, res) => {
  const { items, customer, total, shipping_cost } = req.body;

  const stmt = db.prepare(`
    INSERT INTO orders (user_id, total, shipping_cost, customer_name, customer_phone, customer_email, address, city, country, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    customer.userId || null,
    total,
    shipping_cost || 0,
    customer.name,
    customer.phone,
    customer.email,
    customer.address,
    customer.city,
    customer.country,
    customer.notes
  );

  const orderId = result.lastInsertRowid;

  // Insert order items
  const itemStmt = db.prepare('INSERT INTO order_items (order_id, product_id, product_name, product_image, price, quantity) VALUES (?, ?, ?, ?, ?, ?)');
  items.forEach(item => {
    itemStmt.run(orderId, item.product.id, item.product.name, item.product.image, item.price, item.quantity);
  });

  res.json({ id: orderId, status: 'success' });
});

app.put('/api/orders/:id/status', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

// Reviews API
app.get('/api/reviews/product/:id', (req, res) => {
  const reviews = db.prepare('SELECT * FROM reviews WHERE product_id = ? AND is_approved = 1 ORDER BY created_at DESC').all(req.params.id);
  res.json(reviews);
});

app.post('/api/reviews', (req, res) => {
  const { product_id, user_id, rating, comment } = req.body;
  db.prepare('INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)').run(product_id, user_id, rating, comment);
  res.json({ success: true });
});

// Site Settings API
app.get('/api/settings', (req, res) => {
  const settings = db.prepare('SELECT key_name, value FROM site_settings').all();
  const settingsObj = {};
  settings.forEach(s => settingsObj[s.key_name] = s.value);
  res.json(settingsObj);
});

app.put('/api/settings', (req, res) => {
  const { key_name, value } = req.body;
  db.prepare('INSERT OR REPLACE INTO site_settings (key_name, value) VALUES (?, ?)').run(key_name, value);
  res.json({ success: true });
});

// Analytics API
app.post('/api/analytics/pageview', (req, res) => {
  const { page, referrer, device, ip_address, user_agent } = req.body;
  db.prepare('INSERT INTO page_views (page, referrer, device, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)').run(page, referrer, device, ip_address, user_agent);
  res.json({ success: true });
});

app.get('/api/analytics/pageviews', (req, res) => {
  const { days = 7 } = req.query;
  const views = db.prepare('SELECT DATE(created_at) as date, COUNT(*) as views FROM page_views WHERE created_at >= date("now", "-' + days + ' days") GROUP BY DATE(created_at) ORDER BY date').all();
  res.json(views);
});

// Auth API
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, phone } = req.body;
  const bcrypt = require('bcryptjs');
  const hashedPassword = bcrypt.hashSync(password, 10);

  try {
    const result = db.prepare('INSERT INTO users (name, email, password, phone) VALUES (?, ?, ?, ?)').run(name, email, hashedPassword, phone);
    res.json({ success: true, userId: result.lastInsertRowid });
  } catch (error) {
    res.status(400).json({ error: 'Email already exists' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const bcrypt = require('bcryptjs');

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (user && bcrypt.compareSync(password, user.password)) {
    const token = require('jsonwebtoken').sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'secret');
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../frontend/dist/index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api`);
});

export default app;