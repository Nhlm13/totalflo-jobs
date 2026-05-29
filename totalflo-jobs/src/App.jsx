import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabaseClient.js";

/* =====================================================================
   TotalFlo — Jobs
   Crew + Manager job assignment & tracking
   ===================================================================== */

const MOWING_CREWS = [1, 2, 3, 4, 5, 6, 7];           // get the arrival checklist
const ALL_CREWS = Array.from({ length: 20 }, (_, i) => i + 1);
const MANAGER_PASSCODE = import.meta.env.VITE_MANAGER_PASSCODE || "changeme";
const isMowing = (n) => MOWING_CREWS.includes(Number(n));

// Map default center — Avon, MA area. Adjust to your service area.
const MAP_CENTER = [42.13, -71.05];
const MAP_ZOOM = 11;

const CREW_COLORS = [
  "#6ab820", "#4472CA", "#e05540", "#d4bc4a", "#9b59b6",
  "#0e7490", "#f97316", "#14b8a6", "#ec4899", "#84cc16",
  "#6366f1", "#f43f5e", "#22a86e", "#eab308", "#a855f7",
  "#06b6d4", "#fb7185", "#65a30d", "#3b82f6", "#f59e0b",
];

/* ----------------------------- date helpers ------------------------- */
const TZ = "America/New_York";
const todayStr = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const addDays = (dateStr, n) => {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
};
const prettyDate = (dateStr) => {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};
const eachDayInRange = (start, end, weekdays /* set of 0-6 */) => {
  const out = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard < 400) {
    const dow = new Date(cur + "T12:00:00").getDay();
    if (!weekdays || weekdays.has(dow)) out.push(cur);
    cur = addDays(cur, 1);
    guard++;
  }
  return out;
};

/* --------------------------- misc helpers --------------------------- */
const fmtClock = (secs) => {
  secs = Math.max(0, Math.floor(secs || 0));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return (h > 0 ? `${h}:` : "") + `${String(m).padStart(h > 0 ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
};
const fmtDuration = (secs) => {
  secs = Math.max(0, Math.floor(secs || 0));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// Geocode a free-text address with OpenStreetMap Nominatim.
// Used only for custom (non-client) addresses. Returns {lat,lng} | null.
async function geocode(address) {
  if (!address) return null;
  try {
    const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
      encodeURIComponent(address);
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    if (data && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch (e) { /* ignore */ }
  return null;
}

// Upload a File to the job-photos bucket, return public URL.
async function uploadPhoto(file, prefix = "photo") {
  if (!file) return null;
  const ext = (file.name?.split(".").pop() || "jpg").toLowerCase();
  const name = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await supabase.storage.from("job-photos").upload(name, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) { console.warn("upload failed", error); return null; }
  const { data } = supabase.storage.from("job-photos").getPublicUrl(name);
  return data?.publicUrl || null;
}

/* ============================== STYLES ============================== */
const FONT = "@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@400;500;600;700&display=swap');";
const CSS = `
${FONT}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --earth:#141a0e; --bark:#1c2414; --bark2:#243018; --moss:#3a4a2a;
  --leaf:#5a9e18; --lime:#6ab820; --dirt:#7a6845; --sand:#a89060;
  --stone:#8aaa70; --cream:#e8f0d8; --danger:#e05540; --warn:#d4840a;
  --mgr:#2a5a95; --mgr-lt:#5a9adf; --purple:#9b59b6;
}
body{background:var(--earth);font-family:'Barlow',sans-serif;color:var(--cream);-webkit-tap-highlight-color:transparent;}
.app{max-width:480px;min-height:100dvh;margin:0 auto;background:var(--earth);display:flex;flex-direction:column;position:relative;}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes spin{to{transform:rotate(360deg)}}

.hd-bebas{font-family:'Bebas Neue',sans-serif;}
.hd-cond{font-family:'Barlow Condensed',sans-serif;}

.splash{flex:1;display:flex;flex-direction:column;align-items:center;padding:48px 24px 60px;padding-top:calc(48px + env(safe-area-inset-top));animation:fadeUp .4s ease both;overflow-y:auto;}
.logo-title{font-family:'Bebas Neue',sans-serif;font-size:46px;letter-spacing:5px;color:var(--lime);line-height:1;}
.logo-sub{font-family:'Barlow Condensed',sans-serif;font-size:13px;letter-spacing:5px;color:var(--stone);text-transform:uppercase;margin-top:4px;}
.label{font-family:'Barlow Condensed',sans-serif;font-size:12px;letter-spacing:2px;color:var(--stone);text-transform:uppercase;margin-bottom:6px;display:block;}

.input{width:100%;background:var(--bark2);border:1px solid var(--moss);border-radius:9px;padding:13px 14px;color:var(--cream);font-family:'Barlow',sans-serif;font-size:16px;}
.input:focus{outline:none;border-color:var(--lime);}
textarea.input{resize:none;}

.btn{width:100%;padding:14px;border:none;border-radius:10px;font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:3px;cursor:pointer;transition:opacity .15s,transform .1s;}
.btn:active{opacity:.85;transform:scale(.985);}
.btn-lime{background:var(--lime);color:var(--earth);}
.btn-mgr{background:var(--mgr);color:#fff;}
.btn-ghost{background:none;border:1px solid var(--moss);color:var(--stone);}
.btn-danger{background:rgba(224,85,64,.14);border:1px solid var(--danger);color:var(--danger);}
.btn:disabled{opacity:.55;cursor:not-allowed;}
.btn-sm{font-size:14px;letter-spacing:2px;padding:10px;}

.dd-wrap{position:relative;width:100%;}
.dd-btn{width:100%;background:var(--bark);border:1.5px solid var(--moss);border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;font-family:'Barlow',sans-serif;font-size:16px;color:var(--cream);}
.dd-btn.open{border-color:var(--lime);border-bottom-left-radius:0;border-bottom-right-radius:0;}
.dd-list{position:absolute;top:100%;left:0;right:0;z-index:200;background:var(--bark);border:1.5px solid var(--lime);border-top:none;border-radius:0 0 10px 10px;max-height:320px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.5);}
.dd-item{padding:13px 16px;cursor:pointer;border-bottom:1px solid var(--moss);font-size:16px;color:var(--cream);}
.dd-item:last-child{border-bottom:none;}
.dd-item:active{background:var(--bark2);}
.dd-item.sel{background:rgba(106,184,32,.14);color:var(--lime);}

.topbar{background:var(--bark);border-bottom:3px solid var(--lime);padding:10px 14px;padding-top:calc(10px + env(safe-area-inset-top));display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50;}
.topbar.mgr{border-bottom-color:var(--mgr-lt);}
.topbar-title{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;color:var(--lime);line-height:1;}
.topbar.mgr .topbar-title{color:var(--mgr-lt);}
.pill{display:inline-flex;align-items:center;gap:5px;background:var(--moss);border-radius:20px;padding:4px 11px;font-family:'Barlow Condensed',sans-serif;font-size:13px;color:var(--lime);letter-spacing:1px;}
.logout{background:none;border:1px solid var(--moss);border-radius:7px;padding:6px 11px;cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-size:12px;color:var(--stone);letter-spacing:1px;text-transform:uppercase;}

.content{padding:14px 14px 110px;overflow-y:auto;flex:1;}
.section-hd{font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:3px;color:var(--stone);text-transform:uppercase;margin:6px 0 12px;display:flex;align-items:center;gap:8px;}
.section-hd::after{content:'';flex:1;height:1px;background:var(--moss);}

.card{background:var(--bark);border:1px solid var(--moss);border-radius:11px;overflow:hidden;margin-bottom:12px;}
.note-box{border-radius:8px;padding:8px 11px;margin-bottom:8px;}
.note-mgr{background:rgba(74,109,32,.08);border:1px solid rgba(74,109,32,.25);}
.note-access{background:rgba(160,96,16,.08);border:1px solid rgba(160,96,16,.25);}
.note-label{font-family:'Barlow Condensed',sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:2px;}

.chip{font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;padding:3px 9px;border-radius:5px;display:inline-flex;align-items:center;gap:4px;}
.chip-sched{background:rgba(224,85,64,.14);color:var(--danger);}
.chip-prog{background:rgba(155,89,182,.16);color:#c98fdb;}
.chip-done{background:rgba(106,184,32,.16);color:var(--lime);}

.tabbar{position:sticky;bottom:0;left:0;right:0;display:flex;background:var(--bark);border-top:1px solid var(--moss);padding-bottom:env(safe-area-inset-bottom);z-index:40;max-width:480px;margin:0 auto;}
.tab{flex:1;padding:9px 4px 8px;background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;font-family:'Barlow Condensed',sans-serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--stone);}
.tab.active{color:var(--lime);}
.tab.active.mgr{color:var(--mgr-lt);}
.tab svg{width:21px;height:21px;}

