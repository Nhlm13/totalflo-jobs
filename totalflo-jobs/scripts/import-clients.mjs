/**
 * Import clients from a CSV into the Supabase `clients` table.
 *
 * Usage:
 *   1. Put your CSV somewhere (default: ./clients.csv).
 *   2. Make sure .env has SUPABASE_URL and SUPABASE_SERVICE_KEY set
 *      (service role key — this runs on your machine, never in the browser).
 *   3. Run:  npm run import:clients
 *      or:   node scripts/import-clients.mjs path/to/your.csv
 *
 * The importer is forgiving about column names. It looks for (case-insensitive,
 * spaces/underscores ignored) any of:
 *   name           <- name | client | client name | company | customer
 *   address        <- address | street | full address | location | site address
 *   contact_name   <- contact | contact name | poc | point of contact
 *   contact_phone  <- phone | contact phone | telephone | cell
 *   lat            <- lat | latitude
 *   lng            <- lng | lon | long | longitude
 *
 * If lat/lng are missing it geocodes the address via OpenStreetMap Nominatim
 * (free, rate-limited to ~1 req/sec, so this is intentionally slow).
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ---- tiny .env loader (no dotenv dependency needed) ----
try {
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  /* no .env file — rely on real environment variables */
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    '\nMissing SUPABASE_URL or SUPABASE_SERVICE_KEY.\n' +
      'Add them to .env (see .env.example) before running the import.\n'
  );
  process.exit(1);
}

const CSV_PATH = process.argv[2] || 'clients.csv';

// ---------- minimal CSV parser (handles quotes, commas, newlines) ----------
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.some((v) => v.trim() !== '')) rows.push(row);
  }
  return rows;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[\s_]+/g, '');

const COLS = {
  name: ['name', 'client', 'clientname', 'company', 'customer', 'customername'],
  address: ['address', 'street', 'fulladdress', 'location', 'siteaddress', 'streetaddress'],
  contact_name: ['contact', 'contactname', 'poc', 'pointofcontact'],
  contact_phone: ['phone', 'contactphone', 'telephone', 'cell', 'phonenumber'],
  lat: ['lat', 'latitude'],
  lng: ['lng', 'lon', 'long', 'longitude'],
};

function buildHeaderMap(headerRow) {
  const map = {};
  headerRow.forEach((h, idx) => {
    const n = norm(h);
    for (const [field, aliases] of Object.entries(COLS)) {
      if (aliases.includes(n)) map[field] = idx;
    }
  });
  return map;
}

// ---------- Nominatim geocoder (polite: 1 req/sec) ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocode(address) {
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
    encodeURIComponent(address);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TotalFlo-Jobs/1.0 (client import script)' },
    });
    const data = await res.json();
    if (Array.isArray(data) && data[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.warn('   geocode error:', e.message);
  }
  return { lat: null, lng: null };
}

// ---------------------------- main ----------------------------
async function main() {
  let raw;
  try {
    raw = readFileSync(CSV_PATH, 'utf8');
  } catch {
    console.error(`\nCould not read CSV at "${CSV_PATH}".`);
    console.error('Pass a path:  node scripts/import-clients.mjs path/to/clients.csv\n');
    process.exit(1);
  }

  const rows = parseCSV(raw);
  if (rows.length < 2) {
    console.error('CSV appears to be empty or has no data rows.');
    process.exit(1);
  }

  const header = rows[0];
  const hmap = buildHeaderMap(header);

  if (hmap.name === undefined && hmap.address === undefined) {
    console.error(
      '\nCould not find a "name" or "address" column in the CSV header.\n' +
        `Header was: ${header.join(' | ')}\n` +
        'Rename a column to "name" and/or "address" and try again.\n'
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const dataRows = rows.slice(1);
  console.log(`\nFound ${dataRows.length} rows. Detected columns:`, hmap, '\n');

  let ok = 0;
  let geocoded = 0;
  let failed = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const get = (field) => (hmap[field] !== undefined ? (r[hmap[field]] || '').trim() : '');

    const name = get('name') || get('address') || `Client ${i + 1}`;
    const address = get('address');
    const record = {
      name,
      address: address || null,
      contact_name: get('contact_name') || null,
      contact_phone: get('contact_phone') || null,
      lat: get('lat') ? parseFloat(get('lat')) : null,
      lng: get('lng') ? parseFloat(get('lng')) : null,
    };

    if ((record.lat === null || Number.isNaN(record.lat)) && address) {
      const g = await geocode(address);
      record.lat = g.lat;
      record.lng = g.lng;
      if (g.lat !== null) geocoded++;
      await sleep(1100); // be nice to Nominatim
    }

    const { error } = await supabase.from('clients').insert(record);
    if (error) {
      failed++;
      console.warn(`   [${i + 1}/${dataRows.length}] FAILED "${name}": ${error.message}`);
    } else {
      ok++;
      const loc = record.lat ? `(${record.lat.toFixed(4)}, ${record.lng.toFixed(4)})` : '(no geo)';
      console.log(`   [${i + 1}/${dataRows.length}] ${name} ${loc}`);
    }
  }

  console.log(
    `\nDone. Inserted ${ok}, geocoded ${geocoded}, failed ${failed}.\n` +
      (failed ? 'Re-run after fixing the failed rows, or insert them manually.\n' : '')
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
