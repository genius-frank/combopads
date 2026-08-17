// src/seed.js
// Run with: node src/seed.js
// Requires a real admin account to already exist (register at /admin.html first) —
// properties need a real owner, not a fake one.
const db = require('./db');

db.prepare(`SELECT id FROM users WHERE role = 'LANDLORD' LIMIT 1`).get((err, owner) => {
  if (err) {
    console.error('Could not check for an admin account:', err.message);
    process.exit(1);
  }
  if (!owner) {
    console.log('No admin account yet.');
    console.log('Go to http://localhost:5000/admin.html and register first, then run this again.');
    process.exit(1);
  }

  const propId = `prop_${Date.now()}`;
  const unitAId = `unit_${Date.now() + 1}`;
  const unitBId = `unit_${Date.now() + 2}`;
  const listingId = `lst_${Date.now() + 3}`;

  db.prepare(`
    INSERT INTO properties (id, owner_id, name, location, description, total_floors, amenities, whatsapp_group_link)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    propId, owner.id, 'Baraka Apartments', 'Roysambu, Nairobi',
    'Gated compound with 24/7 security and a borehole.', 4,
    'Parking, Security, Water backup', 'https://chat.whatsapp.com/example-group',
    (err) => {
      if (err) return console.error('Property insert failed:', err.message);

      // Unit A — the one behind the listing everyone will see and click
      db.prepare(`
        INSERT INTO units (id, property_id, floor_number, unit_number, unit_type, bedrooms, monthly_rent, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(unitAId, propId, 2, 'B7', 'BEDSITTER', 0, 8000, 'VACANT', (err) => {
        if (err) return console.error('Unit A insert failed:', err.message);

        // Unit B — a second vacant bedsitter on a different floor, so you can
        // actually test the "choose a different floor" -> alternatives path
        db.prepare(`
          INSERT INTO units (id, property_id, floor_number, unit_number, unit_type, bedrooms, monthly_rent, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(unitBId, propId, 3, 'C2', 'BEDSITTER', 0, 8500, 'VACANT', (err) => {
          if (err) return console.error('Unit B insert failed:', err.message);

          db.prepare(`
            INSERT INTO listings (id, unit_id, property_id, listing_type, title, price, description, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            listingId, unitAId, propId, 'RENT', 'Modern bedsitter, 2nd floor', 8000,
            'Tiled floors, instant shower, steady water supply.', 'ACTIVE',
            (err) => {
              if (err) return console.error('Listing insert failed:', err.message);

              db.prepare(`INSERT INTO listing_photos (id, listing_id, photo_url, sort_order) VALUES (?, ?, ?, ?)`)
                .run(`photo_${Date.now()}`, listingId, 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', 0, (err) => {
                  if (err) return console.error('Photo insert failed:', err.message);
                  console.log('Test data ready!');
                  console.log('Listing:', `http://localhost:5000/listing.html?id=${listingId}`);
                  console.log('(A second vacant bedsitter, floor 3 unit C2, exists too — for testing alternatives.)');
                  process.exit(0);
                });
            }
          );
        });
      });
    }
  );
});