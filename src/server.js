// src/server.js - THE EMPEROR ENGINE (V9.0 GLOBAL DOMINANCE)
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// CLOUD READY PORT
const PORT = process.env.PORT || 5001;
const SETUP_KEY = 'baraka-setup-2026';

// --- TITAN HELPERS ---
function normalizePhone(p) {
    const d = String(p || '').replace(/\D/g, '');
    return d.startsWith('254') ? d : '254' + (d.startsWith('0') ? d.slice(1) : d);
}

const sessions = new Map();
function createSession(uid) {
    const t = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessions.set(t, uid); return t;
}

const auth = (roleType) => async (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const t = authHeader.split(' ')[1];
    if (!t || !sessions.has(t)) return res.status(401).json({ error: 'Session expired' });
    try {
        const u = await db.get('SELECT * FROM users WHERE id = ?', [sessions.get(t)]);
        if (!u) return res.status(401).json({ error: 'User not found' });
        if (roleType === 'ADMIN' && !['LANDLORD','AGENT','CARETAKER'].includes(u.role)) return res.status(403).json({ error: 'Denied' });
        req.user = u; next();
    } catch (err) { res.status(500).json({ error: 'Auth failure' }); }
};

// ============================================================================
// PUBLIC MARKETPLACE
// ============================================================================
app.get('/api/listings', async (req, res) => {
    try {
        const { search, maxPrice, category } = req.query;
        let q = `SELECT l.*, p.name as property_name, p.location, p.is_verified FROM listings l JOIN properties p ON l.property_id = p.id WHERE l.status='ACTIVE'`;
        const params = [];
        if(search) { q += ` AND (l.title LIKE ? OR p.name LIKE ? OR p.location LIKE ?)`; const s = `%${search}%`; params.push(s,s,s); }
        if(maxPrice) { q += ` AND l.price <= ?`; params.push(maxPrice); }
        if(category && category !== 'ALL') { q += ` AND l.category = ?`; params.push(category); }
        res.json(await db.all(q, params));
    } catch (err) { res.status(500).json({ error: 'Search failed' }); }
});

app.get('/api/listings/:id', async (req, res) => {
    try {
        const l = await db.get(`SELECT l.*, p.name as property_name, p.location as property_location, p.rules, p.is_verified, u.unit_number, u.id as unit_id FROM listings l JOIN properties p ON l.property_id=p.id LEFT JOIN units u ON l.unit_id=u.id WHERE l.id=?`, [req.params.id]);
        if(!l) return res.status(404).json({error:'Not found'});
        const ph = await db.all('SELECT photo_url FROM listing_photos WHERE listing_id=?', [req.params.id]);
        res.json({...l, photos: ph || []});
    } catch (err) { res.status(500).json({ error: 'House load failed' }); }
});

app.post('/api/inquiries', async (req, res) => {
    try {
        await db.run(`INSERT INTO inquiries (id, listing_id, name, phone, message) VALUES (?,?,?,?,?)`, [`inq_${Date.now()}`, req.body.listingId, req.body.name, req.body.phone, req.body.message||'']);
        res.json({ok:true});
    } catch (err) { res.status(500).json({ error: 'Inquiry failed' }); }
});

app.post('/api/apply', async (req, res) => {
    try {
        const { unitId, name, phone } = req.body;
        const norm = normalizePhone(phone);
        let user = await db.get('SELECT id FROM users WHERE phone=?', [norm]);
        if(!user) {
            const uid = `usr_${Date.now()}`;
            await db.run(`INSERT INTO users (id, full_name, phone, role) VALUES (?,?,?,'TENANT')`, [uid, name, norm]);
            user = { id: uid };
        }
        const tid = `ten_${Date.now()}`;
        const code = "123456";
        const unit = await db.get('SELECT monthly_rent FROM units WHERE id=?', [unitId]);
        await db.run(`INSERT INTO tenancies (id, tenant_id, unit_id, monthly_rent, status, verification_code) VALUES (?,?,?,?,'APPLIED',?)`, [tid, user.id, unitId, unit.monthly_rent, code]);
        await db.run(`UPDATE units SET status='RESERVED' WHERE id=?`, [unitId]);
        res.json({ ok:true, tenancyId:tid, verificationCode:code });
    } catch (err) { res.status(500).json({ error: 'Application failed' }); }
});

