// src/db.js - THE SUPREME ENGINE (V8.5 DEPLOYMENT READY)
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

  // 1. USERS Table
  dbConnection.run(`CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    full_name     TEXT NOT NULL,
    phone         TEXT NOT NULL UNIQUE,
    email         TEXT,
    password_hash TEXT,
    role          TEXT NOT NULL CHECK(role IN ('TENANT','LANDLORD','CARETAKER','AGENT')),
    business_name TEXT,
    referral_code TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
  )`);

  // 2. PROPERTIES (PLOTS) Table
  dbConnection.run(`CREATE TABLE IF NOT EXISTS properties (
    id             TEXT PRIMARY KEY,
    owner_id       TEXT NOT NULL REFERENCES users(id),
    name           TEXT NOT NULL,
    location       TEXT NOT NULL,
    city           TEXT DEFAULT 'Nairobi',
    total_floors   INTEGER DEFAULT 1,
    payment_methods TEXT,
    rules          TEXT,
    requirements   TEXT,
    is_verified    INTEGER DEFAULT 0,
    created_at     TEXT DEFAULT (datetime('now'))
  )`);

  // 3. UNITS Table
  dbConnection.run(`CREATE TABLE IF NOT EXISTS units (
    id             TEXT PRIMARY KEY,
    property_id    TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    unit_number    TEXT NOT NULL,
    unit_type      TEXT DEFAULT 'BEDSITTER',
    monthly_rent   INTEGER NOT NULL,
    status         TEXT NOT NULL DEFAULT 'VACANT' CHECK(status IN ('VACANT','RESERVED','OCCUPIED','MAINTENANCE')),
    created_at     TEXT DEFAULT (datetime('now'))
  )`);

  // 4. LISTINGS Table
  dbConnection.run(`CREATE TABLE IF NOT EXISTS listings (
    id             TEXT PRIMARY KEY,
    unit_id        TEXT REFERENCES units(id),
    property_id    TEXT NOT NULL REFERENCES properties(id),
    listing_type   TEXT NOT NULL CHECK(listing_type IN ('RENT','SALE')),
    category       TEXT DEFAULT 'HOUSE',
    title          TEXT NOT NULL,
    price          INTEGER NOT NULL,
    description    TEXT,
    is_featured    INTEGER DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at     TEXT DEFAULT (datetime('now'))
  )`);

  // 5. INQUIRIES (LEADS) Table
  dbConnection.run(`CREATE TABLE IF NOT EXISTS inquiries (
    id             TEXT PRIMARY KEY,
    listing_id     TEXT NOT NULL REFERENCES listings(id),
    name           TEXT NOT NULL,
    phone          TEXT NOT NULL,
    message        TEXT,
    status         TEXT NOT NULL DEFAULT 'NEW',
    created_at     TEXT DEFAULT (datetime('now'))
  )`);

  // 6. TENANCIES Table
  dbConnection.run(`CREATE TABLE IF NOT EXISTS tenancies (
    id                 TEXT PRIMARY KEY,
    tenant_id          TEXT NOT NULL REFERENCES users(id),
    unit_id            TEXT NOT NULL REFERENCES units(id),
    monthly_rent       INTEGER NOT NULL,
    status             TEXT NOT NULL DEFAULT 'ACTIVE',
    move_in_date       TEXT DEFAULT (date('now')),
    rating             INTEGER,
    feedback           TEXT,
    referred_by        TEXT,
    created_at         TEXT DEFAULT (datetime('now'))
  )`);

  // 7. PAYMENTS Table
  dbConnection.run(`CREATE TABLE IF NOT EXISTS rent_payments (
    id             TEXT PRIMARY KEY,
    tenancy_id     TEXT NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
    amount         INTEGER NOT NULL,
    recorded_at    TEXT DEFAULT (datetime('now'))
  )`);

  // 8. MAINTENANCE Table
  dbConnection.run(`CREATE TABLE IF NOT EXISTS maintenance_tickets (
    id             TEXT PRIMARY KEY,
    tenancy_id     TEXT NOT NULL REFERENCES tenancies(id),
    category       TEXT NOT NULL,
    description    TEXT NOT NULL,
    cost           INTEGER DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'OPEN',
    created_at     TEXT DEFAULT (datetime('now'))
  )`);

  // 9. UTILITIES & REQUESTS
  dbConnection.run(`CREATE TABLE IF NOT EXISTS utility_bills (
    id             TEXT PRIMARY KEY,
    tenancy_id     TEXT NOT NULL REFERENCES tenancies(id),
    type           TEXT,
    amount         INTEGER NOT NULL,
    billing_month  TEXT NOT NULL,
    status         TEXT DEFAULT 'UNPAID',
    created_at     TEXT DEFAULT (datetime('now'))
  )`);

  dbConnection.run(`CREATE TABLE IF NOT EXISTS switch_requests (
    id             TEXT PRIMARY KEY,
    tenancy_id     TEXT NOT NULL REFERENCES tenancies(id),
    from_unit      TEXT NOT NULL,
    to_unit        TEXT NOT NULL,
    reason         TEXT,
    status         TEXT DEFAULT 'PENDING',
    created_at     TEXT DEFAULT (datetime('now'))
  )`);

  dbConnection.run(`CREATE TABLE IF NOT EXISTS vacate_requests (
    id             TEXT PRIMARY KEY,
    tenancy_id     TEXT NOT NULL REFERENCES tenancies(id),
    vacate_date    TEXT NOT NULL,
    reason         TEXT,
    status         TEXT DEFAULT 'PENDING',
    created_at     TEXT DEFAULT (datetime('now'))
  )`);

  dbConnection.run(`CREATE TABLE IF NOT EXISTS access_requests (
    id             TEXT PRIMARY KEY,
    property_name  TEXT NOT NULL,
    house_number   TEXT NOT NULL,
    full_name      TEXT NOT NULL,
    phone          TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'PENDING',
    created_at     TEXT DEFAULT (datetime('now'))
  )`);

  // --- MIGRATION: Ensure is_verified exists ---
  dbConnection.all(`PRAGMA table_info(properties)`, (err, rows) => {
    if (rows && !rows.find(r => r.name === 'is_verified')) {
        dbConnection.run(`ALTER TABLE properties ADD COLUMN is_verified INTEGER DEFAULT 0`);
    }
  });
});

const db = {
  get: (sql, params = []) => new Promise((res, rej) => dbConnection.get(sql, params, (err, row) => err ? rej(err) : res(row))),
  all: (sql, params = []) => new Promise((res, rej) => dbConnection.all(sql, params, (err, rows) => err ? rej(err) : res(rows))),
  run: (sql, params = []) => new Promise((res, rej) => dbConnection.run(sql, params, (err) => err ? rej(err) : res()))
};

module.exports = db;
