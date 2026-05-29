# TotalFlo Jobs

A focused crew-and-job tracker for a landscape company. Managers build the daily
schedule (assign a crew to a truck, pick the crew members, add stops with
addresses and notes), and crews sign in to see their stops, run a job timer, work
an arrival checklist, and attach photos. There's a live map, a carry-over tool for
pushing unfinished jobs to another day, and a Projects section for multi-day work.

Built with **React + Vite** on the front end and **Supabase** (Postgres + Storage)
for data and photos. It's designed to deploy to **Vercel** with Supabase as the
backend.

---

## What's in here

```
totalflo-jobs/
├─ index.html
├─ package.json
├─ vite.config.js
├─ .env.example
├─ clients.sample.csv          # shows the CSV columns the importer expects
├─ scripts/
│  └─ import-clients.mjs        # one-time CSV → Supabase clients importer
├─ supabase/
│  └─ schema.sql               # run this once in the Supabase SQL editor
└─ src/
   ├─ main.jsx
   ├─ supabaseClient.js
   └─ App.jsx                  # the whole app
```

---

## How it works (quick tour)

**Login screen.** One screen, two ways in:
- A crew member picks their crew number (1–20) from a dropdown and signs in — no
  password. They land on their stops for today.
- A manager taps "Manager", enters a passcode, and gets the manager side.

**Crews 1–7 are mowing crews.** On each stop they get an arrival checklist:
property walk-through → document existing damage (optional, with photos + notes) →
before photo → Start Job (timer) → End Job → after photo. Photos are optional for
mowing.

**Crews 8–20 are non-mowing.** They see the address, the tasks/service, and notes
for each stop, with Start/End Job and optional photos.

**Manager side has four tabs:**
- **Build** — choose a crew, type the truck number, pick members from the employee
  list, then add stops (address + notes). Crews 1–7 keep their saved roster (still
  editable); 8–20 start blank.
- **Jobs** — a date picker, the map (red = scheduled, pulsing purple = in progress,
  green = complete), and lists of in-progress / scheduled / completed jobs. Includes
  carry-over (push unfinished jobs to another date) and delete.
- **Projects** — multi-day work shown as boxes. Open one to see notes, the on-site
  point of contact, and a photo gallery. A project auto-generates a job row for each
  working weekday between its start and end dates, using the same crew/truck/members
  (all editable, and edits propagate to future days). Project jobs show **Done for
  Today** instead of Complete.
- **Crews** — manage the employee list and review each crew's saved roster.

**Address autocomplete** pulls from the `clients` table. Managers can also type a
free-text address; it's geocoded with OpenStreetMap Nominatim so it still shows on
the map.

---

## Setup

### 1. Create a Supabase project
At [supabase.com](https://supabase.com), create a project. From **Project Settings →
API**, copy:
- the **Project URL**
- the **anon public** key (safe for the browser)
- the **service_role** key (server-side only — used just for the CSV import)

### 2. Create the database tables
In the Supabase dashboard open **SQL Editor**, paste the contents of
`supabase/schema.sql`, and run it. This creates the tables (clients, employees,
crews, projects, jobs, job_photos, project_photos), seeds crew rows 1–20, and sets
up Row Level Security policies.

### 3. Create the photo storage bucket
The schema attempts to create a public Storage bucket named **`job-photos`**. If
your Supabase version doesn't allow bucket creation from SQL, create it manually:
**Storage → New bucket → name it `job-photos` → make it Public**. Photos uploaded
by crews are stored here.

### 4. Configure environment variables
Copy `.env.example` to `.env` and fill it in:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_MANAGER_PASSCODE=pick-something

# Only for the import script (never shipped to the browser):
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

### 5. Install and run

```bash
npm install
npm run dev
```

Open the local URL Vite prints (usually http://localhost:5173).

### 6. Import your clients CSV
Look at `clients.sample.csv` for the expected columns. The importer is flexible
about header names — it recognizes common variants (e.g. `client`/`company` for
**name**, `street`/`location` for **address**, `poc` for **contact_name**,
`phone` for **contact_phone**, plus optional `lat`/`lng`). Any row missing
coordinates is geocoded automatically (slowly — about one row per second — to stay
within Nominatim's free rate limit).

```bash
# default file name is clients.csv
npm run import:clients

# or point at a specific file
node scripts/import-clients.mjs path/to/your-clients.csv
```

> The CSV column mapping above is an assumption. If your export uses different
> headers, either rename them or add them to the `COLS` map near the top of
> `scripts/import-clients.mjs`.

---

## Deploy to Vercel

1. Push this folder to a new Git repository.
2. In Vercel, **Import Project** from that repo. Vercel detects Vite automatically
   (build command `vite build`, output `dist`).
3. Add the environment variables under **Settings → Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_MANAGER_PASSCODE`
   (You do **not** need the service-role key in Vercel — that's only for the local
   import script.)
4. Deploy.

---

## A note on security

This is built as an internal crew tool, so to keep things simple the Row Level
Security policies in `schema.sql` allow the anon key full read/write access, and the
manager side is gated by a shared passcode rather than real accounts. That's a
deliberate tradeoff for a small, trusted team — but it means anyone with the site
URL and the anon key could read or write data.

When you're ready to tighten it up:
- Turn on Supabase Auth and give managers real logins.
- Replace the permissive RLS policies with role-based ones (e.g. only authenticated
  managers can write to `crews`/`projects`; crews can only update their own jobs).
- Move the manager gate from a passcode to an authenticated role check.

The passcode and RLS approach is fine to start; just don't treat it as protecting
sensitive data.

---

## Tech notes

- Map rendering uses Leaflet loaded from a CDN at runtime (no build dependency).
- Geocoding (both the import script and free-text addresses in the app) uses
  OpenStreetMap Nominatim, which is free and rate-limited; heavy use should move to
  a paid geocoder.
- All app data lives in Supabase; there's no separate backend server to run.