// ============================================================================
// ADMIN SIDE POWER (V9)
// ============================================================================
app.get('/api/admin/stats', auth('ADMIN'), async (req, res) => {
    try {
        const q = `SELECT
            (SELECT COUNT(*) FROM units u JOIN properties p ON u.property_id=p.id WHERE p.owner_id=?) as total_units,
            (SELECT COUNT(*) FROM units u JOIN properties p ON u.property_id=p.id WHERE p.owner_id=? AND u.status='OCCUPIED') as occupied_units,
            (SELECT COUNT(*) FROM tenancies t JOIN units un ON t.unit_id=un.id JOIN properties p ON un.property_id=p.id WHERE p.owner_id=? AND t.status IN ('APPLIED','VERIFIED')) as new_applications,
            (SELECT COUNT(*) FROM maintenance_tickets mt JOIN tenancies t ON mt.tenancy_id=t.id JOIN units un ON t.unit_id=un.id JOIN properties p ON un.property_id=p.id WHERE p.owner_id=? AND mt.status='OPEN') as open_tickets,
            (SELECT SUM(monthly_rent) FROM units u JOIN properties p ON u.property_id=p.id WHERE p.owner_id=?) as potential_revenue,
            (SELECT SUM(amount) FROM rent_payments rp JOIN tenancies t ON rp.tenancy_id=t.id JOIN units un ON t.unit_id=un.id JOIN properties p ON un.property_id=p.id WHERE p.owner_id=? AND strftime('%Y-%m', rp.recorded_at) = strftime('%Y-%m', 'now')) as actual_revenue`;

        const stats = await db.get(q, [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]);
        res.json({ ...stats, role: req.user.role });
    } catch (err) { res.status(500).json({ error: 'Stats failed' }); }
});

app.post('/api/admin/property/:id/bulk-list', auth('ADMIN'), async (req, res) => {
    try {
        const { title, price, description } = req.body;
        const vacantUnits = await db.all(`SELECT id FROM units WHERE property_id=? AND status='VACANT'`, [req.params.id]);
        for (let unit of vacantUnits) {
            await db.run(`INSERT INTO listings (id, unit_id, property_id, listing_type, title, price, description, status) VALUES (?,?,?, 'RENT',?,?,?,'ACTIVE')`, [`lst_${Date.now()}_${unit.id}`, unit.id, req.params.id, title, price, description]);
        }
        res.json({ok:true, count: vacantUnits.length});
    } catch (err) { res.status(500).json({ error: 'Bulk listing failed' }); }
});

app.post('/api/admin/properties/:id/verify', auth('ADMIN'), async (req, res) => {
    // Only MASTER ADMIN could do this normally, but let's allow owner for now
    await db.run(`UPDATE properties SET is_verified = 1 WHERE id = ?`, [req.params.id]);
    res.json({ok:true});
});

app.get('/api/admin/applications', auth('ADMIN'), async (req, res) => {
    try {
        const apps = await db.all(`SELECT t.*, u.full_name, un.unit_number, p.name as property_name FROM tenancies t JOIN users u ON t.tenant_id = u.id JOIN units un ON t.unit_id = un.id JOIN properties p ON un.property_id = p.id WHERE p.owner_id=? AND t.status IN ('APPLIED','VERIFIED')`, [req.user.id]);
        const switches = await db.all(`SELECT s.*, u.full_name, p.name as property_name FROM switch_requests s JOIN tenancies t ON s.tenancy_id = t.id JOIN users u ON t.tenant_id = u.id JOIN units un ON t.unit_id = un.id JOIN properties p ON un.property_id = p.id WHERE p.owner_id=? AND s.status = 'PENDING'`, [req.user.id]);
        const vacates = await db.all(`SELECT v.*, u.full_name, un.unit_number, p.name as property_name FROM vacate_requests v JOIN tenancies t ON v.tenancy_id = t.id JOIN users u ON t.tenant_id = u.id JOIN units un ON t.unit_id = un.id JOIN properties p ON un.property_id = p.id WHERE p.owner_id=? AND v.status = 'PENDING'`, [req.user.id]);
        res.json({ apps, switches, vacates });
    } catch (err) { res.status(500).json({ error: 'Apps failed' }); }
});

