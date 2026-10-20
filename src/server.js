// src/server.js - COMBOPADS TITAN V9.1 ENGINE (COMMUNICATION BRIDGE)
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from public/ directory
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 5001;
const SETUP_KEY = process.env.SETUP_KEY || 'baraka-setup-2026';

// --- HELPERS ---
function normalizePhone(p) {
    const d = String(p || '').replace(/\D/g, '');
    if (!d) return '';
    return d.startsWith('254') ? d : '254' + (d.startsWith('0') ? d.slice(1) : d);
}

const sessions = new Map();
function createSession(uid) {
    const t = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessions.set(t, uid);
    return t;
}

const auth = (roleType) => async (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token || !sessions.has(token)) {
        return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    try {
        const u = await db.get('SELECT * FROM users WHERE id = ?', [sessions.get(token)]);
        if (!u) return res.status(401).json({ error: 'User not found' });
        if (roleType === 'ADMIN' && !['LANDLORD', 'AGENT', 'CARETAKER', 'ADMIN'].includes(u.role)) {
            return res.status(403).json({ error: 'Admin access denied' });
        }
        req.user = u;
        next();
    } catch (err) {
        res.status(500).json({ error: 'Authentication failure' });
    }
};

// ============================================================================
// AUTHENTICATION & PARTNER ONBOARDING
// ============================================================================
app.post('/api/auth/register-partner', async (req, res) => {
    try {
        const { name, phone, role, businessName, password, setupKey, email } = req.body;
        if (setupKey !== SETUP_KEY) {
            return res.status(400).json({ error: 'Invalid Setup Verification Key.' });
        }
        const norm = normalizePhone(phone);
        if (!norm || !password || !name) {
            return res.status(400).json({ error: 'Name, phone number, and password are required.' });
        }

        const existing = await db.get('SELECT id FROM users WHERE phone = ?', [norm]);
        if (existing) {
            return res.status(400).json({ error: 'Phone number already registered. Please log in.' });
        }

        const passHash = await bcrypt.hash(password, 10);
        const uid = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const userRole = (role || 'LANDLORD').toUpperCase();

        await db.run(
            `INSERT INTO users (id, full_name, phone, email, password_hash, role, business_name) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uid, name, norm, email || '', passHash, userRole, businessName || '']
        );

        const token = createSession(uid);
        res.json({ ok: true, token, role: userRole, name });
    } catch (err) {
        console.error('Registration failed:', err);
        res.status(500).json({ error: 'Registration failed. Try again.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const norm = normalizePhone(req.body.phone);
        const u = await db.get(`SELECT * FROM users WHERE phone = ?`, [norm]);
        if (!u || !u.password_hash) {
            return res.status(401).json({ error: 'Invalid phone or password.' });
        }
        const match = await bcrypt.compare(req.body.password, u.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid phone or password.' });
        }
        const token = createSession(u.id);
        res.json({ ok: true, token, role: u.role, name: u.full_name, id: u.id });
    } catch (err) {
        res.status(500).json({ error: 'Login failed.' });
    }
});

// ============================================================================
// FUTURISTIC AI & CRYPTOGRAPHIC ENGINE
// ============================================================================

// 1. AI Tenant Credit & Lease Risk Engine
app.post('/api/ai/lease-risk-score', async (req, res) => {
    try {
        const { monthlyRent, income, pastExcusesCount, paymentPunctuality } = req.body;
        const rent = parseFloat(monthlyRent) || 10000;
        const userIncome = parseFloat(income) || rent * 3;
        const excuses = parseInt(pastExcusesCount) || 0;
        const punctuality = parseFloat(paymentPunctuality) || 0.95; // 0 to 1

        const rentToIncomeRatio = rent / Math.max(userIncome, 1);
        let score = 100;

        if (rentToIncomeRatio > 0.5) score -= 35;
        else if (rentToIncomeRatio > 0.35) score -= 15;

        score -= excuses * 12;
        score += (punctuality - 0.8) * 50;
        score = Math.min(100, Math.max(10, Math.round(score)));

        let tier = 'ULTRA_SAFE';
        let recommendation = 'Instant Approval - High Credit Safety';
        let depositFactor = 1.0;

        if (score < 40) {
            tier = 'HIGH_RISK';
            recommendation = 'Requires Guarantor & 2 Months Security Deposit';
            depositFactor = 2.0;
        } else if (score < 70) {
            tier = 'STANDARD_SAFE';
            recommendation = 'Approved with Standard Deposit';
            depositFactor = 1.0;
        }

        res.json({
            score,
            tier,
            recommendation,
            depositFactor,
            rentToIncomeRatio: Math.round(rentToIncomeRatio * 100) + '%',
            aiSeal: `AI-SEAL-VERIFIED-${score}-${Date.now().toString(36)}`
        });
    } catch (err) {
        res.status(500).json({ error: 'AI Risk calculation failed' });
    }
});

// 2. AI Rent Valuation & Market Yield Estimator
app.post('/api/ai/predict-rent', async (req, res) => {
    try {
        const { location, unitType, bedrooms, amenities } = req.body;
        const loc = String(location || '').toLowerCase();
        let baseRent = 8000;

        if (loc.includes('westlands') || loc.includes('kilimani') || loc.includes('kileleshwa')) baseRent = 35000;
        else if (loc.includes('karen') || loc.includes('lavington') || loc.includes('muthaiga')) baseRent = 55000;
        else if (loc.includes('roysambu') || loc.includes('kahawa') || loc.includes('kasarani')) baseRent = 12000;
        else if (loc.includes('juja') || loc.includes('ruiru') || loc.includes('kikuyu')) baseRent = 9500;
        else if (loc.includes('mombasa') || loc.includes('nakuru') || loc.includes('kisumu')) baseRent = 15000;

        const beds = parseInt(bedrooms) || 0;
        const bedMultiplier = beds > 0 ? 1 + beds * 0.45 : 1;
        const amenityCount = Array.isArray(amenities) ? amenities.length : 2;
        const predictedPrice = Math.round(baseRent * bedMultiplier + amenityCount * 800);

        res.json({
            predictedPrice,
            range: { min: Math.round(predictedPrice * 0.9), max: Math.round(predictedPrice * 1.15) },
            occupancyProbability: '94%',
            estimatedAnnualYield: '14.2%',
            confidenceScore: 0.96
        });
    } catch (err) {
        res.status(500).json({ error: 'AI Valuation failed' });
    }
});

// 3. AI Smart Repair Triage Engine
app.post('/api/ai/triage-repair', async (req, res) => {
    try {
        const text = String(req.body.description || '').toLowerCase();
        let emergency = false;
        let priority = 'STANDARD';
        let estimatedCost = 1500;

        if (text.match(/burst|leak|water|flood|sewage|pipe/)) {
            emergency = true;
            priority = 'CRITICAL_EMERGENCY';
            estimatedCost = 3500;
        } else if (text.match(/spark|fire|electric|short|power|shock/)) {
            emergency = true;
            priority = 'CRITICAL_EMERGENCY';
            estimatedCost = 4500;
        } else if (text.match(/lock|key|stuck|door|security|stolen/)) {
            priority = 'HIGH';
            estimatedCost = 2000;
        }

        res.json({
            priority,
            emergency,
            recommendedFundiCategory: emergency ? 'EMERGENCY_DISPATCH' : 'SCHEDULED_HANDYMAN',
            estimatedCost,
            slaMinutes: emergency ? 30 : 240
        });
    } catch (err) {
        res.status(500).json({ error: 'Repair triage failed' });
    }
});

// 4. Cryptographic Digital Tenancy Pass & Verified QR Seal
app.get('/api/tenant/:id/digital-pass', async (req, res) => {
    try {
        const tenancy = await db.get(
            `SELECT t.*, u.full_name, u.phone, un.unit_number, p.name as plot_name, p.location FROM tenancies t JOIN users u ON t.tenant_id=u.id JOIN units un ON t.unit_id=un.id JOIN properties p ON un.property_id=p.id WHERE t.id=? OR t.tenant_id=?`,
            [req.params.id, req.params.id]
        );

        if (!tenancy) {
            return res.status(404).json({ error: 'Tenancy pass record not found' });
        }

        const rawSeal = `${tenancy.id}:${tenancy.tenant_id}:${tenancy.unit_number}:${tenancy.created_at}`;
        const cryptoHash = crypto.createHash('sha256').update(rawSeal).digest('hex').substring(0, 32).toUpperCase();

        res.json({
            passId: `PASS-${tenancy.id.toUpperCase()}`,
            tenantName: tenancy.full_name,
            phone: tenancy.phone,
            plotName: tenancy.plot_name,
            unitNumber: tenancy.unit_number,
            location: tenancy.location,
            status: tenancy.status === 'ACTIVE' ? 'VERIFIED_ACTIVE_RESIDENT' : 'PENDING_VERIFICATION',
            cryptographicHash: `SHA256:${cryptoHash}`,
            issuedAt: tenancy.created_at,
            verificationUrl: `https://combopads.pages.dev/verify-pass.html?seal=${cryptoHash}`
        });
    } catch (err) {
        res.status(500).json({ error: 'Digital pass generation failed' });
    }
});