.check-row{display:flex;align-items:center;gap:12px;background:var(--bark);border:1px solid var(--moss);border-radius:10px;padding:13px 14px;margin-bottom:9px;cursor:pointer;}
.check-row.done{border-color:var(--leaf);background:rgba(90,158,24,.08);}
.check-box{width:26px;height:26px;border-radius:7px;border:2px solid var(--moss);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.check-row.done .check-box{background:var(--lime);border-color:var(--lime);}
.check-label{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;color:var(--cream);flex:1;}
.check-opt{font-family:'Barlow Condensed',sans-serif;font-size:11px;color:var(--stone);text-transform:uppercase;letter-spacing:1px;}

.error{background:rgba(224,85,64,.12);border:1px solid var(--danger);border-radius:8px;padding:10px 14px;font-size:14px;color:var(--danger);text-align:center;animation:shake .3s ease;}
.success{background:rgba(106,184,32,.12);border:1px solid var(--leaf);border-radius:8px;padding:10px 14px;font-family:'Barlow Condensed',sans-serif;font-size:14px;color:var(--lime);letter-spacing:.5px;display:flex;align-items:center;gap:8px;}
.spinner{width:18px;height:18px;border:2px solid var(--moss);border-top-color:var(--lime);border-radius:50%;animation:spin .7s linear infinite;display:inline-block;}
.back-btn{display:flex;align-items:center;gap:6px;background:none;border:none;font-family:'Barlow Condensed',sans-serif;font-size:13px;letter-spacing:1px;color:var(--stone);cursor:pointer;text-transform:uppercase;padding:0;margin-bottom:14px;}
.empty{text-align:center;padding:46px 16px;}
.empty .hd-cond{font-size:14px;letter-spacing:1px;color:var(--stone);text-transform:uppercase;}

.timer-big{font-family:'Bebas Neue',sans-serif;font-size:54px;letter-spacing:3px;color:var(--lime);line-height:1;text-align:center;}

.seg{display:flex;gap:6px;margin-bottom:14px;}
.seg button{flex:1;padding:9px;border-radius:8px;border:1.5px solid var(--moss);background:var(--bark2);font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:13px;letter-spacing:1px;color:var(--stone);cursor:pointer;text-transform:uppercase;}
.seg button.on{border-color:var(--mgr);background:rgba(42,90,149,.16);color:var(--mgr-lt);}

.stop-row{background:var(--bark2);border:1px solid var(--moss);border-radius:9px;padding:11px;margin-bottom:9px;}
.x-btn{background:rgba(0,0,0,.45);border:none;border-radius:50%;width:28px;height:28px;color:#fff;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;}
.member-chip{padding:8px 13px;border-radius:8px;border:1.5px solid var(--moss);background:var(--bark2);font-family:'Barlow Condensed',sans-serif;font-size:13px;color:var(--stone);cursor:pointer;font-weight:600;}
.member-chip.on{border-color:var(--lime);background:rgba(106,184,32,.14);color:var(--lime);}
.photo-thumb{position:relative;border-radius:8px;overflow:hidden;border:1px solid var(--moss);}
.photo-thumb img{width:100%;height:100%;object-fit:cover;display:block;}
`;

/* ============================== ICONS ============================== */
const PATHS = {
  truck: "M3 7h11v8H3zM14 10h4l3 3v2h-7zM7 18a2 2 0 100-4 2 2 0 000 4zM18 18a2 2 0 100-4 2 2 0 000 4z",
  back: "M15 18l-6-6 6-6",
  chev: "M9 6l6 6-6 6",
  map: "M9 3L3 6v15l6-3 6 3 6-3V3l-6 3-6-3z",
  pin: "M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zm0 9a2 2 0 110-4 2 2 0 010 4z",
  camera: "M4 7h3l2-2h6l2 2h3v12H4zM12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7z",
  check: "M5 12l5 5L20 7",
  play: "M6 4l14 8-14 8z",
  stop: "M6 6h12v12H6z",
  clock: "M12 7v5l3 2M12 22a10 10 0 110-20 10 10 0 010 20z",
  plus: "M12 5v14M5 12h14",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  folder: "M3 6h6l2 2h10v11H3z",
  calendar: "M3 5h18v16H3zM3 9h18M8 3v4M16 3v4",
  phone: "M5 4h4l2 5-3 2a12 12 0 005 5l2-3 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z",
  edit: "M4 20h4L18 10l-4-4L4 16zM14 6l4 4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  arrow: "M5 12h14M13 6l6 6-6 6",
  warn: "M12 3l9 16H3zM12 10v4M12 17h.01",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM4 12h2M18 12h2M12 4v2M12 18v2",
  cal2: "M3 5h18v16H3zM3 9h18M8 3v4M16 3v4M8 14h3v3H8z",
};
const Ic = ({ n, size = 20, color = "currentColor", style = {} }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, ...style }}>
    <path d={PATHS[n] || ""} />
  </svg>
);

/* ===================== shared small components ===================== */
function Dropdown({ value, placeholder, options, onChange, render }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const cur = options.find((o) => String(o.value) === String(value));
  return (
    <div className="dd-wrap" ref={ref}>
      <div className={"dd-btn" + (open ? " open" : "")} onClick={() => setOpen((o) => !o)}>
        <span style={{ flex: 1, color: cur ? "var(--cream)" : "var(--stone)" }}>
          {cur ? (render ? render(cur) : cur.label) : placeholder}
        </span>
        <Ic n="chev" size={16} color="var(--stone)"
          style={{ transform: open ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform .2s" }} />
      </div>
      {open && (
        <div className="dd-list">
          {options.map((o) => (
            <div key={o.value} className={"dd-item" + (String(o.value) === String(value) ? " sel" : "")}
              onClick={() => { onChange(o.value); setOpen(false); }}>
              {render ? render(o) : o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Address / client search field with dropdown suggestions from `clients`.
function AddressSearch({ clients, onPick, value, onChangeText }) {
  const [open, setOpen] = useState(false);
  const q = (value || "").toLowerCase();
  const matches = q.length < 2 ? [] : clients.filter(
    (c) => c.name?.toLowerCase().includes(q) || c.address?.toLowerCase().includes(q)
  ).slice(0, 12);
  return (
    <div style={{ position: "relative" }}>
      <input className="input" placeholder="Search client or type an address…"
        value={value || ""}
        onChange={(e) => { onChangeText(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} />
      {open && matches.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 60,
          background: "var(--bark)", border: "1.5px solid var(--lime)", borderTop: "none",
          borderRadius: "0 0 9px 9px", maxHeight: 240, overflowY: "auto" }}>
          {matches.map((c) => (
            <div key={c.id} className="dd-item" style={{ fontSize: 14 }}
              onClick={() => { onPick(c); setOpen(false); }}>
              <div style={{ fontWeight: 700 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: "var(--stone)" }}>{c.address}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }) {
  if (status === "completed") return <span className="chip chip-done"><Ic n="check" size={12} /> Complete</span>;
  if (status === "in_progress") return <span className="chip chip-prog"><Ic n="clock" size={12} /> In Progress</span>;
  if (status === "done_for_today") return <span className="chip chip-done"><Ic n="check" size={12} /> Done Today</span>;
  return <span className="chip chip-sched">Scheduled</span>;
}

/* ===================================================================
   LOGIN
   =================================================================== */
function LoginScreen({ onCrewLogin, onManagerLogin }) {
  const [mode, setMode] = useState("crew");
  const [crew, setCrew] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  const crewOpts = ALL_CREWS.map((n) => ({
    value: n,
    label: `Crew ${n}` + (isMowing(n) ? "  (Mowing)" : ""),
  }));

  const tryManager = () => {
    if (pass === MANAGER_PASSCODE) onManagerLogin();
    else setErr("Incorrect passcode.");
  };

  return (
    <div className="splash">
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div className="logo-title">TOTALFLO</div>
        <div className="logo-sub">Crew Dispatch</div>
      </div>

      {mode === "crew" ? (
        <div style={{ width: "100%" }}>
          <span className="label">Select your crew</span>
          <div style={{ marginBottom: 16 }}>
            <Dropdown value={crew} placeholder="Choose a crew…" options={crewOpts}
              onChange={setCrew} />
          </div>
          <button className="btn btn-lime" disabled={!crew}
            onClick={() => onCrewLogin(Number(crew))}>SIGN IN</button>
          <div onClick={() => { setMode("mgr"); setErr(""); }}
            style={{ marginTop: 26, textAlign: "center", fontFamily: "'Barlow Condensed',sans-serif",
              fontSize: 13, color: "var(--mgr-lt)", cursor: "pointer", letterSpacing: 1,
              textDecoration: "underline", textUnderlineOffset: 3 }}>
            Manager / Office login
          </div>
        </div>
      ) : (
        <div style={{ width: "100%", background: "var(--bark)", border: "1.5px solid var(--mgr)",
          borderRadius: 12, padding: 20 }}>
          <div className="hd-bebas" style={{ fontSize: 22, color: "var(--mgr-lt)", letterSpacing: 2, marginBottom: 16 }}>
            MANAGER ACCESS
          </div>
          <span className="label">Passcode</span>
          <input className="input" type="password" placeholder="••••••••" value={pass}
            style={{ marginBottom: 14, textAlign: "center", letterSpacing: 4 }}
            onChange={(e) => { setPass(e.target.value); setErr(""); }}
            onKeyDown={(e) => e.key === "Enter" && tryManager()} />
          <button className="btn btn-mgr" onClick={tryManager}>ENTER</button>
          {err && <div className="error" style={{ marginTop: 12 }}>{err}</div>}
          <div onClick={() => { setMode("crew"); setErr(""); }}
            style={{ marginTop: 18, textAlign: "center", fontFamily: "'Barlow Condensed',sans-serif",
              fontSize: 13, color: "var(--stone)", cursor: "pointer", letterSpacing: 1 }}>
            ← Back to crew login
          </div>
        </div>
      )}

      <div style={{ marginTop: "auto", paddingTop: 36, textAlign: "center" }}>
        <div className="hd-cond" style={{ fontSize: 11, color: "var(--moss)", letterSpacing: 1, lineHeight: 1.6 }}>
          Created by Salerni Creative Co LLC<br />All Rights Reserved
        </div>
      </div>
    </div>
  );
}

/* ===================================================================
   CREW — photo strip helper
   =================================================================== */
function PhotoStrip({ photos, kind, onAdd, onRemove, label, optional }) {
  const ref = useRef(null);
  const shown = photos.filter((p) => p.kind === kind);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span className="label" style={{ margin: 0 }}>{label}{optional && <span style={{ color: "var(--moss)" }}> · optional</span>}</span>
      </div>
      <input ref={ref} type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }}
        onChange={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) onAdd(fs, kind); e.target.value = ""; }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {shown.map((p) => (
          <div key={p.id || p.url} className="photo-thumb" style={{ aspectRatio: "1" }}>
            <img src={p.url} alt={kind} />
            {onRemove && <button className="x-btn" style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24 }}
              onClick={() => onRemove(p)}>✕</button>}
          </div>
        ))}
        <div onClick={() => ref.current?.click()}
          style={{ aspectRatio: "1", border: "1.5px dashed var(--moss)", borderRadius: 8, display: "flex",
            flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer",
            color: "var(--stone)" }}>
          <Ic n="camera" size={22} />
          <span className="hd-cond" style={{ fontSize: 11, letterSpacing: 1 }}>ADD</span>
        </div>
      </div>
    </div>
  );
}

/* ===================================================================
   CREW — Job Detail (handles mowing checklist, non-mowing, projects)
   =================================================================== */
function CrewJobDetail({ job, crew, onBack, onChanged }) {
  const mowing = isMowing(crew);
  const project = job.is_project;
  const [checklist, setChecklist] = useState(job.checklist || {});
  const [photos, setPhotos] = useState([]);
  const [status, setStatus] = useState(job.status);
  const [startedAt, setStartedAt] = useState(job.started_at ? new Date(job.started_at).getTime() : null);
  const [baseSecs, setBaseSecs] = useState(job.elapsed_seconds || 0);
  const [tick, setTick] = useState(0);
  const [damageNote, setDamageNote] = useState(job.checklist?.damageNote || "");
  const [finalNote, setFinalNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  // load existing photos
  useEffect(() => {
    supabase.from("job_photos").select("*").eq("job_id", job.id).order("created_at")
      .then(({ data }) => setPhotos(data || []));
  }, [job.id]);

  // live timer
  useEffect(() => {
    if (status === "in_progress" && startedAt) {
      const t = setInterval(() => setTick(Date.now()), 1000);
      return () => clearInterval(t);
    }
  }, [status, startedAt]);
  const liveSecs = baseSecs + (status === "in_progress" && startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0);

  const persistChecklist = async (next) => {
    setChecklist(next);
    await supabase.from("jobs").update({ checklist: next }).eq("id", job.id);
  };
  const toggle = (key) => persistChecklist({ ...checklist, [key]: !checklist[key] });

  const addPhotos = async (files, kind) => {
    setUploading(true);
    const added = [];
    for (const f of files) {
      const url = await uploadPhoto(f, `${kind}_${job.id}`);
      if (url) {
        const { data } = await supabase.from("job_photos")
          .insert({ job_id: job.id, url, kind }).select().single();
        if (data) added.push(data);
      }
    }
    setPhotos((p) => [...p, ...added]);
    setUploading(false);
  };
  const removePhoto = async (p) => {
    await supabase.from("job_photos").delete().eq("id", p.id);
    setPhotos((arr) => arr.filter((x) => x.id !== p.id));
  };

  const startJob = async () => {
    const now = Date.now();
    setStatus("in_progress"); setStartedAt(now);
    await supabase.from("jobs").update({ status: "in_progress", started_at: new Date(now).toISOString() }).eq("id", job.id);
    onChanged?.();
  };
  const endJob = async () => {
    const secs = baseSecs + (startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0);
    setBaseSecs(secs); setStartedAt(null);
    await supabase.from("jobs").update({ elapsed_seconds: secs, started_at: null }).eq("id", job.id);
    onChanged?.();
  };

  const finalize = async () => {
    setBusy(true);
    const secs = baseSecs + (startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0);
    const newStatus = project ? "done_for_today" : "completed";
    const patch = {
      status: newStatus,
      elapsed_seconds: secs,
      started_at: null,
      completed_at: new Date().toISOString(),
      checklist: { ...checklist, damageNote },
    };
    if (finalNote.trim()) patch.notes = (job.notes ? job.notes + "\n— Crew: " : "Crew: ") + finalNote.trim();
    await supabase.from("jobs").update(patch).eq("id", job.id);
    setBusy(false);
    onChanged?.();
    onBack();
  };

  const title = job.client_name || job.address || "Job";
  const started = status === "in_progress" || baseSecs > 0;
  const ended = startedAt === null && baseSecs > 0;

  return (
    <div style={{ animation: "fadeUp .25s ease both" }}>
      <button className="back-btn" onClick={onBack}><Ic n="back" size={14} /> Back to jobs</button>

      <div className="card" style={{ padding: 14, borderLeft: `4px solid ${project ? "var(--purple)" : "var(--lime)"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div className="hd-bebas" style={{ fontSize: 24, color: "var(--cream)", letterSpacing: 1.5, lineHeight: 1.05 }}>{title}</div>
          <StatusChip status={status} />
        </div>
        {project && <div className="hd-cond" style={{ fontSize: 12, color: "var(--purple)", letterSpacing: 1, textTransform: "uppercase", marginTop: 2 }}>● Project</div>}
        <a href={`https://maps.apple.com/?q=${encodeURIComponent(job.address || "")}`} target="_blank" rel="noreferrer"
          style={{ fontSize: 14, color: "var(--mgr-lt)", display: "block", marginTop: 6, textDecoration: "none" }}>
          <Ic n="pin" size={13} /> {job.address}
        </a>
        {job.service_type && <div className="hd-bebas" style={{ fontSize: 16, color: "#92B4F4", letterSpacing: 1, marginTop: 6 }}>{job.service_type}</div>}
        {job.notes && (
          <div className="note-box note-mgr" style={{ marginTop: 8 }}>
            <div className="note-label" style={{ color: "var(--leaf)" }}>Manager Notes</div>
            <div style={{ fontSize: 13 }}>{job.notes}</div>
          </div>
        )}
      </div>

      {/* live timer */}
      {started && (
        <div className="card" style={{ padding: 14, textAlign: "center" }}>
          <div className="timer-big">{fmtClock(liveSecs)}</div>
          <div className="hd-cond" style={{ fontSize: 12, color: "var(--stone)", letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>
            {status === "in_progress" && startedAt ? "Running" : "Paused"}
          </div>
        </div>
      )}

      {/* MOWING CHECKLIST */}
      {mowing && (
        <>
          <div className="section-hd">Arrival Checklist</div>
          <div className={"check-row" + (checklist.walkthrough ? " done" : "")} onClick={() => toggle("walkthrough")}>
            <div className="check-box">{checklist.walkthrough && <Ic n="check" size={16} color="#fff" />}</div>
            <span className="check-label">Property walk-through</span>
          </div>

          <div className="check-row" style={{ flexDirection: "column", alignItems: "stretch", cursor: "default" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="check-label">Document existing damage</span>
              <span className="check-opt">optional</span>
            </div>
            <div style={{ marginTop: 10 }}>
              <PhotoStrip photos={photos} kind="damage" onAdd={addPhotos} onRemove={removePhoto}
                label="Damage photos" optional />
              <textarea className="input" placeholder="Notes about existing damage…" style={{ height: 64, fontSize: 14 }}
                value={damageNote} onChange={(e) => setDamageNote(e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 4 }}>
            <PhotoStrip photos={photos} kind="before" onAdd={addPhotos} onRemove={removePhoto}
              label="Before photo" optional />
          </div>
        </>
      )}

      {/* NON-MOWING simple photos */}
      {!mowing && (
        <div style={{ marginTop: 4 }}>
          <div className="section-hd">Photos</div>
          <PhotoStrip photos={photos} kind="before" onAdd={addPhotos} onRemove={removePhoto} label="Photos" optional />
        </div>
      )}

      {/* START / END */}
      <div className="section-hd">Time</div>
      {!started && (
        <button className="btn btn-lime" onClick={startJob}>
          <Ic n="play" size={16} style={{ marginRight: 8, verticalAlign: -2 }} />START JOB
        </button>
      )}
      {status === "in_progress" && startedAt && (
        <button className="btn" style={{ background: "var(--warn)", color: "var(--earth)" }} onClick={endJob}>
          <Ic n="stop" size={16} style={{ marginRight: 8, verticalAlign: -2 }} />END JOB
        </button>
      )}
      {ended && (
        <button className="btn btn-ghost btn-sm" onClick={startJob} style={{ marginBottom: 4 }}>RESUME TIMER</button>
      )}

      {/* AFTER PHOTO + FINALIZE (after ended) */}
      {ended && (
        <>
          <div style={{ marginTop: 14 }}>
            <PhotoStrip photos={photos} kind="after" onAdd={addPhotos} onRemove={removePhoto}
              label="After photo" optional={mowing} />
          </div>
          <textarea className="input" placeholder="Completion notes (optional)…" style={{ height: 64, fontSize: 14, marginBottom: 10 }}
            value={finalNote} onChange={(e) => setFinalNote(e.target.value)} />
          <button className="btn" disabled={busy || uploading}
            style={{ background: project ? "var(--purple)" : "var(--lime)", color: project ? "#fff" : "var(--earth)" }}
            onClick={finalize}>
            {busy ? "Saving…" : project ? "DONE FOR TODAY" : "MARK COMPLETE"}
          </button>
        </>
      )}
      {uploading && <div className="hd-cond" style={{ textAlign: "center", color: "var(--stone)", fontSize: 12, marginTop: 8 }}><span className="spinner" /> Uploading photo…</div>}
    </div>
  );
}

/* ===================================================================
   CREW HOME
   =================================================================== */
function CrewHome({ crew, onLogout }) {
  const mowing = isMowing(crew);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null); // job being viewed
  const today = todayStr();

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: jobData }, { data: clientData }] = await Promise.all([
      supabase.from("jobs").select("*").eq("crew_number", crew).eq("date", today).order("sort_order"),
      supabase.from("clients").select("id,name"),
    ]);
    const cmap = {}; (clientData || []).forEach((c) => (cmap[c.id] = c.name));
    setJobs((jobData || []).map((j) => ({ ...j, client_name: cmap[j.client_id] || null })));
    setLoading(false);
  }, [crew, today]);

  useEffect(() => { load(); const i = setInterval(load, 45000); return () => clearInterval(i); }, [load]);

  if (open) {
    const fresh = jobs.find((j) => j.id === open.id) || open;
    return (
      <div className="screen">
        <div className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="topbar-title">CREW {crew}</span>
            <span className="pill">{mowing ? "Mowing" : "Crew"}</span>
          </div>
          <button className="logout" onClick={onLogout}>Sign out</button>
        </div>
        <div className="content">
          <CrewJobDetail job={fresh} crew={crew} onBack={() => setOpen(null)} onChanged={load} />
        </div>
      </div>
    );
  }

  const active = jobs.filter((j) => j.status !== "completed" && j.status !== "done_for_today");
  const done = jobs.filter((j) => j.status === "completed" || j.status === "done_for_today");

  return (
    <div className="screen">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="topbar-title">CREW {crew}</span>
          <span className="pill"><Ic n="truck" size={12} /> {mowing ? "Mowing" : "Crew"}</span>
        </div>
        <button className="logout" onClick={onLogout}>Sign out</button>
      </div>

      <div className="content">
        <div style={{ marginBottom: 14 }}>
          <div className="hd-cond" style={{ fontSize: 13, color: "var(--stone)", letterSpacing: 1, textTransform: "uppercase" }}>{prettyDate(today)}</div>
        </div>

        {loading ? (
          <div className="empty"><span className="spinner" /></div>
        ) : jobs.length === 0 ? (
          <div className="empty">
            <Ic n="map" size={40} color="var(--moss)" style={{ marginBottom: 10 }} />
            <div className="hd-cond">No jobs assigned today</div>
          </div>
        ) : (
          <>
            <div className="section-hd">To Do — {active.length}</div>
            {active.map((job) => <CrewJobCard key={job.id} job={job} onOpen={() => setOpen(job)} />)}
            {active.length === 0 && <div className="hd-cond" style={{ color: "var(--stone)", fontSize: 13, marginBottom: 16 }}>All caught up! 🎉</div>}

            {done.length > 0 && (
              <>
                <div className="section-hd" style={{ marginTop: 18 }}>Done — {done.length}</div>
                {done.map((job) => <CrewJobCard key={job.id} job={job} onOpen={() => setOpen(job)} done />)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CrewJobCard({ job, onOpen, done }) {
  const project = job.is_project;
  const color = job.status === "completed" || job.status === "done_for_today"
    ? "var(--leaf)" : job.status === "in_progress" ? "var(--purple)" : project ? "var(--purple)" : "var(--lime)";
  return (
    <div className="card" style={{ borderLeft: `4px solid ${color}`, opacity: done ? 0.78 : 1, cursor: "pointer" }} onClick={onOpen}>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
          <div className="hd-bebas" style={{ fontSize: 20, color: "var(--cream)", letterSpacing: 1, lineHeight: 1.05 }}>
            {job.client_name || job.address || "Job"}
          </div>
          <StatusChip status={job.status} />
        </div>
        {project && <div className="hd-cond" style={{ fontSize: 11, color: "var(--purple)", letterSpacing: 1, textTransform: "uppercase" }}>● Project</div>}
        <div style={{ fontSize: 13, color: "var(--mgr-lt)" }}><Ic n="pin" size={12} /> {job.address}</div>
        {job.service_type && <div className="hd-bebas" style={{ fontSize: 14, color: "#92B4F4", letterSpacing: 1, marginTop: 4 }}>{job.service_type}</div>}
        {job.notes && <div style={{ fontSize: 12, color: "var(--stone)", marginTop: 4 }}>{job.notes}</div>}
        {!done && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, color: color }}>
            <span className="hd-cond" style={{ fontSize: 13, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>
              {job.status === "in_progress" ? "Continue" : "Open job"}
            </span>
            <Ic n="arrow" size={15} />
          </div>
        )}
        {done && job.elapsed_seconds > 0 && (
          <div className="hd-cond" style={{ fontSize: 12, color: "var(--stone)", marginTop: 6 }}>
            <Ic n="clock" size={12} /> {fmtDuration(job.elapsed_seconds)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================================================================
   MANAGER — Build Schedule
   =================================================================== */
function BuildSchedule({ onDone }) {
  const [crew, setCrew] = useState("");
  const [truck, setTruck] = useState("");
  const [members, setMembers] = useState([]);
  const [date, setDate] = useState(todayStr());
  const [stops, setStops] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [crews, setCrews] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.from("employees").select("*").eq("active", true).order("name").then(({ data }) => setEmployees(data || []));
    supabase.from("clients").select("*").then(({ data }) => setClients(data || []));
    supabase.from("crews").select("*").then(({ data }) => {
      const m = {}; (data || []).forEach((c) => (m[c.crew_number] = c)); setCrews(m);
    });
  }, []);

  // when crew changes, prefill truck + members from the stored roster
  useEffect(() => {
    if (!crew) return;
    const r = crews[crew];
    setTruck(r?.truck_number || "");
    setMembers(Array.isArray(r?.members) ? r.members : []);
  }, [crew]); // eslint-disable-line

  const toggleMember = (name) =>
    setMembers((m) => (m.includes(name) ? m.filter((x) => x !== name) : [...m, name]));

  const addStop = () => setStops((s) => [...s, { key: Date.now() + Math.random(), search: "", client: null, address: "", service_type: "", notes: "" }]);
  const setStop = (key, patch) => setStops((s) => s.map((st) => (st.key === key ? { ...st, ...patch } : st)));
  const rmStop = (key) => setStops((s) => s.filter((st) => st.key !== key));

  const save = async () => {
    if (!crew) { setMsg("Pick a crew."); return; }
    const valid = stops.filter((s) => s.address.trim());
    if (valid.length === 0) { setMsg("Add at least one stop with an address."); return; }
    setBusy(true); setMsg("");

    // 1. save/refresh the crew roster
    await supabase.from("crews").update({ truck_number: truck || null, members, updated_at: new Date().toISOString() })
      .eq("crew_number", crew);

    // 2. insert one job per stop
    let order = 0;
    for (const s of valid) {
      let lat = s.client?.lat ?? null, lng = s.client?.lng ?? null;
      if (lat == null) { const g = await geocode(s.address); if (g) { lat = g.lat; lng = g.lng; } }
      await supabase.from("jobs").insert({
        crew_number: Number(crew),
        date,
        client_id: s.client?.id || null,
        address: s.address,
        lat, lng,
        service_type: s.service_type || null,
        notes: s.notes || null,
        truck_number: truck || null,
        members,
        status: "scheduled",
        sort_order: order++,
      });
    }
    setBusy(false);
    onDone?.(`Scheduled ${valid.length} stop${valid.length > 1 ? "s" : ""} for Crew ${crew} on ${prettyDate(date)}.`);
  };

  const crewOpts = ALL_CREWS.map((n) => ({ value: n, label: `Crew ${n}` + (isMowing(n) ? " (Mowing)" : "") }));

  return (
    <div style={{ animation: "fadeUp .25s ease both" }}>
      <div className="section-hd">Build the Schedule</div>

      <span className="label">Crew</span>
      <div style={{ marginBottom: 14 }}>
        <Dropdown value={crew} placeholder="Choose a crew…" options={crewOpts} onChange={setCrew} />
      </div>

      {crew && (
        <>
          <span className="label">Truck #</span>
          <input className="input" style={{ marginBottom: 14 }} placeholder="e.g. 12"
            value={truck} onChange={(e) => setTruck(e.target.value)} />

          <span className="label">Crew members {isMowing(crew) && <span style={{ color: "var(--moss)" }}>· saved roster pre-filled</span>}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 6 }}>
            {employees.length === 0 && <div className="hd-cond" style={{ fontSize: 13, color: "var(--stone)" }}>No employees yet — add them in the Crews tab.</div>}
            {employees.map((e) => (
              <button key={e.id} className={"member-chip" + (members.includes(e.name) ? " on" : "")}
                onClick={() => toggleMember(e.name)}>{e.name}</button>
            ))}
          </div>
          {members.length > 0 && <div className="hd-cond" style={{ fontSize: 12, color: "var(--lime)", marginBottom: 14 }}>{members.length} selected: {members.join(", ")}</div>}

          <span className="label">Date</span>
          <input className="input" type="date" style={{ marginBottom: 18 }} value={date} onChange={(e) => setDate(e.target.value)} />

          <div className="section-hd">Stops</div>
          {stops.map((s, i) => (
            <div key={s.key} className="stop-row">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span className="hd-bebas" style={{ fontSize: 16, color: "var(--mgr-lt)", letterSpacing: 1 }}>STOP {i + 1}</span>
                <button className="x-btn" onClick={() => rmStop(s.key)}>✕</button>
              </div>
              <span className="label">Address</span>
              <div style={{ marginBottom: 9 }}>
                <AddressSearch clients={clients} value={s.search}
                  onChangeText={(v) => setStop(s.key, { search: v, address: v, client: null })}
                  onPick={(c) => setStop(s.key, { client: c, address: c.address || c.name, search: `${c.name} — ${c.address || ""}` })} />
              </div>
              <span className="label">What needs to be done</span>
              <input className="input" style={{ marginBottom: 9 }} placeholder="e.g. Mow & trim, mulch beds…"
                value={s.service_type} onChange={(e) => setStop(s.key, { service_type: e.target.value })} />
              <span className="label">Notes for crew</span>
              <textarea className="input" style={{ height: 56, fontSize: 14 }} placeholder="Gate code, dog on site, skip back lawn…"
                value={s.notes} onChange={(e) => setStop(s.key, { notes: e.target.value })} />
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={addStop} style={{ marginBottom: 16 }}>
            <Ic n="plus" size={15} style={{ marginRight: 6, verticalAlign: -2 }} />ADD STOP
          </button>

          {msg && <div className="error" style={{ marginBottom: 12 }}>{msg}</div>}
          <button className="btn btn-mgr" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "SAVE SCHEDULE"}
          </button>
        </>
      )}
    </div>
  );
}

/* ===================================================================
   MANAGER — Jobs (map + in-progress/completed + carry over)
   =================================================================== */
function useLeaflet() {
  const [ready, setReady] = useState(!!window.L);
  useEffect(() => {
    if (window.L) { setReady(true); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);
  return ready;
}

function JobsMap({ jobs }) {
  const ready = useLeaflet();
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!ready || !elRef.current || mapRef.current) return;
    mapRef.current = window.L.map(elRef.current).setView(MAP_CENTER, MAP_ZOOM);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      { attribution: "© OpenStreetMap" }).addTo(mapRef.current);
    layerRef.current = window.L.layerGroup().addTo(mapRef.current);
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [ready]);

  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    layerRef.current.clearLayers();
    const pts = [];
    jobs.forEach((job) => {
      if (job.lat == null || job.lng == null) return;
      pts.push([job.lat, job.lng]);
      const complete = job.status === "completed" || job.status === "done_for_today";
      const prog = job.status === "in_progress";
      const color = complete ? "#22c55e" : prog ? "#9b59b6" : "#e05540";
      const marker = prog
        ? window.L.marker([job.lat, job.lng], {
            icon: window.L.divIcon({
              className: "",
              html: `<div style="position:relative;width:22px;height:22px;">
                <div style="position:absolute;inset:0;border-radius:50%;background:${color};border:2px solid #fff;animation:pulse 1s infinite;"></div>
                <div style="position:absolute;inset:-7px;border-radius:50%;border:3px solid ${color};opacity:.4;animation:pulse 1s infinite;"></div>
              </div>`,
              iconSize: [22, 22], iconAnchor: [11, 11],
            }),
          })
        : window.L.circleMarker([job.lat, job.lng], {
            radius: 9, fillColor: color, color: "#fff", weight: 2, opacity: 1, fillOpacity: 0.9,
          });
      marker.bindPopup(
        `<div style="font-family:'Barlow Condensed',sans-serif;min-width:150px;">
          <div style="font-weight:700;font-size:14px;color:#1c2414;">${job.client_name || job.address || ""}</div>
          <div style="font-size:12px;color:#666;margin-top:2px;">${job.address || ""}</div>
          <div style="font-size:11px;margin-top:4px;color:${color};font-weight:700;">Crew ${job.crew_number} · ${complete ? "Complete" : prog ? "In Progress" : "Scheduled"}</div>
        </div>`
      );
      marker.addTo(layerRef.current);
    });
    if (pts.length) { try { mapRef.current.fitBounds(pts, { padding: [40, 40], maxZoom: 14 }); } catch (e) {} }
  }, [jobs]);

  return (
    <div style={{ position: "relative" }}>
      <div ref={elRef} style={{ height: 260, width: "100%", borderRadius: 11, overflow: "hidden", border: "1px solid var(--moss)" }} />
      {!ready && <div className="empty" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><span className="spinner" /></div>}
      <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
        {[["#e05540", "Scheduled"], ["#9b59b6", "In Progress"], ["#22c55e", "Complete"]].map(([c, l]) => (
          <span key={l} className="hd-cond" style={{ fontSize: 12, color: "var(--cream)", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: c, border: "1.5px solid #fff" }} />{l}
          </span>
        ))}
      </div>
    </div>
  );
}

function ManagerJobs() {
  const [date, setDate] = useState(todayStr());
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [carry, setCarry] = useState(null);     // job being carried over
  const [carryDate, setCarryDate] = useState(addDays(todayStr(), 1));

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: jobData }, { data: clientData }] = await Promise.all([
      supabase.from("jobs").select("*").eq("date", date).order("crew_number").order("sort_order"),
      supabase.from("clients").select("id,name"),
    ]);
    const cmap = {}; (clientData || []).forEach((c) => (cmap[c.id] = c.name));
    setJobs((jobData || []).map((j) => ({ ...j, client_name: cmap[j.client_id] || null })));
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [load]);

  const doCarry = async () => {
    await supabase.from("jobs").update({ date: carryDate, status: "scheduled", started_at: null, completed_at: null }).eq("id", carry.id);
    setCarry(null); load();
  };
  const del = async (job) => {
    if (!window.confirm("Remove this job from the schedule?")) return;
    await supabase.from("jobs").delete().eq("id", job.id); load();
  };

  const byStatus = (s) => jobs.filter((j) => s.includes(j.status));
  const scheduled = byStatus(["scheduled"]);
  const progress = byStatus(["in_progress"]);
  const completed = byStatus(["completed", "done_for_today"]);

  const Row = ({ job }) => (
    <div className="card" style={{ padding: "11px 13px", borderLeft: `4px solid ${
      job.status === "in_progress" ? "var(--purple)" :
      job.status === "completed" || job.status === "done_for_today" ? "var(--leaf)" : "var(--danger)"}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div className="hd-bebas" style={{ fontSize: 18, color: "var(--cream)", letterSpacing: 1, lineHeight: 1.1 }}>
            {job.client_name || job.address || "Job"}
          </div>
          <div style={{ fontSize: 12, color: "var(--stone)" }}>{job.address}</div>
          <div className="hd-cond" style={{ fontSize: 12, color: "var(--mgr-lt)", marginTop: 3, letterSpacing: .5 }}>
            Crew {job.crew_number}{job.truck_number ? ` · Truck ${job.truck_number}` : ""}
            {job.is_project && <span style={{ color: "var(--purple)" }}> · Project</span>}
          </div>
          {job.service_type && <div style={{ fontSize: 12, color: "#92B4F4", marginTop: 2 }}>{job.service_type}</div>}
          {job.elapsed_seconds > 0 && <div className="hd-cond" style={{ fontSize: 12, color: "var(--stone)", marginTop: 3 }}><Ic n="clock" size={12} /> {fmtDuration(job.elapsed_seconds)}</div>}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <StatusChip status={job.status} />
          <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "flex-end" }}>
            {job.status !== "completed" && job.status !== "done_for_today" && (
              <button className="x-btn" title="Carry over" style={{ background: "var(--moss)", width: 30, height: 30 }}
                onClick={() => { setCarry(job); setCarryDate(addDays(date, 1)); }}>
                <Ic n="cal2" size={15} color="var(--cream)" />
              </button>
            )}
            <button className="x-btn" title="Delete" style={{ background: "rgba(224,85,64,.25)", width: 30, height: 30 }}
              onClick={() => del(job)}><Ic n="trash" size={14} color="var(--danger)" /></button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ animation: "fadeUp .25s ease both" }}>
      <div className="section-hd">Job Tracker</div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" style={{ width: "auto", padding: "10px 14px" }} onClick={() => setDate(todayStr())}>Today</button>
      </div>

      <JobsMap jobs={jobs} />

      {loading ? <div className="empty"><span className="spinner" /></div> : jobs.length === 0 ? (
        <div className="empty" style={{ paddingTop: 30 }}>
          <Ic n="list" size={36} color="var(--moss)" style={{ marginBottom: 8 }} />
          <div className="hd-cond">No jobs on {prettyDate(date)}</div>
        </div>
      ) : (
        <div style={{ marginTop: 18 }}>
          {progress.length > 0 && <><div className="section-hd"><Ic n="clock" size={14} /> In Progress — {progress.length}</div>{progress.map((j) => <Row key={j.id} job={j} />)}</>}
          {scheduled.length > 0 && <><div className="section-hd" style={{ marginTop: 14 }}>Scheduled — {scheduled.length}</div>{scheduled.map((j) => <Row key={j.id} job={j} />)}</>}
          {completed.length > 0 && <><div className="section-hd" style={{ marginTop: 14 }}><Ic n="check" size={14} /> Completed — {completed.length}</div>{completed.map((j) => <Row key={j.id} job={j} />)}</>}
        </div>
      )}

      {carry && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setCarry(null)}>
          <div className="card" style={{ width: "100%", maxWidth: 360, padding: 18, margin: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="hd-bebas" style={{ fontSize: 20, color: "var(--mgr-lt)", letterSpacing: 1, marginBottom: 4 }}>CARRY OVER JOB</div>
            <div style={{ fontSize: 13, color: "var(--stone)", marginBottom: 14 }}>{carry.client_name || carry.address} → move to a new date</div>
            <span className="label">New date</span>
            <input className="input" type="date" value={carryDate} onChange={(e) => setCarryDate(e.target.value)} style={{ marginBottom: 14 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setCarry(null)}>Cancel</button>
              <button className="btn btn-mgr btn-sm" onClick={doCarry}>Move Job</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================================================================
   MANAGER — Projects
   =================================================================== */
const WEEKDAYS = [["Su", 0], ["Mo", 1], ["Tu", 2], ["We", 3], ["Th", 4], ["Fr", 5], ["Sa", 6]];

async function generateProjectJobs(project, weekdaySet) {
  const days = eachDayInRange(project.start_date, project.end_date, weekdaySet);
  const rows = days.map((d, i) => ({
    crew_number: Number(project.crew_number),
    date: d,
    client_id: project.client_id || null,
    address: project.address,
    lat: project.lat, lng: project.lng,
    service_type: project.name,
    notes: project.notes || null,
    truck_number: project.truck_number || null,
    members: project.members || [],
    status: "scheduled",
    is_project: true,
    project_id: project.id,
    sort_order: i,
  }));
  // insert in chunks
  for (let i = 0; i < rows.length; i += 50) {
    await supabase.from("jobs").insert(rows.slice(i, i + 50));
  }
  return days.length;
}

function NewProject({ onDone, onCancel }) {
  const [f, setF] = useState({
    name: "", search: "", client: null, address: "", contact_name: "", contact_phone: "",
    notes: "", crew: "", truck: "", start_date: todayStr(), end_date: addDays(todayStr(), 5),
  });
  const [members, setMembers] = useState([]);
  const [days, setDays] = useState(new Set([1, 2, 3, 4, 5])); // Mon–Fri default
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [crews, setCrews] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    supabase.from("employees").select("*").eq("active", true).order("name").then(({ data }) => setEmployees(data || []));
    supabase.from("clients").select("*").then(({ data }) => setClients(data || []));
    supabase.from("crews").select("*").then(({ data }) => { const m = {}; (data || []).forEach((c) => (m[c.crew_number] = c)); setCrews(m); });
  }, []);
  useEffect(() => { if (f.crew) { const r = crews[f.crew]; set("truck", r?.truck_number || ""); setMembers(Array.isArray(r?.members) ? r.members : []); } }, [f.crew]); // eslint-disable-line

  const toggleMember = (n) => setMembers((m) => (m.includes(n) ? m.filter((x) => x !== n) : [...m, n]));
  const toggleDay = (d) => setDays((s) => { const n = new Set(s); n.has(d) ? n.delete(d) : n.add(d); return n; });

  const save = async () => {
    if (!f.name.trim()) { setMsg("Name the project."); return; }
    if (!f.address.trim()) { setMsg("Add a job-site address."); return; }
    if (!f.crew) { setMsg("Assign a crew."); return; }
    if (f.end_date < f.start_date) { setMsg("End date is before start date."); return; }
    if (days.size === 0) { setMsg("Pick at least one working weekday."); return; }
    setBusy(true); setMsg("");

    let lat = f.client?.lat ?? null, lng = f.client?.lng ?? null;
    if (lat == null) { const g = await geocode(f.address); if (g) { lat = g.lat; lng = g.lng; } }

    const { data: project } = await supabase.from("projects").insert({
      name: f.name, client_id: f.client?.id || null, address: f.address, lat, lng,
      notes: f.notes || null, contact_name: f.contact_name || null, contact_phone: f.contact_phone || null,
      crew_number: Number(f.crew), truck_number: f.truck || null, members,
      start_date: f.start_date, end_date: f.end_date, status: "active",
    }).select().single();

    // refresh crew roster too
    await supabase.from("crews").update({ truck_number: f.truck || null, members, updated_at: new Date().toISOString() }).eq("crew_number", f.crew);

    let n = 0;
    if (project) n = await generateProjectJobs(project, days);
    setBusy(false);
    onDone?.(`Project created — ${n} day${n > 1 ? "s" : ""} scheduled for Crew ${f.crew}.`);
  };

  const crewOpts = ALL_CREWS.map((x) => ({ value: x, label: `Crew ${x}` + (isMowing(x) ? " (Mowing)" : "") }));

  return (
    <div style={{ animation: "fadeUp .25s ease both" }}>
      <button className="back-btn" onClick={onCancel}><Ic n="back" size={14} /> Back to projects</button>
      <div className="section-hd">New Project</div>

      <span className="label">Project name</span>
      <input className="input" style={{ marginBottom: 12 }} placeholder="e.g. Nouria Plaza — Full Reno"
        value={f.name} onChange={(e) => set("name", e.target.value)} />

      <span className="label">Job-site address</span>
      <div style={{ marginBottom: 12 }}>
        <AddressSearch clients={clients} value={f.search}
          onChangeText={(v) => set("search", v) || set("address", v)}
          onPick={(c) => setF((p) => ({ ...p, client: c, address: c.address || c.name, search: `${c.name} — ${c.address || ""}`,
            contact_name: p.contact_name || c.contact_name || "", contact_phone: p.contact_phone || c.contact_phone || "" }))} />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <span className="label">Point of contact</span>
          <input className="input" placeholder="Name" value={f.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <span className="label">Phone</span>
          <input className="input" placeholder="Phone" value={f.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
        </div>
      </div>

      <span className="label">Project notes</span>
      <textarea className="input" style={{ height: 70, fontSize: 14, marginBottom: 14 }} placeholder="Scope, materials, special instructions…"
        value={f.notes} onChange={(e) => set("notes", e.target.value)} />

      <span className="label">Crew</span>
      <div style={{ marginBottom: 12 }}><Dropdown value={f.crew} placeholder="Choose a crew…" options={crewOpts} onChange={(v) => set("crew", v)} /></div>

      {f.crew && (
        <>
          <span className="label">Truck #</span>
          <input className="input" style={{ marginBottom: 12 }} placeholder="Truck number" value={f.truck} onChange={(e) => set("truck", e.target.value)} />
          <span className="label">Crew members</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
            {employees.map((e) => <button key={e.id} className={"member-chip" + (members.includes(e.name) ? " on" : "")} onClick={() => toggleMember(e.name)}>{e.name}</button>)}
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}><span className="label">Start date</span><input className="input" type="date" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></div>
        <div style={{ flex: 1 }}><span className="label">End date</span><input className="input" type="date" value={f.end_date} onChange={(e) => set("end_date", e.target.value)} /></div>
      </div>

      <span className="label">Working days</span>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {WEEKDAYS.map(([lbl, d]) => (
          <button key={d} className={"member-chip" + (days.has(d) ? " on" : "")} style={{ flex: 1, textAlign: "center", padding: "9px 0" }} onClick={() => toggleDay(d)}>{lbl}</button>
        ))}
      </div>

      {msg && <div className="error" style={{ marginBottom: 12 }}>{msg}</div>}
      <button className="btn btn-mgr" disabled={busy} onClick={save}>{busy ? "Creating…" : "CREATE PROJECT"}</button>
    </div>
  );
}

function ProjectDetail({ project, onBack, onChanged }) {
  const [photos, setPhotos] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [editing, setEditing] = useState(false);
  const [truck, setTruck] = useState(project.truck_number || "");
  const [members, setMembers] = useState(project.members || []);
  const [crew, setCrew] = useState(project.crew_number || "");
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const loadPhotos = useCallback(async () => {
    const { data: pp } = await supabase.from("project_photos").select("*").eq("project_id", project.id).order("created_at");
    const { data: jobRows } = await supabase.from("jobs").select("id").eq("project_id", project.id);
    let jobPhotos = [];
    if (jobRows?.length) {
      const { data } = await supabase.from("job_photos").select("*").in("job_id", jobRows.map((j) => j.id)).order("created_at");
      jobPhotos = data || [];
    }
    setPhotos([...(pp || []), ...jobPhotos]);
  }, [project.id]);

  useEffect(() => { loadPhotos(); supabase.from("employees").select("*").eq("active", true).order("name").then(({ data }) => setEmployees(data || [])); }, [loadPhotos]);

  const addProjectPhotos = async (files) => {
    setUploading(true);
    for (const fl of files) { const url = await uploadPhoto(fl, `proj_${project.id}`); if (url) await supabase.from("project_photos").insert({ project_id: project.id, url }); }
    await loadPhotos(); setUploading(false);
  };

  const saveEdit = async () => {
    await supabase.from("projects").update({ crew_number: Number(crew), truck_number: truck || null, members }).eq("id", project.id);
    // update FUTURE daily jobs (today onward) so the change propagates
    await supabase.from("jobs").update({ crew_number: Number(crew), truck_number: truck || null, members })
      .eq("project_id", project.id).gte("date", todayStr());
    setEditing(false); onChanged?.();
  };
  const markComplete = async () => {
    if (!window.confirm("Mark this project complete? Future scheduled days will be removed.")) return;
    await supabase.from("projects").update({ status: "complete" }).eq("id", project.id);
    await supabase.from("jobs").delete().eq("project_id", project.id).gte("date", todayStr()).neq("status", "completed").neq("status", "done_for_today");
    onChanged?.(); onBack();
  };
  const deleteProject = async () => {
    if (!window.confirm("Delete this project and ALL its scheduled days? This cannot be undone.")) return;
    await supabase.from("projects").delete().eq("id", project.id); // cascades to jobs
    onChanged?.(); onBack();
  };

  const toggleMember = (n) => setMembers((m) => (m.includes(n) ? m.filter((x) => x !== n) : [...m, n]));
  const crewOpts = ALL_CREWS.map((x) => ({ value: x, label: `Crew ${x}` }));

  return (
    <div style={{ animation: "fadeUp .25s ease both" }}>
      <button className="back-btn" onClick={onBack}><Ic n="back" size={14} /> Back to projects</button>

      <div className="card" style={{ padding: 16, borderLeft: "4px solid var(--purple)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div className="hd-bebas" style={{ fontSize: 24, color: "var(--cream)", letterSpacing: 1, lineHeight: 1.05 }}>{project.name}</div>
          <span className="chip" style={{ background: project.status === "complete" ? "rgba(106,184,32,.16)" : "rgba(155,89,182,.16)", color: project.status === "complete" ? "var(--lime)" : "#c98fdb" }}>
            {project.status === "complete" ? "Complete" : "Active"}
          </span>
        </div>
        <div style={{ fontSize: 13, color: "var(--mgr-lt)", marginTop: 6 }}><Ic n="pin" size={13} /> {project.address}</div>
        <div className="hd-cond" style={{ fontSize: 13, color: "var(--stone)", marginTop: 6, letterSpacing: .5 }}>
          <Ic n="calendar" size={13} /> {prettyDate(project.start_date)} → {prettyDate(project.end_date)}
        </div>
      </div>

      {(project.contact_name || project.contact_phone) && (
        <div className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--moss)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Ic n="user" size={20} color="var(--lime)" />
          </div>
          <div style={{ flex: 1 }}>
            <div className="hd-cond" style={{ fontSize: 10, letterSpacing: 2, color: "var(--stone)", textTransform: "uppercase" }}>Point of Contact</div>
            <div className="hd-cond" style={{ fontSize: 16, fontWeight: 700, color: "var(--cream)" }}>{project.contact_name || "—"}</div>
            {project.contact_phone && <div style={{ fontSize: 13, color: "var(--stone)" }}>{project.contact_phone}</div>}
          </div>
          {project.contact_phone && <a href={`tel:${project.contact_phone}`} style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--lime)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ic n="phone" size={17} color="var(--earth)" /></a>}
        </div>
      )}

      {project.notes && (
        <div className="card" style={{ padding: 14 }}>
          <div className="hd-cond" style={{ fontSize: 10, letterSpacing: 2, color: "var(--leaf)", textTransform: "uppercase", marginBottom: 4 }}>Notes</div>
          <div style={{ fontSize: 14, color: "var(--cream)", whiteSpace: "pre-wrap" }}>{project.notes}</div>
        </div>
      )}

      {/* crew assignment */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: editing ? 12 : 0 }}>
          <div>
            <div className="hd-cond" style={{ fontSize: 10, letterSpacing: 2, color: "var(--stone)", textTransform: "uppercase" }}>Assigned</div>
            <div className="hd-cond" style={{ fontSize: 16, fontWeight: 700, color: "var(--cream)" }}>
              Crew {project.crew_number}{project.truck_number ? ` · Truck ${project.truck_number}` : ""}
            </div>
            {project.members?.length > 0 && <div style={{ fontSize: 13, color: "var(--stone)" }}>{project.members.join(", ")}</div>}
          </div>
          {!editing && project.status !== "complete" && <button className="btn btn-ghost btn-sm" style={{ width: "auto", padding: "8px 12px" }} onClick={() => setEditing(true)}><Ic n="edit" size={14} /></button>}
        </div>
        {editing && (
          <>
            <span className="label">Crew</span>
            <div style={{ marginBottom: 10 }}><Dropdown value={crew} placeholder="Crew" options={crewOpts} onChange={setCrew} /></div>
            <span className="label">Truck #</span>
            <input className="input" style={{ marginBottom: 10 }} value={truck} onChange={(e) => setTruck(e.target.value)} />
            <span className="label">Members</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
              {employees.map((e) => <button key={e.id} className={"member-chip" + (members.includes(e.name) ? " on" : "")} onClick={() => toggleMember(e.name)}>{e.name}</button>)}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-mgr btn-sm" onClick={saveEdit}>Save & update upcoming days</button>
            </div>
          </>
        )}
      </div>

      {/* photos */}
      <div className="section-hd">Job-Site Photos</div>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
        onChange={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) addProjectPhotos(fs); e.target.value = ""; }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
        {photos.map((p) => (
          <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="photo-thumb" style={{ aspectRatio: "1" }}>
            <img src={p.url} alt="site" />
            {p.kind && p.kind !== "other" && <span className="chip" style={{ position: "absolute", bottom: 4, left: 4, fontSize: 9, padding: "2px 6px", background: "rgba(0,0,0,.6)", color: "#fff" }}>{p.kind}</span>}
          </a>
        ))}
        <div onClick={() => fileRef.current?.click()} style={{ aspectRatio: "1", border: "1.5px dashed var(--moss)", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", color: "var(--stone)" }}>
          {uploading ? <span className="spinner" /> : <><Ic n="camera" size={22} /><span className="hd-cond" style={{ fontSize: 11 }}>ADD</span></>}
        </div>
      </div>

      {project.status !== "complete" && <button className="btn btn-lime" style={{ marginBottom: 8 }} onClick={markComplete}>MARK PROJECT COMPLETE</button>}
      <button className="btn btn-danger btn-sm" onClick={deleteProject}><Ic n="trash" size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Delete project</button>
    </div>
  );
}

function ProjectsTab() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list"); // list | new | detail
  const [active, setActive] = useState(null);
  const [flash, setFlash] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("projects").select("*").order("status").order("start_date", { ascending: false });
    setProjects(data || []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (view === "new") return <NewProject onCancel={() => setView("list")} onDone={(m) => { setFlash(m); setView("list"); load(); }} />;
  if (view === "detail" && active) return <ProjectDetail project={projects.find((p) => p.id === active.id) || active} onBack={() => setView("list")} onChanged={load} />;

  const activeProjects = projects.filter((p) => p.status !== "complete");
  const doneProjects = projects.filter((p) => p.status === "complete");

  const Box = ({ p }) => (
    <div className="card" style={{ padding: 14, borderLeft: "4px solid var(--purple)", cursor: "pointer" }}
      onClick={() => { setActive(p); setView("detail"); }}>
      <div className="hd-bebas" style={{ fontSize: 19, color: "var(--cream)", letterSpacing: 1, lineHeight: 1.05 }}>{p.name}</div>
      <div style={{ fontSize: 12, color: "var(--stone)", marginTop: 3 }}><Ic n="pin" size={12} /> {p.address}</div>
      <div className="hd-cond" style={{ fontSize: 12, color: "var(--mgr-lt)", marginTop: 5, letterSpacing: .5 }}>
        Crew {p.crew_number} · {prettyDate(p.start_date)} → {prettyDate(p.end_date)}
      </div>
      {p.contact_name && <div style={{ fontSize: 12, color: "var(--stone)", marginTop: 3 }}><Ic n="user" size={12} /> {p.contact_name}</div>}
    </div>
  );

  return (
    <div style={{ animation: "fadeUp .25s ease both" }}>
      {flash && <div className="success" style={{ marginBottom: 12 }}><Ic n="check" size={16} /> {flash}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div className="section-hd" style={{ flex: 1 }}>Projects</div>
      </div>
      <button className="btn btn-mgr btn-sm" style={{ marginBottom: 16 }} onClick={() => setView("new")}>
        <Ic n="plus" size={15} style={{ marginRight: 6, verticalAlign: -2 }} />NEW PROJECT
      </button>

      {loading ? <div className="empty"><span className="spinner" /></div> : projects.length === 0 ? (
        <div className="empty"><Ic n="folder" size={36} color="var(--moss)" style={{ marginBottom: 8 }} /><div className="hd-cond">No projects yet</div></div>
      ) : (
        <>
          {activeProjects.map((p) => <Box key={p.id} p={p} />)}
          {doneProjects.length > 0 && <><div className="section-hd" style={{ marginTop: 16 }}>Completed</div>{doneProjects.map((p) => <Box key={p.id} p={p} />)}</>}
        </>
      )}
    </div>
  );
}

/* ===================================================================
   MANAGER — Crews & Employees (admin)
   =================================================================== */
function CrewsTab() {
  const [employees, setEmployees] = useState([]);
  const [crews, setCrews] = useState([]);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    const [{ data: emp }, { data: cr }] = await Promise.all([
      supabase.from("employees").select("*").order("name"),
      supabase.from("crews").select("*").order("crew_number"),
    ]);
    setEmployees(emp || []); setCrews(cr || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const addEmp = async () => { if (!newName.trim()) return; await supabase.from("employees").insert({ name: newName.trim() }); setNewName(""); load(); };
  const toggleEmp = async (e) => { await supabase.from("employees").update({ active: !e.active }).eq("id", e.id); load(); };
  const delEmp = async (e) => { if (!window.confirm(`Remove ${e.name}?`)) return; await supabase.from("employees").delete().eq("id", e.id); load(); };

  return (
    <div style={{ animation: "fadeUp .25s ease both" }}>
      <div className="section-hd">Employees</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input className="input" placeholder="Add employee name…" value={newName}
          onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addEmp()} />
        <button className="btn btn-mgr btn-sm" style={{ width: "auto", padding: "10px 16px" }} onClick={addEmp}>ADD</button>
      </div>
      {employees.map((e) => (
        <div key={e.id} className="card" style={{ padding: "11px 13px", display: "flex", alignItems: "center", gap: 10, opacity: e.active ? 1 : 0.5 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--moss)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span className="hd-bebas" style={{ fontSize: 15, color: "var(--lime)" }}>{e.name.slice(0, 2).toUpperCase()}</span>
          </div>
          <div className="hd-cond" style={{ flex: 1, fontWeight: 700, fontSize: 15, color: "var(--cream)" }}>{e.name}</div>
          <button className="btn btn-ghost btn-sm" style={{ width: "auto", padding: "6px 10px" }} onClick={() => toggleEmp(e)}>{e.active ? "Active" : "Inactive"}</button>
          <button className="x-btn" style={{ background: "rgba(224,85,64,.2)", width: 30, height: 30 }} onClick={() => delEmp(e)}><Ic n="trash" size={14} color="var(--danger)" /></button>
        </div>
      ))}

      <div className="section-hd" style={{ marginTop: 20 }}>Saved Crew Rosters</div>
      <div className="hd-cond" style={{ fontSize: 12, color: "var(--stone)", marginBottom: 12 }}>
        Crews 1–7 (mowing) keep their roster and pre-fill when you build a schedule. Edit a roster any time on the Build tab.
      </div>
      {crews.map((c) => (
        <div key={c.crew_number} className="card" style={{ padding: "11px 13px", borderLeft: `4px solid ${isMowing(c.crew_number) ? "var(--lime)" : "var(--moss)"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="hd-bebas" style={{ fontSize: 17, color: "var(--cream)", letterSpacing: 1 }}>
              CREW {c.crew_number} {isMowing(c.crew_number) && <span style={{ fontSize: 12, color: "var(--lime)" }}>MOWING</span>}
            </span>
            {c.truck_number && <span className="pill">Truck {c.truck_number}</span>}
          </div>
          <div style={{ fontSize: 13, color: c.members?.length ? "var(--stone)" : "var(--moss)", marginTop: 4 }}>
            {c.members?.length ? c.members.join(", ") : "— empty —"}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ===================================================================
   MANAGER HOME (tabbed)
   =================================================================== */
function ManagerHome({ onLogout }) {
  const [tab, setTab] = useState("build");
  const [flash, setFlash] = useState("");
  const tabs = [
    { id: "build", label: "Build", icon: "plus" },
    { id: "jobs", label: "Jobs", icon: "map" },
    { id: "projects", label: "Projects", icon: "folder" },
    { id: "crews", label: "Crews", icon: "user" },
  ];
  const onSchedDone = (m) => { setFlash(m); setTab("jobs"); };

  return (
    <div className="screen">
      <div className="topbar mgr">
        <span className="topbar-title">TOTALFLO · MANAGER</span>
        <button className="logout" onClick={onLogout}>Sign out</button>
      </div>
      <div className="content">
        {flash && tab === "jobs" && <div className="success" style={{ marginBottom: 12 }}><Ic n="check" size={16} /> {flash}</div>}
        {tab === "build" && <BuildSchedule onDone={onSchedDone} />}
        {tab === "jobs" && <ManagerJobs />}
        {tab === "projects" && <ProjectsTab />}
        {tab === "crews" && <CrewsTab />}
      </div>
      <div className="tabbar">
        {tabs.map((t) => (
          <button key={t.id} className={"tab mgr" + (tab === t.id ? " active mgr" : "")}
            onClick={() => { setTab(t.id); if (t.id !== "jobs") setFlash(""); }}>
            <Ic n={t.icon} />{t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ===================================================================
   ROOT
   =================================================================== */
export default function App() {
  const [screen, setScreen] = useState("login"); // login | crew | manager
  const [crew, setCrew] = useState(null);

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {screen === "login" && (
          <LoginScreen
            onCrewLogin={(n) => { setCrew(n); setScreen("crew"); }}
            onManagerLogin={() => setScreen("manager")} />
        )}
        {screen === "crew" && crew && (
          <CrewHome crew={crew} onLogout={() => { setCrew(null); setScreen("login"); }} />
        )}
        {screen === "manager" && (
          <ManagerHome onLogout={() => setScreen("login")} />
        )}
      </div>
    </>
  );
}
