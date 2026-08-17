// src/db.js - THE SUPREME ENGINE (V8.1 FINAL)
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'housing_v2.db');

const dbConnection = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error('DATABASE ERROR:', err.message);
  else console.log('DATABASE CONNECTED: housing_v2.db');
});

dbConnection.serialize(() => {
  dbConnection.run('PRAGMA journal_mode = WAL;');
  dbConnection.run('PRAGMA foreign_keys = ON;');

  // Core Tables
  dbConnection.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, full_name TEXT NOT NULL, phone TEXT UNIQUE NOT NULL, email TEXT, password_hash TEXT, role TEXT NOT NULL, business_name TEXT, created_at TEXT DEFAULT (datetime('now')))`);
  dbConnection.run(`CREATE TABLE IF NOT EXISTS properties (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, location TEXT NOT NULL, total_floors INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(owner_id) REFERENCES users(id))`);
  dbConnection.run(`CREATE TABLE IF NOT EXISTS units (id TEXT PRIMARY KEY, property_id TEXT NOT NULL, unit_number TEXT NOT NULL, unit_type TEXT DEFAULT 'BEDSITTER', monthly_rent INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'VACANT', created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(property_id) REFERENCES properties(id) ON DELETE CASCADE)`);
  dbConnection.run(`CREATE TABLE IF NOT EXISTS listings (id TEXT PRIMARY KEY, unit_id TEXT, property_id TEXT NOT NULL, title TEXT NOT NULL, price INTEGER NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE', created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(property_id) REFERENCES properties(id))`);
  dbConnection.run(`CREATE TABLE IF NOT EXISTS listing_photos (id TEXT PRIMARY KEY, listing_id TEXT NOT NULL, photo_url TEXT NOT NULL, FOREIGN KEY(listing_id) REFERENCES listings(id) ON DELETE CASCADE)`);
  dbConnection.run(`CREATE TABLE IF NOT EXISTS inquiries (id TEXT PRIMARY KEY, listing_id TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, message TEXT, status TEXT DEFAULT 'NEW', created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(listing_id) REFERENCES listings(id))`);
  dbConnection.run(`CREATE TABLE IF NOT EXISTS tenancies (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, unit_id TEXT NOT NULL, monthly_rent INTEGER NOT NULL, status TEXT DEFAULT 'ACTIVE', created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(tenant_id) REFERENCES users(id), FOREIGN KEY(unit_id) REFERENCES units(id))`);
  dbConnection.run(`CREATE TABLE IF NOT EXISTS rent_payments (id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL, amount INTEGER NOT NULL, recorded_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(tenancy_id) REFERENCES tenancies(id) ON DELETE CASCADE)`);
  dbConnection.run(`CREATE TABLE IF NOT EXISTS maintenance_tickets (id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, cost INTEGER DEFAULT 0, status TEXT DEFAULT 'OPEN', created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(tenancy_id) REFERENCES tenancies(id))`);
  dbConnection.run(`CREATE TABLE IF NOT EXISTS access_requests (id TEXT PRIMARY KEY, property_name TEXT NOT NULL, house_number TEXT NOT NULL, full_name TEXT NOT NULL, phone TEXT NOT NULL, status TEXT DEFAULT 'PENDING', created_at TEXT DEFAULT (datetime('now')))`);
  dbConnection.run(`CREATE TABLE IF NOT EXISTS utility_bills (id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL, type TEXT, amount INTEGER NOT NULL, billing_month TEXT, status TEXT DEFAULT 'UNPAID', created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(tenancy_id) REFERENCES tenancies(id))`);
});

const db = {
  get: (sql, params = []) => new Promise((res, rej) => dbConnection.get(sql, params, (err, row) => err ? rej(err) : res(row))),
  all: (sql, params = []) => new Promise((res, rej) => dbConnection.all(sql, params, (err, rows) => err ? rej(err) : res(rows))),
  run: (sql, params = []) => new Promise((res, rej) => dbConnection.run(sql, params, (err) => err ? rej(err) : res()))
};

module.exports = db;