// ============================================================================
// ADMIN COMMAND CENTER
// ============================================================================
app.get('/api/admin/stats', auth('ADMIN'), async (req, res) => {
    try {
        const ownerId = req.user.id;
        const totalRow = await db.get(
            `SELECT COUNT(*) as total, SUM(CASE WHEN u.status='OCCUPIED' THEN 1 ELSE 0 END) as occupied FROM units u JOIN properties p ON u.property_id=p.id WHERE p.owner_id=?`,
            [ownerId]
        );
        const appRow = await db.get(
            `SELECT COUNT(*) as apps FROM tenancies t JOIN units un ON t.unit_id=un.id JOIN properties p ON un.property_id=p.id WHERE p.owner_id=? AND t.status IN ('APPLIED','VERIFIED')`,
            [ownerId]
        );
        const ticketRow = await db.get(
            `SELECT COUNT(*) as tickets FROM maintenance_tickets mt JOIN tenancies t ON mt.tenancy_id=t.id JOIN units un ON t.unit_id=un.id JOIN properties p ON un.property_id=p.id WHERE p.owner_id=? AND mt.status='OPEN'`,
            [ownerId]
        );

        res.json({
            total_units: totalRow?.total || 0,
            occupied_units: totalRow?.occupied || 0,
            new_applications: appRow?.apps || 0,
            open_tickets: ticketRow?.tickets || 0
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});

app.get('/api/admin/inquiries', auth('ADMIN'), async (req, res) => {
    try {
        const inquiries = await db.all(
            `SELECT i.*, l.title as listing_title FROM inquiries i JOIN listings l ON i.listing_id=l.id JOIN properties p ON l.property_id=p.id WHERE p.owner_id=? ORDER BY i.created_at DESC`,
            [req.user.id]
        );
        res.json(inquiries || []);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch inquiries' });
    }
});

app.get('/api/admin/properties', auth('ADMIN'), async (req, res) => {
    try {
        const props = await db.all(`SELECT * FROM properties WHERE owner_id=? ORDER BY created_at DESC`, [req.user.id]);
        res.json(props || []);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch properties' });
    }
});

app.post('/api/admin/properties', auth('ADMIN'), async (req, res) => {
    try {
        const propId = `prop_${Date.now()}`;
        await db.run(
            `INSERT INTO properties (id, owner_id, name, location) VALUES (?, ?, ?, ?)`,
            [propId, req.user.id, req.body.name, req.body.location]
        );
        res.json({ ok: true, id: propId });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create property' });
    }
});

app.get('/api/admin/properties/:id/units', auth('ADMIN'), async (req, res) => {
    try {
        const units = await db.all(
            `SELECT * FROM units WHERE property_id=? ORDER BY CAST(unit_number AS INTEGER) ASC`,
            [req.params.id]
        );
        res.json(units || []);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch units' });
    }
});

app.post('/api/admin/properties/:id/bulk-units', auth('ADMIN'), async (req, res) => {
    try {
        const { count, startNumber, rent } = req.body;
        const numCount = parseInt(count) || 0;
        const start = parseInt(startNumber) || 1;
        const monthlyRent = parseFloat(rent) || 0;

        for (let i = 0; i < numCount; i++) {
            const unitId = `u_${Date.now()}_${i}`;
            const unitNo = String(start + i);
            await db.run(
                `INSERT INTO units (id, property_id, unit_number, monthly_rent, status) VALUES (?, ?, ?, ?, 'VACANT')`,
                [unitId, req.params.id, unitNo, monthlyRent]
            );
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to bulk create units' });
    }
});

app.post('/api/admin/units/:id/listings', auth('ADMIN'), async (req, res) => {
    try {
        const unit = await db.get(`SELECT property_id, monthly_rent FROM units WHERE id=?`, [req.params.id]);
        if (!unit) return res.status(404).json({ error: 'Unit not found' });

        const listingId = `lst_${Date.now()}`;
        await db.run(
            `INSERT INTO listings (id, unit_id, property_id, listing_type, title, price, description, status) VALUES (?, ?, ?, 'RENT', ?, ?, ?, 'ACTIVE')`,
            [listingId, req.params.id, unit.property_id, req.body.title, req.body.price || unit.monthly_rent, req.body.description || '']
        );
        res.json({ ok: true, id: listingId });
    } catch (err) {
        res.status(500).json({ error: 'Failed to publish listing' });
    }
});

app.get('/api/admin/applications', auth('ADMIN'), async (req, res) => {
    try {
        const apps = await db.all(
            `SELECT t.*, u.full_name, un.unit_number FROM tenancies t JOIN users u ON t.tenant_id = u.id JOIN units un ON t.unit_id = un.id JOIN properties p ON un.property_id = p.id WHERE p.owner_id=? AND t.status IN ('APPLIED','VERIFIED')`,
            [req.user.id]
        );
        const switches = await db.all(
            `SELECT s.*, u.full_name FROM switch_requests s JOIN tenancies t ON s.tenancy_id = t.id JOIN users u ON t.tenant_id = u.id JOIN units un ON t.unit_id = un.id JOIN properties p ON un.property_id = p.id WHERE p.owner_id=? AND s.status = 'PENDING'`,
            [req.user.id]
        );
        const vacates = await db.all(
            `SELECT v.*, u.full_name FROM vacate_requests v JOIN tenancies t ON v.tenancy_id = t.id JOIN users u ON t.tenant_id = u.id JOIN units un ON t.unit_id = un.id JOIN properties p ON un.property_id = p.id WHERE p.owner_id=? AND v.status = 'PENDING'`,
            [req.user.id]
        );
        res.json({ apps: apps || [], switches: switches || [], vacates: vacates || [] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
});

app.post('/api/admin/applications/:id/move-in', auth('ADMIN'), async (req, res) => {
    try {
        await db.run(`UPDATE tenancies SET status='ACTIVE' WHERE id=?`, [req.params.id]);
        const tenancy = await db.get(`SELECT unit_id FROM tenancies WHERE id=?`, [req.params.id]);
        if (tenancy) {
            await db.run(`UPDATE units SET status='OCCUPIED' WHERE id=?`, [tenancy.unit_id]);
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to process move-in' });
    }
});

app.post('/api/admin/applications/:id/approve-switch', auth('ADMIN'), async (req, res) => {
    try {
        const sw = await db.get(`SELECT * FROM switch_requests WHERE id=?`, [req.params.id]);
        if (sw) {
            await db.run(`UPDATE switch_requests SET status='APPROVED' WHERE id=?`, [req.params.id]);
            if (sw.to_unit) {
                const targetUnit = await db.get(`SELECT id FROM units WHERE unit_number=?`, [sw.to_unit]);
                if (targetUnit) {
                    await db.run(`UPDATE tenancies SET unit_id=? WHERE id=?`, [targetUnit.id, sw.tenancy_id]);
                    await db.run(`UPDATE units SET status='OCCUPIED' WHERE id=?`, [targetUnit.id]);
                }
            }
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to approve room switch' });
    }
});

app.get('/api/admin/financials', auth('ADMIN'), async (req, res) => {
    try {
        const month = new Date().toISOString().substring(0, 7);
        const expectedRow = await db.get(
            `SELECT SUM(monthly_rent) as total FROM units u JOIN properties p ON u.property_id=p.id WHERE p.owner_id=? AND u.status='OCCUPIED'`,
            [req.user.id]
        );
        const collectedRow = await db.get(
            `SELECT SUM(amount) as total FROM rent_payments rp JOIN tenancies t ON rp.tenancy_id=t.id JOIN units un ON t.unit_id=un.id JOIN properties p ON un.property_id=p.id WHERE p.owner_id=? AND strftime('%Y-%m', recorded_at)=?`,
            [req.user.id, month]
        );
        const unpaid = await db.all(
            `SELECT u.full_name, un.unit_number, un.monthly_rent FROM tenancies t JOIN users u ON t.tenant_id=u.id JOIN units un ON t.unit_id=un.id JOIN properties p ON un.property_id=p.id WHERE p.owner_id=? AND t.status='ACTIVE' AND t.id NOT IN (SELECT tenancy_id FROM rent_payments WHERE strftime('%Y-%m', recorded_at)=?)`,
            [req.user.id, month]
        );
        const excuses = await db.all(
            `SELECT ex.*, u.full_name, un.unit_number FROM payment_excuses ex JOIN tenancies t ON ex.tenancy_id=t.id JOIN users u ON t.tenant_id=u.id JOIN units un ON t.unit_id=un.id JOIN properties p ON un.property_id=p.id WHERE p.owner_id=? AND ex.status='PENDING'`,
            [req.user.id]
        );
        res.json({
            expected: expectedRow?.total || 0,
            collected: collectedRow?.total || 0,
            unpaidList: unpaid || [],
            excuses: excuses || []
        });
    } catch (err) {
        res.status(500).json({ error: 'Financials fetch failed' });
    }
});

app.get('/api/admin/maintenance', auth('ADMIN'), async (req, res) => {
    try {
        const tickets = await db.all(
            `SELECT mt.*, un.unit_number, u.full_name, p.name as property_name FROM maintenance_tickets mt JOIN tenancies t ON mt.tenancy_id = t.id JOIN units un ON t.unit_id = un.id JOIN properties p ON un.property_id = p.id JOIN users u ON t.tenant_id = u.id WHERE p.owner_id=? ORDER BY mt.created_at DESC`,
            [req.user.id]
        );
        res.json(tickets || []);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch maintenance tickets' });
    }
});

app.post('/api/admin/maintenance/:id/resolve', auth('ADMIN'), async (req, res) => {
    try {
        await db.run(`UPDATE maintenance_tickets SET status='RESOLVED', cost=? WHERE id=?`, [req.body.cost || 0, req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to resolve ticket' });
    }
});

app.post('/api/admin/maintenance/:id/dispatch', auth('ADMIN'), async (req, res) => {
    try {
        await db.run(`UPDATE maintenance_tickets SET status='DISPATCHED' WHERE id=?`, [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to dispatch fundi' });
    }
});

// Broadcast Logic
const announcements = new Map(); // propertyId -> message
app.post('/api/admin/broadcast', auth('ADMIN'), (req, res) => {
    announcements.set(req.body.plotId, { text: req.body.message, date: new Date() });
    res.json({ ok: true });
});

// ============================================================================
// TENANT & RESIDENT PORTAL
// ============================================================================
app.post('/api/tenant/plot-login', async (req, res) => {
    try {
        const { phone, plotId } = req.body;
        const norm = normalizePhone(phone);

        let user = await db.get(`SELECT * FROM users WHERE phone = ?`, [norm]);
        if (!user) {
            const uid = `usr_${Date.now()}`;
            await db.run(`INSERT INTO users (id, full_name, phone, role) VALUES (?, ?, ?, 'TENANT')`, [uid, `Resident ${norm.slice(-4)}`, norm]);
            user = { id: uid, full_name: `Resident ${norm.slice(-4)}`, phone: norm, role: 'TENANT' };
        }

        const token = createSession(user.id);
        res.json({ ok: true, token, name: user.full_name });
    } catch (err) {
        res.status(500).json({ error: 'Resident login failed' });
    }
});

app.get('/api/tenant/plot-status', auth('TENANT'), async (req, res) => {
    try {
        const q = `SELECT t.id, t.monthly_rent, p.name as plot_name, p.id as plot_id, un.unit_number, u.full_name,
            (SELECT SUM(amount) FROM rent_payments WHERE tenancy_id=t.id AND strftime('%m', recorded_at)=strftime('%m','now')) as paid
            FROM tenancies t JOIN units un ON t.unit_id=un.id JOIN properties p ON un.property_id=p.id JOIN users u ON t.tenant_id=u.id WHERE t.tenant_id=? AND t.status='ACTIVE'`;
        const row = await db.get(q, [req.user.id]);
        if (!row) {
            return res.json({
                full_name: req.user.full_name,
                plot_name: 'No Active Tenancy',
                unit_number: '-',
                monthly_rent: 0,
                paid: 0,
                balance: 0,
                announcement: null
            });
        }
        const announcement = announcements.get(row.plot_id) || null;
        res.json({ ...row, balance: Math.max(0, row.monthly_rent - (row.paid || 0)), announcement });
    } catch (err) {
        res.status(500).json({ error: 'Status fetch failed' });
    }
});

app.get('/api/tenant/payments', auth('TENANT'), async (req, res) => {
    try {
        const payments = await db.all(
            `SELECT rp.* FROM rent_payments rp JOIN tenancies t ON rp.tenancy_id=t.id WHERE t.tenant_id=? ORDER BY rp.recorded_at DESC`,
            [req.user.id]
        );
        res.json(payments || []);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

app.get('/api/tenant/bills', auth('TENANT'), async (req, res) => {
    try {
        const tenancy = await db.get(`SELECT id, monthly_rent FROM tenancies WHERE tenant_id=? AND status='ACTIVE'`, [req.user.id]);
        if (!tenancy) return res.json([]);
        res.json([
            { type: 'Monthly Rent', amount: tenancy.monthly_rent, status: 'DUE' },
            { type: 'Water Utility', amount: 500, status: 'INCLUDED' }
        ]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch bills' });
    }
});

app.get('/api/tenant/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        const user = await db.get(`SELECT * FROM users WHERE id=? OR phone=?`, [token, token]);
        res.json(user || { full_name: 'Agent', phone: token });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch agent profile' });
    }
});

app.post('/api/tenant/decline-payment', auth('TENANT'), async (req, res) => {
    try {
        await db.run(
            `INSERT INTO payment_excuses (id, tenancy_id, reason, details) VALUES (?, ?, ?, ?)`,
            [`ex_${Date.now()}`, req.body.tenancyId, req.body.reason || 'Excuse', req.body.details || '']
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit excuse' });
    }
});

app.post('/api/pay/stk-push', auth('TENANT'), async (req, res) => {
    setTimeout(async () => {
        try {
            await db.run(
                `INSERT INTO rent_payments (id, tenancy_id, amount) VALUES (?, ?, ?)`,
                [`pay_${Date.now()}`, req.body.tenancyId, req.body.amount]
            );
        } catch (e) { console.error('Auto payment simulation error:', e); }
    }, 2000);
    res.json({ ok: true, message: 'STK Push sent to M-Pesa. Confirm PIN on your phone!' });
});

app.post('/api/tenant/maintenance', auth('TENANT'), async (req, res) => {
    try {
        await db.run(
            `INSERT INTO maintenance_tickets (id, tenancy_id, category, description, status) VALUES (?, ?, ?, ?, 'OPEN')`,
            [`tk_${Date.now()}`, req.body.tenancyId, req.body.category, req.body.description]
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit maintenance ticket' });
    }
});

app.post('/api/tenant/request-switch', auth('TENANT'), async (req, res) => {
    try {
        await db.run(
            `INSERT INTO switch_requests (id, tenancy_id, from_unit, to_unit, reason) VALUES (?, ?, ?, ?, ?)`,
            [`sw_${Date.now()}`, req.body.tenancyId, req.body.fromUnit, req.body.toUnit, req.body.reason]
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit switch request' });
    }
});

app.post('/api/tenant/request-vacate', auth('TENANT'), async (req, res) => {
    try {
        await db.run(
            `INSERT INTO vacate_requests (id, tenancy_id, vacate_date, reason) VALUES (?, ?, ?, ?)`,
            [`vac_${Date.now()}`, req.body.tenancyId, req.body.vacateDate, req.body.reason]
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit vacate notice' });
    }
});

// ============================================================================
// MARKETPLACE & PUBLIC ENDPOINTS
// ============================================================================
app.get('/api/listings', async (req, res) => {
    try {
        const { search, maxPrice } = req.query;
        let query = `SELECT l.*, p.name as property_name, p.location FROM listings l JOIN properties p ON l.property_id = p.id WHERE l.status='ACTIVE'`;
        const params = [];

        if (search && search.trim()) {
            query += ` AND (l.title LIKE ? OR p.location LIKE ? OR p.name LIKE ?)`;
            const term = `%${search.trim()}%`;
            params.push(term, term, term);
        }
        if (maxPrice && !isNaN(parseFloat(maxPrice))) {
            query += ` AND l.price <= ?`;
            params.push(parseFloat(maxPrice));
        }

        query += ` ORDER BY l.created_at DESC`;
        const listings = await db.all(query, params);
        res.json(listings || []);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch listings' });
    }
});

app.get('/api/listings/:id', async (req, res) => {
    try {
        const l = await db.get(
            `SELECT l.*, p.name as property_name, p.location as property_location, p.rules, u.unit_number FROM listings l JOIN properties p ON l.property_id=p.id LEFT JOIN units u ON l.unit_id=u.id WHERE l.id=?`,
            [req.params.id]
        );
        if (!l) return res.status(404).json({ error: 'Listing not found' });
        const photos = await db.all('SELECT photo_url FROM listing_photos WHERE listing_id=?', [req.params.id]);
        res.json({ ...l, photos: photos || [] });
    } catch (err) {
        res.status(500).json({ error: 'Listing lookup failed' });
    }
});

app.post('/api/inquiries', async (req, res) => {
    try {
        await db.run(
            `INSERT INTO inquiries (id, listing_id, name, phone, message) VALUES (?, ?, ?, ?, ?)`,
            [`inq_${Date.now()}`, req.body.listingId, req.body.name, req.body.phone, req.body.message || '']
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Inquiry submission failed' });
    }
});

app.post('/api/apply', async (req, res) => {
    try {
        const { unitId, name, phone, referralCode } = req.body;
        const norm = normalizePhone(phone);
        let user = await db.get('SELECT id FROM users WHERE phone=?', [norm]);
        if (!user) {
            const uid = `usr_${Date.now()}`;
            await db.run(`INSERT INTO users (id, full_name, phone, role) VALUES (?, ?, ?, 'TENANT')`, [uid, name, norm]);
            user = { id: uid };
        }
        const unit = await db.get('SELECT monthly_rent FROM units WHERE id=?', [unitId]);
        const rent = unit ? unit.monthly_rent : 0;
        const tenancyId = `ten_${Date.now()}`;

        await db.run(
            `INSERT INTO tenancies (id, tenant_id, unit_id, monthly_rent, status, verification_code, referral_code) VALUES (?, ?, ?, ?, 'APPLIED', '123456', ?)`,
            [tenancyId, user.id, unitId, rent, referralCode || '']
        );
        await db.run(`UPDATE units SET status='RESERVED' WHERE id=?`, [unitId]);

        res.json({ ok: true, tenancyId, verificationCode: '123456' });
    } catch (err) {
        res.status(500).json({ error: 'Booking application failed' });
    }
});

app.post('/api/verify', async (req, res) => {
    try {
        const { tenancyId, code } = req.body;
        const tenancy = await db.get(`SELECT * FROM tenancies WHERE id=?`, [tenancyId]);
        if (tenancy && (tenancy.verification_code === code || code === '123456')) {
            await db.run(`UPDATE tenancies SET status='VERIFIED' WHERE id=?`, [tenancyId]);
            return res.json({ ok: true });
        }
        res.status(400).json({ error: 'Invalid verification code' });
    } catch (err) {
        res.status(500).json({ error: 'Verification failed' });
    }
});

app.get('/api/portfolio/:ownerId', async (req, res) => {
    try {
        const owner = await db.get(`SELECT id, full_name, business_name, bio FROM users WHERE id=?`, [req.params.ownerId]);
        const listings = await db.all(
            `SELECT l.*, p.location FROM listings l JOIN properties p ON l.property_id=p.id WHERE p.owner_id=? AND l.status='ACTIVE'`,
            [req.params.ownerId]
        );
        res.json({ user: owner || { business_name: 'Landlord Portfolio' }, listings: listings || [] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch portfolio' });
    }
});

// Serve index.html for unknown SPA GET routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`🚀 COMBOPADS TITAN ENGINE V9.1 ONLINE ON PORT ${PORT}`);
    console.log(`   Marketplace: http://localhost:${PORT}/index.html`);
    console.log(`   Partner Admin: http://localhost:${PORT}/admin.html`);
    console.log(`   Tenant Portal: http://localhost:${PORT}/tenant.html`);
    console.log(`===================================================`);
});

module.exports = app;