// ============================================================================
// TENANT PORTAL
// ============================================================================
app.get('/api/tenant/plot-status', auth('TENANT'), async (req, res) => {
    try {
        const q = `SELECT t.id, t.monthly_rent, p.name as plot_name, p.is_verified, un.unit_number, u.full_name,
            (SELECT SUM(amount) FROM rent_payments WHERE tenancy_id=t.id AND strftime('%m', recorded_at)=strftime('%m','now')) as paid,
            (SELECT SUM(amount) FROM utility_bills WHERE tenancy_id=t.id AND status='UNPAID') as bill_total
            FROM tenancies t JOIN units un ON t.unit_id=un.id JOIN properties p ON un.property_id=p.id JOIN users u ON t.tenant_id=u.id WHERE t.tenant_id=? AND t.status='ACTIVE'`;
        const row = await db.get(q, [req.user.id]);
        if(!row) return res.status(404).json({error:'Plot not found'});
        const balance = (row.monthly_rent + (row.bill_total||0)) - (row.paid||0);
        res.json({...row, balance: Math.max(0, balance), phone: req.user.phone });
    } catch (err) { res.status(500).json({ error: 'Status fetch failed' }); }
});

// --- REMAINING ROUTES ---
app.post('/api/auth/register-partner', async (req, res) => {
    if(req.body.setupKey !== SETUP_KEY) return res.status(403).json({error:'Invalid Key'});
    const hash = await bcrypt.hash(req.body.password, 10);
    const uid = `usr_${Date.now()}`;
    try {
        await db.run(`INSERT INTO users (id, full_name, phone, role, password_hash) VALUES (?,?,?,?,?)`, [uid, req.body.name, normalizePhone(req.body.phone), req.body.role, hash]);
        res.json({ok:true, token:createSession(uid)});
    } catch(e) { res.status(400).json({error:'Phone already registered'}); }
});

app.post('/api/auth/login', async (req, res) => {
    const u = await db.get(`SELECT * FROM users WHERE phone = ?`, [normalizePhone(req.body.phone)]);
    if(!u || !u.password_hash) return res.status(401).json({error:'Invalid'});
    const m = await bcrypt.compare(req.body.password, u.password_hash);
    if(!m) return res.status(401).json({error:'Invalid'});
    res.json({ok:true, token:createSession(u.id), role:u.role, name:u.full_name});
});

app.get('/api/admin/properties', auth('ADMIN'), async (req, res) => {
    res.json(await db.all(`SELECT * FROM properties WHERE owner_id=?`, [req.user.id]));
});

app.post('/api/admin/properties', auth('ADMIN'), async (req, res) => {
    await db.run(`INSERT INTO properties (id, owner_id, name, location, total_floors) VALUES (?,?,?,?,?)`, [`prop_${Date.now()}`, req.user.id, req.body.name, req.body.location, req.body.totalFloors||1]);
    res.json({ok:true});
});

app.get('/api/admin/properties/:id/units', auth('ADMIN'), async (req, res) => {
    res.json(await db.all(`SELECT * FROM units WHERE property_id=?`, [req.params.id]));
});

app.post('/api/admin/properties/:id/units', auth('ADMIN'), async (req, res) => {
    await db.run(`INSERT INTO units (id, property_id, unit_number, monthly_rent) VALUES (?,?,?,?)`, [`u_${Date.now()}`, req.params.id, req.body.unitNumber, req.body.monthlyRent]);
    res.json({ok:true});
});

app.post('/api/admin/applications/:id/move-in', auth('ADMIN'), async (req, res) => {
    await db.run(`UPDATE tenancies SET status='ACTIVE', move_in_date=date('now') WHERE id=?`, [req.params.id]);
    const t = await db.get(`SELECT unit_id FROM tenancies WHERE id=?`, [req.params.id]);
    await db.run(`UPDATE units SET status='OCCUPIED' WHERE id=?`, [t.unit_id]);
    res.json({ok:true});
});

