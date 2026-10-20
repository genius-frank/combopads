// functions/api/[[path]].js - COMBOPADS CLOUDFLARE PAGES EDGE API FUNCTIONS
export async function onRequest(context) {
    const url = new URL(context.request.url);
    const path = url.pathname;
    const method = context.request.method;

    // Set CORS and JSON Headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (method === 'OPTIONS') {
        return new Response(null, { headers });
    }

    // --- MOCK IN-MEMORY STORAGE FOR EDGE DEMO ---
    const mockListings = [
        {
            id: 'lst_101',
            unit_id: 'u_101',
            property_id: 'prop_1',
            title: 'Modern Bedsitter, Westlands',
            price: 18000,
            location: 'Westlands, Nairobi',
            property_name: 'Westlands Heights',
            cover_photo: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
            description: 'Tiled floors, instant shower, steady water supply & 24/7 security.'
        },
        {
            id: 'lst_102',
            unit_id: 'u_102',
            property_id: 'prop_2',
            title: 'Spacious 1 Bedroom Apartment',
            price: 25000,
            location: 'Kilimani, Nairobi',
            property_name: 'Kilimani Crest',
            cover_photo: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800',
            description: 'High speed WiFi, dedicated parking, elevator & balcony view.'
        },
        {
            id: 'lst_103',
            unit_id: 'u_103',
            property_id: 'prop_3',
            title: 'Executive Studio Pad',
            price: 12000,
            location: 'Roysambu, Nairobi',
            property_name: 'Baraka Apartments',
            cover_photo: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
            description: 'Gated compound with 24/7 security and a borehole.'
        }
    ];

    // 1. GET /api/listings
    if (path.startsWith('/api/listings')) {
        const idMatch = path.match(/\/api\/listings\/([^\/]+)/);
        if (idMatch && idMatch[1]) {
            const item = mockListings.find(l => l.id === idMatch[1]) || mockListings[0];
            return new Response(JSON.stringify({ ...item, photos: [{ photo_url: item.cover_photo }] }), { headers });
        }
        return new Response(JSON.stringify(mockListings), { headers });
    }

    // 2. POST /api/ai/predict-rent
    if (path === '/api/ai/predict-rent') {
        let body = {};
        try { body = await context.request.json(); } catch (e) {}
        const loc = String(body.location || 'Westlands').toLowerCase();
        let base = 12000;
        if (loc.includes('westlands') || loc.includes('kilimani')) base = 28000;
        else if (loc.includes('roysambu') || loc.includes('kasarani')) base = 11000;
        else if (loc.includes('juja') || loc.includes('ruiru')) base = 8500;

        return new Response(JSON.stringify({
            predictedPrice: base,
            range: { min: Math.round(base * 0.9), max: Math.round(base * 1.15) },
            occupancyProbability: '96%',
            estimatedAnnualYield: '14.5%',
            confidenceScore: 0.98
        }), { headers });
    }

    // 3. POST /api/ai/lease-risk-score
    if (path === '/api/ai/lease-risk-score') {
        let body = {};
        try { body = await context.request.json(); } catch (e) {}
        const rent = parseFloat(body.monthlyRent) || 12000;
        const income = parseFloat(body.income) || 60000;
        const ratio = rent / Math.max(income, 1);
        let score = 100 - Math.round(ratio * 100);
        score = Math.min(100, Math.max(20, score));

        return new Response(JSON.stringify({
            score,
            tier: score > 70 ? 'ULTRA_SAFE' : 'STANDARD_SAFE',
            recommendation: 'Instant AI Approval - High Credit Safety Seal',
            depositFactor: 1.0,
            rentToIncomeRatio: Math.round(ratio * 100) + '%',
            aiSeal: `AI-EDGE-SEAL-${score}-${Date.now().toString(36)}`
        }), { headers });
    }

    // 4. POST /api/auth/login or /api/auth/register-partner
    if (path.startsWith('/api/auth/')) {
        let body = {};
        try { body = await context.request.json(); } catch (e) {}
        const token = `sess_edge_${Date.now()}`;
        return new Response(JSON.stringify({
            ok: true,
            token,
            role: body.role || 'LANDLORD',
            name: body.name || 'Partner',
            id: `usr_${Date.now()}`
        }), { headers });
    }

    // 5. GET /api/tenant/plot-status
    if (path === '/api/tenant/plot-status') {
        return new Response(JSON.stringify({
            id: 'ten_active_1',
            full_name: 'Resident Demo',
            plot_name: 'Baraka Apartments',
            plot_id: 'prop_baraka',
            unit_number: 'B7',
            monthly_rent: 8000,
            paid: 8000,
            balance: 0,
            announcement: { text: 'Welcome to ComboPads Titan Resident Portal! Water supply is fully backup ready.' }
        }), { headers });
    }

    // 6. GET /api/admin/stats
    if (path === '/api/admin/stats') {
        return new Response(JSON.stringify({
            total_units: 12,
            occupied_units: 10,
            new_applications: 3,
            open_tickets: 1
        }), { headers });
    }

    // Default Fallback JSON
    return new Response(JSON.stringify({ ok: true, engine: 'ComboPads Cloudflare Edge Functions Online' }), { headers });
}
