// src/db.js - COMBOPADS TITAN DATABASE ENGINE
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'housing_v2.db');
const rawDb = new sqlite3.Database(DB_PATH);

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'TENANT',
  business_name TEXT,
  bio TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  total_floors INTEGER,
  amenities TEXT,
  whatsapp_group_link TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  floor_number INTEGER,
  unit_number TEXT NOT NULL,
  unit_type TEXT,
  bedrooms INTEGER DEFAULT 0,
  monthly_rent REAL NOT NULL,
  status TEXT DEFAULT 'VACANT',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  unit_id TEXT,
  property_id TEXT NOT NULL,
  listing_type TEXT DEFAULT 'RENT',
  title TEXT NOT NULL,
  price REAL NOT NULL,
  description TEXT,
  cover_photo TEXT,
  status TEXT DEFAULT 'ACTIVE',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS listing_photos (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenancies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  monthly_rent REAL NOT NULL,
  status TEXT DEFAULT 'APPLIED',
  verification_code TEXT,
  referral_code TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rent_payments (
  id TEXT PRIMARY KEY,
  tenancy_id TEXT NOT NULL,
  amount REAL NOT NULL,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_excuses (
  id TEXT PRIMARY KEY,
  tenancy_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'PENDING',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS maintenance_tickets (
  id TEXT PRIMARY KEY,
  tenancy_id TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'OPEN',
  cost REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS access_requests (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  property_name TEXT NOT NULL,
  house_number TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS switch_requests (
  id TEXT PRIMARY KEY,
  tenancy_id TEXT NOT NULL,
  from_unit TEXT,
  to_unit TEXT,
  reason TEXT,
  status TEXT DEFAULT 'PENDING',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vacate_requests (
  id TEXT PRIMARY KEY,
  tenancy_id TEXT NOT NULL,
  vacate_date TEXT,
  reason TEXT,
  status TEXT DEFAULT 'PENDING',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

// Initialize Tables
rawDb.exec(schema, (err) => {
  if (err) console.error('Error initializing ComboPads DB schema:', err.message);
  else console.log('ComboPads Titan DB schema ready.');
});

// Promise-based async DB helper object
const db = {
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      rawDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      rawDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      rawDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  prepare(sql) {
    const stmt = rawDb.prepare(sql);
    return {
      get(params, cb) {
        if (typeof params === 'function') {
          return stmt.get(params);
        }
        if (Array.isArray(params)) {
          return stmt.get(...params, cb);
        }
        return stmt.get(params, cb);
      },
      run(...args) {
        return stmt.run(...args);
      }
    };
  },
  rawDb
};

module.exports = db;