app.get('/api/admin/maintenance', auth('ADMIN'), async (req, res) => {
    res.json(await db.all(`SELECT mt.*, un.unit_number, u.full_name, p.name as property_name FROM maintenance_tickets mt JOIN tenancies t ON mt.tenancy_id = t.id JOIN units un ON t.unit_id = un.id JOIN properties p ON un.property_id = p.id JOIN users u ON t.tenant_id = u.id WHERE p.owner_id=? ORDER BY mt.created_at DESC`, [req.user.id]));
});

app.post('/api/admin/maintenance/:id/resolve', auth('ADMIN'), async (req, res) => {
    await db.run(`UPDATE maintenance_tickets SET status='RESOLVED', cost=? WHERE id=?`, [req.body.cost||0, req.params.id]);
    res.json({ok:true});
});

app.get('/api/admin/financials', auth('ADMIN'), async (req, res) => {
    const month = new Date().toISOString().substring(0, 7);
    const e = await db.get(`SELECT SUM(monthly_rent) as total FROM units u JOIN properties p ON u.property_id=p.id WHERE p.owner_id=? AND u.status='OCCUPIED'`, [req.user.id]);
    const c = await db.get(`SELECT SUM(amount) as total FROM rent_payments rp JOIN tenancies t ON rp.tenancy_id=t.id JOIN units un ON t.unit_id=un.id JOIN properties p ON un.property_id=p.id WHERE p.owner_id=? AND strftime('%Y-%m', recorded_at)=?`, [req.user.id, month]);
    const u = await db.all(`SELECT u.full_name, un.unit_number, un.monthly_rent FROM tenancies t JOIN users u ON t.tenant_id=u.id JOIN units un ON t.unit_id=un.id JOIN properties p ON un.property_id=p.id WHERE p.owner_id=? AND t.status='ACTIVE' AND t.id NOT IN (SELECT tenancy_id FROM rent_payments WHERE strftime('%Y-%m', recorded_at)=?)`, [req.user.id, month]);
    res.json({ expected: e?.total||0, collected: c?.total||0, unpaidList: u||[] });
});

app.post('/api/admin/bill-utility', auth('ADMIN'), async (req, res) => {
    await db.run(`INSERT INTO utility_bills (id, tenancy_id, type, amount, curr_reading, billing_month) VALUES (?,?,?,?,?,?)`, [`bill_${Date.now()}`, req.body.tenancyId, req.body.type, req.body.amount, req.body.currReading, new Date().toISOString().substring(0, 7)]);
    res.json({ok:true});
});

app.get('/api/admin/utility-readings', auth('ADMIN'), async (req, res) => {
    const q = `SELECT t.id as tenancy_id, u.full_name, un.unit_number, p.name as property_name FROM tenancies t JOIN users u ON t.tenant_id = u.id JOIN units un ON t.unit_id = un.id JOIN properties p ON un.property_id = p.id WHERE p.owner_id=? AND t.status = 'ACTIVE'`;
    res.json(await db.all(q, [req.user.id]));
});

app.post('/api/tenant/maintenance', auth('TENANT'), async (req, res) => {
    await db.run(`INSERT INTO maintenance_tickets (id, tenancy_id, category, description) VALUES (?,?,?,?)`, [`tk_${Date.now()}`, req.body.tenancyId, req.body.category, req.body.description]);
    res.json({ok:true});
});

app.post('/api/tenant/request-switch', auth('TENANT'), async (req, res) => {
    await db.run(`INSERT INTO switch_requests (id, tenancy_id, from_unit, to_unit, reason) VALUES (?,?,?,?,?)`, [`sw_${Date.now()}`, req.body.tenancyId, req.body.fromUnit, req.body.toUnit, req.body.reason]);
    res.json({ok:true});
});

app.post('/api/tenant/request-vacate', auth('TENANT'), async (req, res) => {
    await db.run(`INSERT INTO vacate_requests (id, tenancy_id, vacate_date, reason) VALUES (?,?,?,?)`, [`vac_${Date.now()}`, req.body.tenancyId, req.body.vacateDate, req.body.reason]);
    res.json({ok:true});
});

app.listen(PORT, () => console.log(`SYSTEM READY ON PORT ${PORT}`));
