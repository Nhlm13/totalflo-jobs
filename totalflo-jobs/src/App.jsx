import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
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

// The yard — routes start and end here. Coordinates are resolved live by
// geocoding the address; these are a verified fallback (Southborough town center).
const SHOP = { address: "179 Boston Rd, Southborough, MA 01772", lat: 42.3056, lng: -71.5245 };

/* =============================== i18n ==============================
   Crew-facing screens are translated. Each device remembers its choice.
   Manager screens stay in English.
   =================================================================== */
const LOCALES = { en: "en-US", es: "es-ES", pt: "pt-BR" };
const TR = {
  en: {
    crewDispatch: "Crew Dispatch", selectCrew: "Select your crew", chooseCrew: "Choose a crew…",
    signIn: "SIGN IN", managerLogin: "Manager / Office login", crew: "Crew", mowing: "Mowing",
    managerAccess: "MANAGER ACCESS", passcode: "Passcode", enter: "ENTER",
    incorrectPasscode: "Incorrect passcode.", backToCrew: "← Back to crew login", signOut: "Sign out",
    noJobsToday: "No jobs assigned today", toDo: "To Do", allCaughtUp: "All caught up! 🎉", done: "Done",
    job: "Job", project: "Project", continueJob: "Continue", openJob: "Open job",
    backToJobs: "Back to jobs", managerNotes: "Manager Notes", running: "Running", paused: "Paused",
    arrivalChecklist: "Arrival Checklist", propertyWalkthrough: "Property walk-through",
    documentDamage: "Document existing damage", optional: "optional", damagePhotos: "Damage photos",
    damageNotePlaceholder: "Notes about existing damage…", beforePhoto: "Before photo", photos: "Photos",
    time: "Time", startJob: "START JOB", endJob: "END JOB", resumeTimer: "RESUME TIMER",
    afterPhoto: "After photo", completionNotes: "Completion notes (optional)…", saving: "Saving…",
    doneForToday: "DONE FOR TODAY", markComplete: "MARK COMPLETE", uploadingPhoto: "Uploading photo…",
    add: "ADD", statusComplete: "Complete", statusInProgress: "In Progress",
    statusDoneToday: "Done Today", statusScheduled: "Scheduled",
    upNext: "Up Next", directions: "Directions", progressDone: "{d} of {t} done",
    left: "{n} left", mapWord: "Map", hideMap: "Hide map",
  },
  es: {
    crewDispatch: "Despacho de Cuadrillas", selectCrew: "Selecciona tu cuadrilla", chooseCrew: "Elige una cuadrilla…",
    signIn: "INICIAR SESIÓN", managerLogin: "Acceso de gerente / oficina", crew: "Cuadrilla", mowing: "Corte",
    managerAccess: "ACCESO DE GERENTE", passcode: "Código", enter: "ENTRAR",
    incorrectPasscode: "Código incorrecto.", backToCrew: "← Volver al inicio de cuadrilla", signOut: "Cerrar sesión",
    noJobsToday: "No hay trabajos asignados hoy", toDo: "Por Hacer", allCaughtUp: "¡Todo al día! 🎉", done: "Hecho",
    job: "Trabajo", project: "Proyecto", continueJob: "Continuar", openJob: "Abrir trabajo",
    backToJobs: "Volver a trabajos", managerNotes: "Notas del Gerente", running: "En curso", paused: "Pausado",
    arrivalChecklist: "Lista de Llegada", propertyWalkthrough: "Recorrido de la propiedad",
    documentDamage: "Documentar daños existentes", optional: "opcional", damagePhotos: "Fotos de daños",
    damageNotePlaceholder: "Notas sobre daños existentes…", beforePhoto: "Foto antes", photos: "Fotos",
    time: "Tiempo", startJob: "INICIAR TRABAJO", endJob: "TERMINAR TRABAJO", resumeTimer: "REANUDAR TIEMPO",
    afterPhoto: "Foto después", completionNotes: "Notas de finalización (opcional)…", saving: "Guardando…",
    doneForToday: "LISTO POR HOY", markComplete: "MARCAR COMPLETO", uploadingPhoto: "Subiendo foto…",
    add: "AGREGAR", statusComplete: "Completo", statusInProgress: "En Progreso",
    statusDoneToday: "Hecho Hoy", statusScheduled: "Programado",
    upNext: "Siguiente", directions: "Cómo llegar", progressDone: "{d} de {t} hechos",
    left: "{n} restantes", mapWord: "Mapa", hideMap: "Ocultar mapa",
  },
  pt: {
    crewDispatch: "Despacho de Equipes", selectCrew: "Selecione sua equipe", chooseCrew: "Escolha uma equipe…",
    signIn: "ENTRAR", managerLogin: "Acesso de gerente / escritório", crew: "Equipe", mowing: "Corte",
    managerAccess: "ACESSO DE GERENTE", passcode: "Senha", enter: "ENTRAR",
    incorrectPasscode: "Senha incorreta.", backToCrew: "← Voltar ao login da equipe", signOut: "Sair",
    noJobsToday: "Nenhum trabalho atribuído hoje", toDo: "A Fazer", allCaughtUp: "Tudo em dia! 🎉", done: "Concluído",
    job: "Trabalho", project: "Projeto", continueJob: "Continuar", openJob: "Abrir trabalho",
    backToJobs: "Voltar aos trabalhos", managerNotes: "Notas do Gerente", running: "Em andamento", paused: "Pausado",
    arrivalChecklist: "Checklist de Chegada", propertyWalkthrough: "Vistoria da propriedade",
    documentDamage: "Documentar danos existentes", optional: "opcional", damagePhotos: "Fotos de danos",
    damageNotePlaceholder: "Notas sobre danos existentes…", beforePhoto: "Foto antes", photos: "Fotos",
    time: "Tempo", startJob: "INICIAR TRABALHO", endJob: "ENCERRAR TRABALHO", resumeTimer: "RETOMAR TEMPO",
    afterPhoto: "Foto depois", completionNotes: "Notas de conclusão (opcional)…", saving: "Salvando…",
    doneForToday: "CONCLUÍDO POR HOJE", markComplete: "MARCAR CONCLUÍDO", uploadingPhoto: "Enviando foto…",
    add: "ADICIONAR", statusComplete: "Concluído", statusInProgress: "Em Progresso",
    statusDoneToday: "Feito Hoje", statusScheduled: "Agendado",
    upNext: "Próximo", directions: "Como chegar", progressDone: "{d} de {t} concluídos",
    left: "{n} restantes", mapWord: "Mapa", hideMap: "Ocultar mapa",
  },
};
const LangContext = React.createContext({ lang: "en", setLang: () => {} });
function useLang() { return React.useContext(LangContext); }
function useT() {
  const { lang } = React.useContext(LangContext);
  return (key, vars) => {
    let s = (TR[lang] && TR[lang][key]) || TR.en[key] || key;
    if (vars) for (const k in vars) s = String(s).split("{" + k + "}").join(vars[k]);
    return s;
  };
}
function LangToggle() {
  const { lang, setLang } = useLang();
  const opts = [["en", "🇺🇸"], ["es", "🇬🇹"], ["pt", "🇧🇷"]];
  return (
    <div style={{ display: "inline-flex", gap: 4, background: "var(--bark)", border: "1px solid var(--moss)", borderRadius: 8, padding: 3 }}>
      {opts.map(([code, label]) => (
        <button key={code} onClick={() => setLang(code)}
          style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, letterSpacing: 1, padding: "4px 8px",
            borderRadius: 6, border: "none", cursor: "pointer",
            background: lang === code ? "var(--lime)" : "transparent",
            color: lang === code ? "var(--earth)" : "var(--stone)", fontWeight: 700 }}>
          {label}
        </button>
      ))}
    </div>
  );
}

const ThemeContext = React.createContext({ theme: "dark", setTheme: () => {} });
function useTheme() { return React.useContext(ThemeContext); }
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";
  return (
    <button onClick={() => setTheme(dark ? "light" : "dark")} aria-label="Toggle light or dark mode"
      style={{ background: "var(--bark)", border: "1px solid var(--moss)", borderRadius: 8, padding: "5px 10px",
        cursor: "pointer", fontSize: 16, lineHeight: 1, display: "inline-flex", alignItems: "center" }}>
      {dark ? "☀️" : "🌙"}
    </button>
  );
}

/* ----------------------------- date helpers ------------------------- */
const TZ = "America/New_York";
const todayStr = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const addDays = (dateStr, n) => {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
};
const prettyDate = (dateStr, locale = "en-US") => {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
};
const fmtTime = (ts) => (ts ? new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "");
const timeAgo = (ts) => {
  if (!ts) return "";
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
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
// Sunday that begins the week containing dateStr
const weekAnchor = (dateStr) => {
  const d = new Date(dateStr + "T12:00:00");
  return addDays(dateStr, -d.getDay());
};
// All visit dates for a recurrence rule. weekdays = array of 0-6,
// frequency = "weekly" | "biweekly" (biweekly = every other week from start).
const seriesDates = (weekdays, frequency, start, end) => {
  if (!weekdays || !weekdays.length || !start || !end) return [];
  const set = new Set(weekdays.map(Number));
  const anchor = weekAnchor(start);
  const out = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard < 500) {
    const dow = new Date(cur + "T12:00:00").getDay();
    if (set.has(dow)) {
      const weeksSince = Math.round((new Date(cur + "T12:00:00") - new Date(anchor + "T12:00:00")) / (7 * 86400000));
      if (frequency !== "biweekly" || weeksSince % 2 === 0) out.push(cur);
    }
    cur = addDays(cur, 1);
    guard++;
  }
  return out;
};
const WD = [["Su", 0], ["Mo", 1], ["Tu", 2], ["We", 3], ["Th", 4], ["Fr", 5], ["Sa", 6]];

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
  --bg:#141a0e;
  --earth:#141a0e; --bark:#1c2414; --bark2:#243018; --moss:#3a4a2a;
  --leaf:#5a9e18; --lime:#6ab820; --dirt:#7a6845; --sand:#a89060;
  --stone:#8aaa70; --cream:#e8f0d8; --danger:#e05540; --warn:#d4840a;
  --mgr:#2a5a95; --mgr-lt:#5a9adf; --purple:#9b59b6;
}
:root[data-theme="light"]{
  --bg:#f5f8ef; --earth:#17220e; --bark:#ffffff; --bark2:#eef3e3; --moss:#cdd9bd;
  --leaf:#4e8e14; --lime:#4f8d16; --dirt:#7a6845; --sand:#8a7340;
  --stone:#5d7a48; --cream:#1b3a10; --danger:#c0392b; --warn:#b06a08;
  --mgr:#2a5a95; --mgr-lt:#2a5a95; --purple:#7e3f99;
}
body{background:var(--bg);font-family:'Barlow',sans-serif;color:var(--cream);-webkit-tap-highlight-color:transparent;}
.app{max-width:480px;min-height:100dvh;margin:0 auto;background:var(--bg);display:flex;flex-direction:column;position:relative;}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1}}
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
.tab{flex:1;padding:9px 1px 8px;background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;font-family:'Barlow Condensed',sans-serif;font-size:9px;letter-spacing:.2px;text-transform:uppercase;color:var(--stone);white-space:nowrap;}
.tab.active{color:var(--lime);}
.tab.active.mgr{color:var(--mgr-lt);}
.tab svg{width:19px;height:19px;}

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
  refresh: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
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
  const t = useT();
  if (status === "completed") return <span className="chip chip-done"><Ic n="check" size={12} /> {t("statusComplete")}</span>;
  if (status === "in_progress") return <span className="chip chip-prog"><Ic n="clock" size={12} /> {t("statusInProgress")}</span>;
  if (status === "done_for_today") return <span className="chip chip-done"><Ic n="check" size={12} /> {t("statusDoneToday")}</span>;
  if (status === "skipped") return <span className="chip" style={{ background: "rgba(212,160,23,.18)", color: "var(--warn)" }}>Skipped</span>;
  return <span className="chip chip-sched">{t("statusScheduled")}</span>;
}

/* ===================================================================
   LOGIN
   =================================================================== */
function LoginScreen({ onCrewLogin, onManagerLogin }) {
  const t = useT();
  const [mode, setMode] = useState("crew");
  const [crew, setCrew] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  const crewOpts = ALL_CREWS.map((n) => ({
    value: n,
    label: `${t("crew")} ${n}` + (isMowing(n) ? `  (${t("mowing")})` : ""),
  }));

  const tryManager = () => {
    if (pass === MANAGER_PASSCODE) onManagerLogin();
    else setErr(t("incorrectPasscode"));
  };

  return (
    <div className="splash">
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div className="logo-title" style={{ fontSize: 34, letterSpacing: 1.5, lineHeight: 1.02 }}>{"J&J & Son Lawn Care"}</div>
        <div className="logo-sub">{"A TotalFlo app"}</div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginBottom: 28 }}>
        <LangToggle />
        <ThemeToggle />
      </div>

      {mode === "crew" ? (
        <div style={{ width: "100%" }}>
          <span className="label">{t("selectCrew")}</span>
          <div style={{ marginBottom: 16 }}>
            <Dropdown value={crew} placeholder={t("chooseCrew")} options={crewOpts}
              onChange={setCrew} />
          </div>
          <button className="btn btn-lime" disabled={!crew}
            onClick={() => onCrewLogin(Number(crew))}>{t("signIn")}</button>
          <div onClick={() => { setMode("mgr"); setErr(""); }}
            style={{ marginTop: 26, textAlign: "center", fontFamily: "'Barlow Condensed',sans-serif",
              fontSize: 13, color: "var(--mgr-lt)", cursor: "pointer", letterSpacing: 1,
              textDecoration: "underline", textUnderlineOffset: 3 }}>
            {t("managerLogin")}
          </div>
        </div>
      ) : (
        <div style={{ width: "100%", background: "var(--bark)", border: "1.5px solid var(--mgr)",
          borderRadius: 12, padding: 20 }}>
          <div className="hd-bebas" style={{ fontSize: 22, color: "var(--mgr-lt)", letterSpacing: 2, marginBottom: 16 }}>
            {t("managerAccess")}
          </div>
          <span className="label">{t("passcode")}</span>
          <input className="input" type="password" placeholder="••••••••" value={pass}
            style={{ marginBottom: 14, textAlign: "center", letterSpacing: 4 }}
            onChange={(e) => { setPass(e.target.value); setErr(""); }}
            onKeyDown={(e) => e.key === "Enter" && tryManager()} />
          <button className="btn btn-mgr" onClick={tryManager}>{t("enter")}</button>
          {err && <div className="error" style={{ marginTop: 12 }}>{err}</div>}
          <div onClick={() => { setMode("crew"); setErr(""); }}
            style={{ marginTop: 18, textAlign: "center", fontFamily: "'Barlow Condensed',sans-serif",
              fontSize: 13, color: "var(--stone)", cursor: "pointer", letterSpacing: 1 }}>
            {t("backToCrew")}
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
  const t = useT();
  const ref = useRef(null);
  const shown = photos.filter((p) => p.kind === kind);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span className="label" style={{ margin: 0 }}>{label}{optional && <span style={{ color: "var(--moss)" }}> · {t("optional")}</span>}</span>
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
          <span className="hd-cond" style={{ fontSize: 11, letterSpacing: 1 }}>{t("add")}</span>
        </div>
      </div>
    </div>
  );
}

/* ===================================================================
   CREW — Job Detail (handles mowing checklist, non-mowing, projects)
   =================================================================== */
function CrewJobDetail({ job, crew, onBack, onChanged }) {
  const t = useT();
  const mowing = true; // unified arrival flow (checklist + before/after) for all crews
  const project = job.is_project;
  const [checklist, setChecklist] = useState(job.checklist || {});
  const [photos, setPhotos] = useState([]);
  const [status, setStatus] = useState(job.status);
  const [startedAt, setStartedAt] = useState(job.started_at ? new Date(job.started_at).getTime() : null);
  const [baseSecs, setBaseSecs] = useState(job.elapsed_seconds || 0);
  const [, setTick] = useState(0);
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

  const title = job.client_name || job.address || t("job");
  const started = status === "in_progress" || baseSecs > 0;
  const ended = startedAt === null && baseSecs > 0;

  return (
    <div style={{ animation: "fadeUp .25s ease both" }}>
      <button className="back-btn" onClick={onBack}><Ic n="back" size={14} /> {t("backToJobs")}</button>

      <div className="card" style={{ padding: 14, borderLeft: `4px solid ${project ? "var(--purple)" : "var(--lime)"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div className="hd-bebas" style={{ fontSize: 24, color: "var(--cream)", letterSpacing: 1.5, lineHeight: 1.05 }}>{title}</div>
          <StatusChip status={status} />
        </div>
        {project && <div className="hd-cond" style={{ fontSize: 12, color: "var(--purple)", letterSpacing: 1, textTransform: "uppercase", marginTop: 2 }}>● {t("project")}</div>}
        <a href={`https://maps.apple.com/?q=${encodeURIComponent(job.address || "")}`} target="_blank" rel="noreferrer"
          style={{ fontSize: 14, color: "var(--mgr-lt)", display: "block", marginTop: 6, textDecoration: "none" }}>
          <Ic n="pin" size={13} /> {job.address}
        </a>
        {job.service_type && <div className="hd-bebas" style={{ fontSize: 16, color: "#92B4F4", letterSpacing: 1, marginTop: 6 }}>{job.service_type}</div>}
        {job.notes && (
          <div className="note-box note-mgr" style={{ marginTop: 8 }}>
            <div className="note-label" style={{ color: "var(--leaf)" }}>{t("managerNotes")}</div>
            <div style={{ fontSize: 13 }}>{job.notes}</div>
          </div>
        )}
      </div>

      {/* live timer */}
      {started && (
        <div className="card" style={{ padding: 14, textAlign: "center" }}>
          <div className="timer-big">{fmtClock(liveSecs)}</div>
          <div className="hd-cond" style={{ fontSize: 12, color: "var(--stone)", letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>
            {status === "in_progress" && startedAt ? t("running") : t("paused")}
          </div>
        </div>
      )}

      {/* MOWING CHECKLIST */}
      {mowing && (
        <>
          <div className="section-hd">{t("arrivalChecklist")}</div>
          <div className={"check-row" + (checklist.walkthrough ? " done" : "")} onClick={() => toggle("walkthrough")}>
            <div className="check-box">{checklist.walkthrough && <Ic n="check" size={16} color="#fff" />}</div>
            <span className="check-label">{t("propertyWalkthrough")}</span>
          </div>

          <div className="check-row" style={{ flexDirection: "column", alignItems: "stretch", cursor: "default" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="check-label">{t("documentDamage")}</span>
              <span className="check-opt">{t("optional")}</span>
            </div>
            <div style={{ marginTop: 10 }}>
              <PhotoStrip photos={photos} kind="damage" onAdd={addPhotos} onRemove={removePhoto}
                label={t("damagePhotos")} optional />
              <textarea className="input" placeholder={t("damageNotePlaceholder")} style={{ height: 64, fontSize: 14 }}
                value={damageNote} onChange={(e) => setDamageNote(e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 4 }}>
            <PhotoStrip photos={photos} kind="before" onAdd={addPhotos} onRemove={removePhoto}
              label={t("beforePhoto")} optional />
          </div>
        </>
      )}

      {/* NON-MOWING simple photos */}
      {!mowing && (
        <div style={{ marginTop: 4 }}>
          <div className="section-hd">{t("photos")}</div>
          <PhotoStrip photos={photos} kind="before" onAdd={addPhotos} onRemove={removePhoto} label={t("photos")} optional />
        </div>
      )}

      {/* START / END */}
      <div className="section-hd">{t("time")}</div>
      {!started && (
        <button className="btn btn-lime" onClick={startJob}>
          <Ic n="play" size={16} style={{ marginRight: 8, verticalAlign: -2 }} />{t("startJob")}
        </button>
      )}
      {status === "in_progress" && startedAt && (
        <button className="btn" style={{ background: "var(--warn)", color: "var(--earth)" }} onClick={endJob}>
          <Ic n="stop" size={16} style={{ marginRight: 8, verticalAlign: -2 }} />{t("endJob")}
        </button>
      )}
      {ended && (
        <button className="btn btn-ghost btn-sm" onClick={startJob} style={{ marginBottom: 4 }}>{t("resumeTimer")}</button>
      )}

      {/* AFTER PHOTO + FINALIZE (after ended) */}
      {ended && (
        <>
          <div style={{ marginTop: 14 }}>
            <PhotoStrip photos={photos} kind="after" onAdd={addPhotos} onRemove={removePhoto}
              label={t("afterPhoto")} optional={mowing} />
          </div>
          <textarea className="input" placeholder={t("completionNotes")} style={{ height: 64, fontSize: 14, marginBottom: 10 }}
            value={finalNote} onChange={(e) => setFinalNote(e.target.value)} />
          <button className="btn" disabled={busy || uploading}
            style={{ background: project ? "var(--purple)" : "var(--lime)", color: project ? "#fff" : "var(--earth)" }}
            onClick={finalize}>
            {busy ? t("saving") : project ? t("doneForToday") : t("markComplete")}
          </button>
        </>
      )}
      {uploading && <div className="hd-cond" style={{ textAlign: "center", color: "var(--stone)", fontSize: 12, marginTop: 8 }}><span className="spinner" /> {t("uploadingPhoto")}</div>}
    </div>
  );
}

/* ===================================================================
   CREW HOME
   =================================================================== */
function CrewHome({ crew, onLogout }) {
  const t = useT();
  const { lang } = useLang();
  const mowing = isMowing(crew);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null); // job being viewed
  const [showMap, setShowMap] = useState(false);
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
            <span className="topbar-title">{t("crew").toUpperCase()} {crew}</span>
            <span className="pill">{mowing ? t("mowing") : t("crew")}</span>
          </div>
          <button className="logout" onClick={onLogout}>{t("signOut")}</button>
        </div>
        <div className="content">
          <CrewJobDetail job={fresh} crew={crew} onBack={() => setOpen(null)} onChanged={load} />
        </div>
      </div>
    );
  }

  const active = jobs.filter((j) => j.status !== "completed" && j.status !== "done_for_today" && j.status !== "skipped");
  const done = jobs.filter((j) => j.status === "completed" || j.status === "done_for_today");

  return (
    <div className="screen">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="topbar-title">{t("crew").toUpperCase()} {crew}</span>
          <span className="pill"><Ic n="truck" size={12} /> {mowing ? t("mowing") : t("crew")}</span>
        </div>
        <button className="logout" onClick={onLogout}>{t("signOut")}</button>
      </div>

      <div className="content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8 }}>
          <div className="hd-cond" style={{ fontSize: 13, color: "var(--stone)", letterSpacing: 1, textTransform: "uppercase" }}>{prettyDate(today, LOCALES[lang])}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>

        {loading ? (
          <div className="empty"><span className="spinner" /></div>
        ) : jobs.length === 0 ? (
          <div className="empty">
            <Ic n="map" size={40} color="var(--moss)" style={{ marginBottom: 10 }} />
            <div className="hd-cond">{t("noJobsToday")}</div>
          </div>
        ) : (
          <>
            {/* today at a glance */}
            <div className="card" style={{ padding: 14, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span className="hd-bebas" style={{ fontSize: 18, color: "var(--cream)", letterSpacing: 1 }}>
                  {t("progressDone", { d: done.length, t: jobs.length })}
                </span>
                <span className="hd-cond" style={{ fontSize: 13, color: "var(--lime)" }}>{t("left", { n: active.length })}</span>
              </div>
              <div style={{ height: 8, borderRadius: 5, background: "var(--bark)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${jobs.length ? (done.length / jobs.length) * 100 : 0}%`, background: "var(--lime)", transition: "width .3s" }} />
              </div>
              {jobs.some((j) => j.lat != null) && (
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setShowMap((v) => !v)}>
                  <Ic n="map" size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                  {showMap ? t("hideMap") : t("mapWord")}
                </button>
              )}
            </div>

            {showMap && <div style={{ marginBottom: 16 }}><JobsMap jobs={jobs} /></div>}

            <div className="section-hd">{t("toDo")} — {active.length}</div>
            {active.map((job, idx) => <CrewJobCard key={job.id} job={job} onOpen={() => setOpen(job)} upNext={idx === 0 && job.status !== "in_progress"} />)}
            {active.length === 0 && <div className="hd-cond" style={{ color: "var(--stone)", fontSize: 13, marginBottom: 16 }}>{t("allCaughtUp")}</div>}

            {done.length > 0 && (
              <>
                <div className="section-hd" style={{ marginTop: 18 }}>{t("done")} — {done.length}</div>
                {done.map((job) => <CrewJobCard key={job.id} job={job} onOpen={() => setOpen(job)} done />)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CrewJobCard({ job, onOpen, done, upNext }) {
  const t = useT();
  const project = job.is_project;
  const color = job.status === "completed" || job.status === "done_for_today"
    ? "var(--leaf)" : job.status === "in_progress" ? "var(--purple)" : project ? "var(--purple)" : "var(--lime)";
  const mapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(job.address || "")}`;
  return (
    <div className="card" style={{ borderLeft: `4px solid ${upNext ? "var(--lime)" : color}`, opacity: done ? 0.78 : 1, cursor: "pointer", boxShadow: upNext ? "0 0 0 1.5px var(--lime)" : undefined }} onClick={onOpen}>
      <div style={{ padding: "12px 14px" }}>
        {upNext && <div className="hd-cond" style={{ fontSize: 11, color: "var(--earth)", background: "var(--lime)", display: "inline-block", padding: "2px 8px", borderRadius: 5, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>{t("upNext")}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
          <div className="hd-bebas" style={{ fontSize: 20, color: "var(--cream)", letterSpacing: 1, lineHeight: 1.05 }}>
            {job.client_name || job.address || t("job")}
          </div>
          <StatusChip status={job.status} />
        </div>
        {project && <div className="hd-cond" style={{ fontSize: 11, color: "var(--purple)", letterSpacing: 1, textTransform: "uppercase" }}>● {t("project")}</div>}
        <div style={{ fontSize: 13, color: "var(--mgr-lt)" }}><Ic n="pin" size={12} /> {job.address}</div>
        {job.service_type && <div className="hd-bebas" style={{ fontSize: 14, color: "#92B4F4", letterSpacing: 1, marginTop: 4 }}>{job.service_type}</div>}
        {job.notes && <div style={{ fontSize: 12, color: "var(--stone)", marginTop: 4 }}>{job.notes}</div>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 8 }}>
          {!done ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: color }}>
              <span className="hd-cond" style={{ fontSize: 13, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>
                {job.status === "in_progress" ? t("continueJob") : t("openJob")}
              </span>
              <Ic n="arrow" size={15} />
            </div>
          ) : <span />}
          {job.address && (
            <a href={mapsUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
              className="hd-cond" style={{ fontSize: 13, color: "var(--mgr-lt)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, letterSpacing: .5 }}>
              <Ic n="pin" size={13} /> {t("directions")}
            </a>
          )}
        </div>
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
  const [optimizing, setOptimizing] = useState(false);

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

  const addStop = () => setStops((s) => [...s, { key: Date.now() + Math.random(), search: "", client: null, address: "", service_type: "", notes: "", recurring: false, weekdays: [], frequency: "weekly", recurUntil: "" }]);
  const setStop = (key, patch) => setStops((s) => s.map((st) => (st.key === key ? { ...st, ...patch } : st)));
  const rmStop = (key) => setStops((s) => s.filter((st) => st.key !== key));
  const moveStop = (key, dir) => setStops((s) => {
    const i = s.findIndex((x) => x.key === key); const j = i + dir;
    if (i < 0 || j < 0 || j >= s.length) return s;
    const c = [...s]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });

  // Reorder stops into an efficient route that starts AND ends at the shop.
  // Still straight-line ("as the crow flies"): nearest-neighbor from the yard,
  // then a 2-opt pass that minimizes the full loop shop -> stops -> shop.
  const optimizeRoute = async () => {
    const haveAddr = stops.filter((s) => s.address.trim());
    if (haveAddr.length < 3) { setMsg("Add at least 3 stops to optimize the route."); return; }
    setOptimizing(true); setMsg("");

    // resolve the depot (shop) — geocode for accuracy, fall back to stored coords
    let depot = { lat: SHOP.lat, lng: SHOP.lng };
    const dg = await geocode(SHOP.address);
    if (dg) depot = { lat: dg.lat, lng: dg.lng };
    await new Promise((r) => setTimeout(r, 1100));

    const resolved = [];
    for (const s of stops) {
      let lat = s.client?.lat ?? s.lat ?? null, lng = s.client?.lng ?? s.lng ?? null;
      if (lat == null && s.address.trim()) {
        const g = await geocode(s.address);
        if (g) { lat = g.lat; lng = g.lng; }
        await new Promise((r) => setTimeout(r, 1100));
      }
      resolved.push({ ...s, lat, lng });
    }
    const kx = Math.cos((depot.lat * Math.PI) / 180);
    const d2 = (a, b) => { const dy = a.lat - b.lat, dx = (a.lng - b.lng) * kx; return dy * dy + dx * dx; };
    const dist = (a, b) => Math.sqrt(d2(a, b));
    const noGeo = resolved.filter((s) => s.lat == null);

    // nearest-neighbor starting from the shop
    let route = []; let cur = depot;
    const pool = resolved.filter((s) => s.lat != null);
    while (pool.length) {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < pool.length; i++) { const d = d2(cur, pool[i]); if (d < bd) { bd = d; bi = i; } }
      cur = pool.splice(bi, 1)[0]; route.push(cur);
    }

    // 2-opt: shorten the round trip (shop -> ... -> shop)
    const tourLen = (r) => {
      if (!r.length) return 0;
      let total = dist(depot, r[0]);
      for (let i = 0; i < r.length - 1; i++) total += dist(r[i], r[i + 1]);
      return total + dist(r[r.length - 1], depot);
    };
    let bestLen = tourLen(route), improved = true, guard = 0;
    while (improved && guard < 60) {
      improved = false; guard++;
      for (let i = 0; i < route.length - 1; i++) {
        for (let k = i + 1; k < route.length; k++) {
          const cand = [...route.slice(0, i), ...route.slice(i, k + 1).reverse(), ...route.slice(k + 1)];
          const len = tourLen(cand);
          if (len + 1e-9 < bestLen) { route = cand; bestLen = len; improved = true; }
        }
      }
    }

    setStops([...route, ...noGeo]);
    setOptimizing(false);
    setMsg(`Optimized as a loop from the shop.${noGeo.length ? ` ${noGeo.length} stop(s) had no location and were left at the end.` : ""}`);
  };

  const save = async () => {
    if (!crew) { setMsg("Pick a crew."); return; }
    const valid = stops.filter((s) => s.address.trim());
    if (valid.length === 0) { setMsg("Add at least one stop with an address."); return; }
    for (const s of valid) {
      if (s.recurring) {
        if (!s.weekdays || s.weekdays.length === 0) { setMsg("Pick at least one day for each recurring stop."); return; }
        if (!s.recurUntil || s.recurUntil < date) { setMsg("Set a season end date (on or after the start) for each recurring stop."); return; }
      }
    }
    setBusy(true); setMsg("");

    // 1. save/refresh the crew roster
    const { error: crewErr } = await supabase.from("crews")
      .update({ truck_number: truck || null, members, updated_at: new Date().toISOString() })
      .eq("crew_number", crew);
    if (crewErr) { setBusy(false); setMsg(`Couldn't save the crew roster: ${crewErr.message}`); return; }

    // 2. one-off stops -> a single job; recurring stops -> a job_series + generated visits
    let stopIndex = 0;
    let total = 0;
    for (const s of valid) {
      let lat = s.client?.lat ?? s.lat ?? null, lng = s.client?.lng ?? s.lng ?? null;
      if (lat == null) { const g = await geocode(s.address); if (g) { lat = g.lat; lng = g.lng; } }

      const content = {
        crew_number: Number(crew),
        client_id: s.client?.id || null,
        address: s.address,
        lat, lng,
        service_type: s.service_type || null,
        notes: s.notes || null,
        truck_number: truck || null,
        members,
      };

      let dates = [date];
      let seriesId = null;
      if (s.recurring) {
        const { data: ser, error: serErr } = await supabase.from("job_series")
          .insert({ ...content, weekdays: s.weekdays, frequency: s.frequency, start_date: date, end_date: s.recurUntil, active: true })
          .select().single();
        if (serErr) { setBusy(false); setMsg(`Couldn't save the recurring service: ${serErr.message}`); return; }
        seriesId = ser.id;
        dates = seriesDates(s.weekdays, s.frequency, date, s.recurUntil);
      }

      for (const d of dates) {
        const row = { ...content, date: d, status: "scheduled", sort_order: stopIndex };
        if (seriesId) row.series_id = seriesId;
        const { error } = await supabase.from("jobs").insert(row);
        if (error) { setBusy(false); setMsg(`Couldn't save the schedule: ${error.message}`); return; }
        total++;
      }
      stopIndex++;
    }
    setBusy(false);
    const anyRecurring = valid.some((s) => s.recurring);
    onDone?.(anyRecurring
      ? `Scheduled ${total} visit${total > 1 ? "s" : ""} for Crew ${crew} (${valid.length} stop${valid.length > 1 ? "s" : ""}, some recurring).`
      : `Scheduled ${valid.length} stop${valid.length > 1 ? "s" : ""} for Crew ${crew} on ${prettyDate(date)}.`);
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
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="x-btn" title="Move up" disabled={i === 0}
                    style={{ opacity: i === 0 ? 0.3 : 1 }} onClick={() => moveStop(s.key, -1)}>▲</button>
                  <button className="x-btn" title="Move down" disabled={i === stops.length - 1}
                    style={{ opacity: i === stops.length - 1 ? 0.3 : 1 }} onClick={() => moveStop(s.key, 1)}>▼</button>
                  <button className="x-btn" title="Remove" onClick={() => rmStop(s.key)}>✕</button>
                </div>
              </div>
              <span className="label">Address</span>
              <div style={{ marginBottom: 9 }}>
                <AddressSearch clients={clients.filter((c) => !c.archived)} value={s.search}
                  onChangeText={(v) => setStop(s.key, { search: v, address: v, client: null })}
                  onPick={(c) => setStop(s.key, { client: c, address: c.address || c.name, search: `${c.name} — ${c.address || ""}` })} />
              </div>
              <span className="label">What needs to be done</span>
              <input className="input" style={{ marginBottom: 9 }} placeholder="e.g. Mow & trim, mulch beds…"
                value={s.service_type} onChange={(e) => setStop(s.key, { service_type: e.target.value })} />
              <span className="label">Notes for crew</span>
              <textarea className="input" style={{ height: 56, fontSize: 14 }} placeholder="Gate code, dog on site, skip back lawn…"
                value={s.notes} onChange={(e) => setStop(s.key, { notes: e.target.value })} />

              <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 12 }}>
                <input type="checkbox" id={`rec-${s.key}`} checked={s.recurring}
                  onChange={(e) => {
                    const on = e.target.checked;
                    const startDow = new Date(date + "T12:00:00").getDay();
                    setStop(s.key, { recurring: on, weekdays: on && !s.weekdays.length ? [startDow] : s.weekdays });
                  }}
                  style={{ width: 17, height: 17, accentColor: "var(--lime)", cursor: "pointer" }} />
                <label htmlFor={`rec-${s.key}`} className="hd-cond"
                  style={{ fontSize: 14, color: "var(--cream)", letterSpacing: 1, cursor: "pointer" }}>
                  Recurring service
                </label>
              </div>
              {s.recurring && (
                <div style={{ marginTop: 10 }}>
                  <span className="label">Repeats on</span>
                  <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
                    {WD.map(([lbl, n]) => {
                      const on = s.weekdays.includes(n);
                      return (
                        <button key={n} onClick={() => setStop(s.key, { weekdays: on ? s.weekdays.filter((x) => x !== n) : [...s.weekdays, n] })}
                          style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: "1.5px solid var(--moss)", cursor: "pointer",
                            fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: .5,
                            background: on ? "var(--lime)" : "var(--bark2)", color: on ? "var(--earth)" : "var(--stone)" }}>
                          {lbl}
                        </button>
                      );
                    })}
                  </div>
                  <span className="label">Frequency</span>
                  <div className="seg" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    {[["weekly", "Weekly"], ["biweekly", "Every other week"]].map(([v, lbl]) => (
                      <button key={v} className={s.frequency === v ? "on" : ""} onClick={() => setStop(s.key, { frequency: v })}>{lbl}</button>
                    ))}
                  </div>
                  <span className="label">Season — start to end</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    <input className="input" type="date" min={date} value={s.recurUntil}
                      onChange={(e) => setStop(s.key, { recurUntil: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={addStop} style={{ marginBottom: 10 }}>
            <Ic n="plus" size={15} style={{ marginRight: 6, verticalAlign: -2 }} />ADD STOP
          </button>
          {stops.length >= 2 && (
            <button className="btn btn-ghost btn-sm" onClick={optimizeRoute} disabled={optimizing} style={{ marginBottom: 16 }}>
              {optimizing
                ? <><span className="spinner" /> Optimizing…</>
                : <><Ic n="pin" size={15} style={{ marginRight: 6, verticalAlign: -2 }} />OPTIMIZE ROUTE</>}
            </button>
          )}

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
  const t = useT();
  const ready = useLeaflet();
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [shopPt, setShopPt] = useState([SHOP.lat, SHOP.lng]);

  useEffect(() => {
    let alive = true;
    geocode(SHOP.address).then((g) => { if (alive && g) setShopPt([g.lat, g.lng]); });
    return () => { alive = false; };
  }, []);

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
          <a href="https://maps.apple.com/?q=${encodeURIComponent(job.address || "")}" target="_blank" rel="noreferrer" style="font-size:12px;color:#2f6f4f;font-weight:700;display:inline-block;margin-top:5px;text-decoration:none;">→ Directions</a>
        </div>`
      );
      marker.addTo(layerRef.current);
    });

    // the shop / yard — fixed start & end of every route
    if (shopPt) {
      pts.push(shopPt);
      window.L.marker(shopPt, {
        icon: window.L.divIcon({
          className: "",
          html: `<div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;background:#1c2414;border:2px solid #6ab820;font-size:14px;">🏠</div>`,
          iconSize: [26, 26], iconAnchor: [13, 13],
        }),
      }).bindPopup(
        `<div style="font-family:'Barlow Condensed',sans-serif;min-width:150px;">
          <div style="font-weight:700;font-size:14px;color:#1c2414;">Shop / Yard</div>
          <div style="font-size:12px;color:#666;margin-top:2px;">${SHOP.address}</div>
          <div style="font-size:11px;margin-top:4px;color:#2f6f4f;font-weight:700;">Routes start &amp; end here</div>
        </div>`
      ).addTo(layerRef.current);
    }
    if (pts.length) { try { mapRef.current.fitBounds(pts, { padding: [40, 40], maxZoom: 14 }); } catch (e) {} }
  }, [jobs, shopPt]);

  return (
    <div style={{ position: "relative" }}>
      <div ref={elRef} style={{ height: 260, width: "100%", borderRadius: 11, overflow: "hidden", border: "1px solid var(--moss)" }} />
      {!ready && <div className="empty" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><span className="spinner" /></div>}
      <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
        {[["#e05540", t("statusScheduled")], ["#9b59b6", t("statusInProgress")], ["#22c55e", t("statusComplete")]].map(([c, l]) => (
          <span key={l} className="hd-cond" style={{ fontSize: 12, color: "var(--cream)", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: c, border: "1.5px solid #fff" }} />{l}
          </span>
        ))}
        <span className="hd-cond" style={{ fontSize: 12, color: "var(--cream)", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 13 }}>🏠</span>Shop / Yard
        </span>
      </div>
    </div>
  );
}

const MODAL_WRAP = { position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 600, display: "flex", alignItems: "flex-end", justifyContent: "center" };
const MODAL_CARD = { width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", margin: 0, padding: 18, borderRadius: "16px 16px 0 0" };

// Renders a bottom-sheet modal as a direct child of <body>, so it always
// anchors to the screen and is never trapped by an ancestor's transform/overflow.
function Modal({ onClose, children }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return createPortal(
    <div style={MODAL_WRAP} onClick={onClose}>
      <div className="card" style={MODAL_CARD} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}


// Single-visit editor: move the date, swap members, skip/un-skip, delete, view photos.
function VisitEditor({ job, onClose, onChanged, onEditSeries }) {
  const [employees, setEmployees] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateVal, setDateVal] = useState(job.date);
  const [members, setMembers] = useState(Array.isArray(job.members) ? job.members : []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const done = job.status === "completed" || job.status === "done_for_today";
  const skipped = job.status === "skipped";

  useEffect(() => {
    supabase.from("employees").select("*").eq("active", true).order("name").then(({ data }) => setEmployees(data || []));
    supabase.from("job_photos").select("*").eq("job_id", job.id).then(({ data }) => { setPhotos(data || []); setLoading(false); });
  }, [job.id]);

  const toggleMember = (name) => setMembers((m) => (m.includes(name) ? m.filter((x) => x !== name) : [...m, name]));
  const after = async (fn) => { setBusy(true); setMsg(""); const { error } = await fn(); setBusy(false); if (error) { setMsg(error.message); return; } onChanged?.(); onClose(); };
  const saveVisit = () => after(() => supabase.from("jobs").update({ date: dateVal, members }).eq("id", job.id));
  const setStatus = (status) => after(() => supabase.from("jobs").update({ status }).eq("id", job.id));
  const del = () => { if (window.confirm("Delete just this visit?")) after(() => supabase.from("jobs").delete().eq("id", job.id)); };
  const groups = [["before", "Before"], ["after", "After"], ["damage", "Existing damage"], ["other", "Other"]];

  return (
    <Modal onClose={onClose}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div className="hd-bebas" style={{ fontSize: 22, color: "var(--cream)", letterSpacing: 1, lineHeight: 1.1 }}>{job.client_name || job.address || "Visit"}</div>
          <button className="x-btn" onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: "var(--stone)", marginBottom: 4 }}>{job.address}</div>
        <div className="hd-cond" style={{ fontSize: 13, color: "var(--mgr-lt)", marginBottom: 10, letterSpacing: .5 }}>
          Crew {job.crew_number}{job.truck_number ? ` · Truck ${job.truck_number}` : ""}
          {job.series_id && <span style={{ color: "var(--lime)" }}> · ↻ Recurring</span>}
          {skipped && <span style={{ color: "var(--warn)" }}> · Skipped</span>}
        </div>

        {!done && (
          <>
            <span className="label">Visit date {job.series_id && "(moving affects only this visit)"}</span>
            <input className="input" type="date" value={dateVal} onChange={(e) => setDateVal(e.target.value)} style={{ marginBottom: 12 }} />
            <span className="label">Crew members on this visit</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
              {employees.map((e) => (
                <button key={e.id} className={"member-chip" + (members.includes(e.name) ? " on" : "")} onClick={() => toggleMember(e.name)}>{e.name}</button>
              ))}
            </div>
            {msg && <div className="error" style={{ marginBottom: 10 }}>{msg}</div>}
            <button className="btn btn-mgr btn-sm" disabled={busy} onClick={saveVisit} style={{ marginBottom: 10 }}>Save this visit</button>
            <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
              {skipped
                ? <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setStatus("scheduled")}>Un-skip</button>
                : <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setStatus("skipped")} style={{ color: "var(--warn)", borderColor: "var(--warn)" }}>Skip this visit</button>}
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={del} style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>Delete</button>
            </div>
            {job.series_id && (
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => onEditSeries(job.series_id, job.date)}>
                <Ic n="calendar" size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Edit the whole recurring series…
              </button>
            )}
          </>
        )}

        {(job.started_at || job.elapsed_seconds > 0) && (
          <div className="hd-cond" style={{ fontSize: 13, color: "var(--stone)", margin: "12px 0" }}>
            {job.started_at && <>Started {fmtTime(job.started_at)}</>}
            {job.completed_at && <> · Finished {fmtTime(job.completed_at)}</>}
            {job.elapsed_seconds > 0 && <> · {fmtDuration(job.elapsed_seconds)}</>}
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--moss)", marginTop: 12, paddingTop: 12 }}>
          {loading ? <div className="empty"><span className="spinner" /></div> : photos.length === 0 ? (
            <div className="hd-cond" style={{ fontSize: 13, color: "var(--stone)" }}>No photos uploaded for this visit yet.</div>
          ) : groups.map(([k, label]) => {
            const ph = photos.filter((p) => p.kind === k);
            if (!ph.length) return null;
            return (
              <div key={k} style={{ marginBottom: 12 }}>
                <span className="label">{label}</span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                  {ph.map((p) => (<a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="photo-thumb" style={{ aspectRatio: "1" }}><img src={p.url} alt={k} /></a>))}
                </div>
              </div>
            );
          })}
        </div>
    </Modal>
  );
}

// Whole-series editor: change crew/members/days/frequency/end, scoped to this+future or the entire series.
function SeriesEditor({ seriesId, fromDate, onClose, onChanged }) {
  const [series, setSeries] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [crewNo, setCrewNo] = useState("");
  const [truck, setTruck] = useState("");
  const [members, setMembers] = useState([]);
  const [svc, setSvc] = useState("");
  const [notes, setNotes] = useState("");
  const [weekdays, setWeekdays] = useState([]);
  const [frequency, setFrequency] = useState("weekly");
  const [endDate, setEndDate] = useState("");
  const [scope, setScope] = useState("future"); // future | all
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.from("employees").select("*").eq("active", true).order("name").then(({ data }) => setEmployees(data || []));
    supabase.from("job_series").select("*").eq("id", seriesId).single().then(({ data }) => {
      if (!data) return;
      setSeries(data);
      setCrewNo(String(data.crew_number || ""));
      setTruck(data.truck_number || "");
      setMembers(Array.isArray(data.members) ? data.members : []);
      setSvc(data.service_type || "");
      setNotes(data.notes || "");
      setWeekdays(Array.isArray(data.weekdays) ? data.weekdays : []);
      setFrequency(data.frequency || "weekly");
      setEndDate(data.end_date || "");
    });
  }, [seriesId]);

  const toggleMember = (name) => setMembers((m) => (m.includes(name) ? m.filter((x) => x !== name) : [...m, name]));
  const toggleDay = (n) => setWeekdays((w) => (w.includes(n) ? w.filter((x) => x !== n) : [...w, n]));

  const apply = async () => {
    if (!series) return;
    if (!weekdays.length) { setMsg("Pick at least one day."); return; }
    if (!endDate || endDate < series.start_date) { setMsg("End date must be on/after the season start."); return; }
    setBusy(true); setMsg("");
    const scopeStart = scope === "all" ? series.start_date : fromDate;
    const content = { crew_number: Number(crewNo), truck_number: truck || null, members, service_type: svc || null, notes: notes || null };

    // 1. update the series record
    const { error: serErr } = await supabase.from("job_series")
      .update({ ...content, weekdays, frequency, end_date: endDate }).eq("id", seriesId);
    if (serErr) { setBusy(false); setMsg(serErr.message); return; }

    const patternChanged = frequency !== series.frequency || endDate !== series.end_date ||
      JSON.stringify([...weekdays].sort()) !== JSON.stringify([...(series.weekdays || [])].sort());

    if (patternChanged) {
      // wipe upcoming non-completed visits in scope and regenerate from the new pattern
      const { error: delErr } = await supabase.from("jobs").delete()
        .eq("series_id", seriesId).in("status", ["scheduled", "skipped"]).gte("date", scopeStart);
      if (delErr) { setBusy(false); setMsg(delErr.message); return; }
      const dates = seriesDates(weekdays, frequency, series.start_date, endDate).filter((d) => d >= scopeStart);
      for (const d of dates) {
        const { error } = await supabase.from("jobs").insert({
          ...content, client_id: series.client_id, address: series.address, lat: series.lat, lng: series.lng,
          date: d, status: "scheduled", sort_order: 0, series_id: seriesId,
        });
        if (error) { setBusy(false); setMsg(error.message); return; }
      }
    } else {
      // content-only change: update upcoming visits, preserving any moved/skipped exceptions' dates
      const { error } = await supabase.from("jobs").update(content)
        .eq("series_id", seriesId).in("status", ["scheduled", "skipped"]).gte("date", scopeStart);
      if (error) { setBusy(false); setMsg(error.message); return; }
    }
    setBusy(false); onChanged?.(); onClose();
  };

  const del = async () => {
    if (!series) return;
    const scopeStart = scope === "all" ? series.start_date : fromDate;
    if (!window.confirm(scope === "all" ? "Delete the entire recurring series (upcoming visits)?" : "Delete this and all upcoming visits in the series?")) return;
    setBusy(true);
    await supabase.from("jobs").delete().eq("series_id", seriesId).in("status", ["scheduled", "skipped"]).gte("date", scopeStart);
    if (scope === "all") await supabase.from("job_series").update({ active: false }).eq("id", seriesId);
    setBusy(false); onChanged?.(); onClose();
  };

  return (
    <Modal onClose={onClose}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="hd-bebas" style={{ fontSize: 20, color: "var(--lime)", letterSpacing: 1 }}>↻ RECURRING SERIES</div>
          <button className="x-btn" onClick={onClose}>✕</button>
        </div>
        {!series ? <div className="empty"><span className="spinner" /></div> : (
          <>
            <div style={{ fontSize: 13, color: "var(--stone)", marginBottom: 12 }}>{series.address}</div>

            <span className="label">Apply changes to</span>
            <div className="seg" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button className={scope === "future" ? "on" : ""} onClick={() => setScope("future")}>This &amp; upcoming</button>
              <button className={scope === "all" ? "on" : ""} onClick={() => setScope("all")}>Entire series</button>
            </div>

            <span className="label">Crew</span>
            <div style={{ marginBottom: 10 }}>
              <Dropdown value={crewNo} placeholder="Crew #" options={ALL_CREWS.map((n) => ({ value: n, label: `Crew ${n}` }))} onChange={(v) => setCrewNo(String(v))} />
            </div>
            <span className="label">Truck #</span>
            <input className="input" style={{ marginBottom: 10 }} value={truck} onChange={(e) => setTruck(e.target.value)} />
            <span className="label">Crew members</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
              {employees.map((e) => (
                <button key={e.id} className={"member-chip" + (members.includes(e.name) ? " on" : "")} onClick={() => toggleMember(e.name)}>{e.name}</button>
              ))}
            </div>
            <span className="label">What needs to be done</span>
            <input className="input" style={{ marginBottom: 10 }} value={svc} onChange={(e) => setSvc(e.target.value)} />
            <span className="label">Notes for crew</span>
            <textarea className="input" style={{ height: 54, fontSize: 14, marginBottom: 12 }} value={notes} onChange={(e) => setNotes(e.target.value)} />

            <span className="label">Repeats on</span>
            <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
              {WD.map(([lbl, n]) => {
                const on = weekdays.includes(n);
                return (
                  <button key={n} onClick={() => toggleDay(n)}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: "1.5px solid var(--moss)", cursor: "pointer",
                      fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700,
                      background: on ? "var(--lime)" : "var(--bark2)", color: on ? "var(--earth)" : "var(--stone)" }}>{lbl}</button>
                );
              })}
            </div>
            <span className="label">Frequency</span>
            <div className="seg" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {[["weekly", "Weekly"], ["biweekly", "Every other week"]].map(([v, lbl]) => (
                <button key={v} className={frequency === v ? "on" : ""} onClick={() => setFrequency(v)}>{lbl}</button>
              ))}
            </div>
            <span className="label">Season end</span>
            <input className="input" type="date" value={endDate} min={series.start_date} onChange={(e) => setEndDate(e.target.value)} style={{ marginBottom: 12 }} />

            <div className="hd-cond" style={{ fontSize: 12, color: "var(--moss)", marginBottom: 10 }}>
              Changing days, frequency, or end date rebuilds the upcoming visits in scope (moved/skipped one-offs in that range will reset).
            </div>
            {msg && <div className="error" style={{ marginBottom: 10 }}>{msg}</div>}
            <button className="btn btn-mgr btn-sm" disabled={busy} onClick={apply} style={{ marginBottom: 8 }}>{busy ? "Saving…" : "Apply changes"}</button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={del} style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>Delete {scope === "all" ? "entire series" : "this & upcoming"}</button>
          </>
        )}
    </Modal>
  );
}

// Weather-day / bulk reschedule. Move selected jobs to another day (with a
// live look at what that day already holds), reassign to another crew, or
// bump a day — and optionally everything after it — forward N days.
function RescheduleTool({ initialDate, onClose, onChanged }) {
  const [mode, setMode] = useState("move"); // move | bump
  const [srcDate, setSrcDate] = useState(initialDate);
  const [srcCrew, setSrcCrew] = useState("");        // "" = all crews
  const [srcJobs, setSrcJobs] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loadingSrc, setLoadingSrc] = useState(true);

  const [tgtDate, setTgtDate] = useState(addDays(initialDate, 1));
  const [tgtCrew, setTgtCrew] = useState("");        // "" = keep same crew
  const [placement, setPlacement] = useState("after");
  const [tgtJobs, setTgtJobs] = useState([]);

  const [bumpDays, setBumpDays] = useState(1);
  const [bumpFollowing, setBumpFollowing] = useState(false);
  const [bumpRows, setBumpRows] = useState([]);

  const [crews, setCrews] = useState([]);
  const [names, setNames] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.from("crews").select("*").then(({ data }) => setCrews(data || []));
    supabase.from("clients").select("id,name").then(({ data }) => { const m = {}; (data || []).forEach((c) => (m[c.id] = c.name)); setNames(m); });
  }, []);

  const loadSrc = useCallback(async () => {
    setLoadingSrc(true);
    const { data } = await supabase.from("jobs").select("*").eq("date", srcDate)
      .in("status", ["scheduled", "in_progress"]).order("crew_number").order("sort_order");
    let rows = data || [];
    if (srcCrew) rows = rows.filter((r) => r.crew_number === Number(srcCrew));
    setSrcJobs(rows);
    setSelected(new Set(rows.map((r) => r.id)));
    setLoadingSrc(false);
  }, [srcDate, srcCrew]);
  useEffect(() => { loadSrc(); }, [loadSrc]);

  useEffect(() => {
    if (mode !== "move") return;
    supabase.from("jobs").select("id,crew_number,status").eq("date", tgtDate)
      .in("status", ["scheduled", "in_progress", "completed", "done_for_today"])
      .then(({ data }) => setTgtJobs(data || []));
  }, [tgtDate, mode, busy]);

  useEffect(() => {
    if (mode !== "bump") return;
    let q = supabase.from("jobs").select("id,crew_number,date,status").in("status", ["scheduled", "in_progress"]);
    q = bumpFollowing ? q.gte("date", srcDate) : q.eq("date", srcDate);
    q.then(({ data }) => { let rows = data || []; if (srcCrew) rows = rows.filter((r) => r.crew_number === Number(srcCrew)); setBumpRows(rows); });
  }, [mode, srcDate, srcCrew, bumpFollowing, busy]);

  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const movingJobs = srcJobs.filter((j) => selected.has(j.id));

  // destination preview (move mode)
  const existingByCrew = {}; tgtJobs.forEach((j) => (existingByCrew[j.crew_number] = (existingByCrew[j.crew_number] || 0) + 1));
  const movingByCrew = {}; movingJobs.forEach((j) => { const c = tgtCrew ? Number(tgtCrew) : j.crew_number; movingByCrew[c] = (movingByCrew[c] || 0) + 1; });
  const previewCrews = [...new Set([...Object.keys(existingByCrew), ...Object.keys(movingByCrew)].map(Number))].sort((a, b) => a - b);

  const doMove = async () => {
    if (!movingJobs.length) { setMsg("Pick at least one job to move."); return; }
    if (tgtDate === srcDate && !tgtCrew) { setMsg("Choose a different day or crew to move to."); return; }
    setBusy(true); setMsg("");
    const offset = placement === "before" ? -1000 : 1000;
    const reassign = tgtCrew ? Number(tgtCrew) : null;
    const crewRow = reassign ? crews.find((c) => c.crew_number === reassign) : null;
    const results = await Promise.all(movingJobs.map((j, i) => {
      const upd = { date: tgtDate, status: "scheduled", started_at: null, completed_at: null, elapsed_seconds: 0, sort_order: offset + i };
      if (reassign) { upd.crew_number = reassign; if (crewRow) { upd.members = crewRow.members || []; upd.truck_number = crewRow.truck_number || null; } }
      return supabase.from("jobs").update(upd).eq("id", j.id);
    }));
    setBusy(false);
    const err = results.find((r) => r.error);
    if (err) { setMsg(err.error.message); return; }
    onChanged?.(); onClose();
  };

  const doBump = async () => {
    if (!bumpRows.length) { setMsg("Nothing to bump in that range."); return; }
    setBusy(true); setMsg("");
    let failed = null;
    for (let i = 0; i < bumpRows.length && !failed; i += 20) {
      const chunk = bumpRows.slice(i, i + 20);
      const results = await Promise.all(chunk.map((j) =>
        supabase.from("jobs").update({ date: addDays(j.date, Number(bumpDays)), status: "scheduled", started_at: null, completed_at: null, elapsed_seconds: 0 }).eq("id", j.id)
      ));
      failed = results.find((r) => r.error);
    }
    setBusy(false);
    if (failed) { setMsg(failed.error.message); return; }
    onChanged?.(); onClose();
  };

  const crewOpts = [{ value: "", label: "Keep same crew" }, ...ALL_CREWS.map((n) => ({ value: n, label: `Crew ${n}` }))];
  const srcCrewOpts = [{ value: "", label: "All crews" }, ...ALL_CREWS.map((n) => ({ value: n, label: `Crew ${n}` }))];

  return (
    <Modal onClose={onClose}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="hd-bebas" style={{ fontSize: 20, color: "var(--mgr-lt)", letterSpacing: 1 }}>RESCHEDULE / WEATHER DAY</div>
          <button className="x-btn" onClick={onClose}>✕</button>
        </div>

        <div className="seg" style={{ display: "flex", gap: 6, margin: "12px 0 14px" }}>
          <button className={mode === "move" ? "on" : ""} onClick={() => setMode("move")}>Move jobs</button>
          <button className={mode === "bump" ? "on" : ""} onClick={() => setMode("bump")}>Bump forward</button>
        </div>

        <span className="label">From day</span>
        <input className="input" type="date" value={srcDate} onChange={(e) => setSrcDate(e.target.value)} style={{ marginBottom: 10 }} />
        <span className="label">Crew</span>
        <div style={{ marginBottom: 14 }}>
          <Dropdown value={srcCrew} placeholder="All crews" options={srcCrewOpts} onChange={(v) => setSrcCrew(v === "" ? "" : String(v))} />
        </div>

        {mode === "move" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="label">Jobs to move ({movingJobs.length}/{srcJobs.length})</span>
              <span className="hd-cond" style={{ fontSize: 12, color: "var(--mgr-lt)", cursor: "pointer" }}
                onClick={() => setSelected(selected.size === srcJobs.length ? new Set() : new Set(srcJobs.map((j) => j.id)))}>
                {selected.size === srcJobs.length ? "Clear all" : "Select all"}
              </span>
            </div>
            {loadingSrc ? <div className="empty"><span className="spinner" /></div> : srcJobs.length === 0 ? (
              <div className="hd-cond" style={{ fontSize: 13, color: "var(--stone)", padding: "8px 0 14px" }}>No unfinished jobs on {prettyDate(srcDate)}{srcCrew ? ` for Crew ${srcCrew}` : ""}.</div>
            ) : (
              <div style={{ maxHeight: 200, overflowY: "auto", margin: "4px 0 14px", border: "1px solid var(--moss)", borderRadius: 10 }}>
                {srcJobs.map((j) => (
                  <div key={j.id} onClick={() => toggle(j.id)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", borderBottom: "1px solid var(--bark2)", cursor: "pointer" }}>
                    <input type="checkbox" readOnly checked={selected.has(j.id)} style={{ width: 16, height: 16, accentColor: "var(--lime)" }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="hd-cond" style={{ fontSize: 14, color: "var(--cream)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{names[j.client_id] || j.address}</div>
                      <div className="hd-cond" style={{ fontSize: 11, color: "var(--stone)" }}>Crew {j.crew_number}{j.status === "in_progress" ? " · in progress" : ""}{j.series_id ? " · ↻" : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <span className="label">Move to day</span>
            <input className="input" type="date" value={tgtDate} onChange={(e) => setTgtDate(e.target.value)} style={{ marginBottom: 10 }} />
            <span className="label">Assign to</span>
            <div style={{ marginBottom: 10 }}>
              <Dropdown value={tgtCrew} placeholder="Keep same crew" options={crewOpts} onChange={(v) => setTgtCrew(v === "" ? "" : String(v))} />
            </div>
            <span className="label">Place them</span>
            <div className="seg" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button className={placement === "before" ? "on" : ""} onClick={() => setPlacement("before")}>Before that day's jobs</button>
              <button className={placement === "after" ? "on" : ""} onClick={() => setPlacement("after")}>After</button>
            </div>

            {movingJobs.length > 0 && (
              <div className="card" style={{ padding: "11px 13px", margin: "0 0 14px", background: "var(--bark2)" }}>
                <div className="hd-cond" style={{ fontSize: 12, color: "var(--mgr-lt)", letterSpacing: .5, marginBottom: 6 }}>
                  {prettyDate(tgtDate)} after this move:
                </div>
                {previewCrews.length === 0 ? <div className="hd-cond" style={{ fontSize: 13, color: "var(--stone)" }}>Empty day.</div> : previewCrews.map((c) => {
                  const ex = existingByCrew[c] || 0, mv = movingByCrew[c] || 0;
                  return (
                    <div key={c} className="hd-cond" style={{ fontSize: 13, color: "var(--cream)", display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                      <span>Crew {c}</span>
                      <span style={{ color: "var(--stone)" }}>{ex} here {mv ? <span style={{ color: "var(--lime)" }}>+ {mv} moving = {ex + mv}</span> : "(unchanged)"}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {msg && <div className="error" style={{ marginBottom: 10 }}>{msg}</div>}
            <button className="btn btn-mgr btn-sm" disabled={busy} onClick={doMove}>
              {busy ? "Moving…" : `Move ${movingJobs.length} job${movingJobs.length === 1 ? "" : "s"} to ${prettyDate(tgtDate)}`}
            </button>
            <div className="hd-cond" style={{ fontSize: 11, color: "var(--moss)", marginTop: 8 }}>
              Moved jobs reset to "scheduled" (timers cleared). Completed work on either day is left alone.
            </div>
          </>
        ) : (
          <>
            <label style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={bumpFollowing} onChange={(e) => setBumpFollowing(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "var(--lime)" }} />
              <span className="hd-cond" style={{ fontSize: 14, color: "var(--cream)", letterSpacing: .5 }}>Also slide every day after this one</span>
            </label>
            <span className="label">Shift forward by</span>
            <div className="seg" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[1, 2, 3, 7].map((n) => (
                <button key={n} className={Number(bumpDays) === n ? "on" : ""} onClick={() => setBumpDays(n)}>{n === 7 ? "1 week" : `${n} day${n > 1 ? "s" : ""}`}</button>
              ))}
            </div>
            <div className="card" style={{ padding: "11px 13px", margin: "0 0 14px", background: "var(--bark2)" }}>
              <div className="hd-cond" style={{ fontSize: 13, color: "var(--cream)" }}>
                {bumpFollowing
                  ? `Everything from ${prettyDate(srcDate)} onward${srcCrew ? ` (Crew ${srcCrew})` : ""} slides forward ${bumpDays === 7 ? "1 week" : `${bumpDays} day${bumpDays > 1 ? "s" : ""}`}.`
                  : `${prettyDate(srcDate)}'s unfinished jobs${srcCrew ? ` (Crew ${srcCrew})` : ""} move forward ${bumpDays === 7 ? "1 week" : `${bumpDays} day${bumpDays > 1 ? "s" : ""}`}.`}
              </div>
              <div className="hd-bebas" style={{ fontSize: 16, color: "var(--lime)", letterSpacing: 1, marginTop: 6 }}>{bumpRows.length} visit{bumpRows.length === 1 ? "" : "s"} affected</div>
            </div>
            {msg && <div className="error" style={{ marginBottom: 10 }}>{msg}</div>}
            <button className="btn btn-mgr btn-sm" disabled={busy || !bumpRows.length} onClick={doBump}>
              {busy ? "Bumping…" : `Bump ${bumpRows.length} visit${bumpRows.length === 1 ? "" : "s"} forward`}
            </button>
            <div className="hd-cond" style={{ fontSize: 11, color: "var(--moss)", marginTop: 8 }}>
              Sliding the whole route keeps relative order and avoids piling onto an already-full day. Completed visits stay put.
            </div>
          </>
        )}
    </Modal>
  );
}

function ManagerJobs() {
  const [viewMode, setViewMode] = useState("day"); // day | week | month
  const [date, setDate] = useState(todayStr());
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [crewFilter, setCrewFilter] = useState("");
  const [editJob, setEditJob] = useState(null);
  const [editSeries, setEditSeries] = useState(null); // { seriesId, fromDate }
  const [resched, setResched] = useState(false);
  const [lastLoad, setLastLoad] = useState(Date.now());

  const range = (() => {
    if (viewMode === "week") { const a = weekAnchor(date); return [a, addDays(a, 6)]; }
    if (viewMode === "month") {
      const d = new Date(date + "T12:00:00");
      const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const last = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      return [first, last];
    }
    return [date, date];
  })();

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: jobData }, { data: clientData }] = await Promise.all([
      supabase.from("jobs").select("*").gte("date", range[0]).lte("date", range[1]).order("date").order("crew_number").order("sort_order"),
      supabase.from("clients").select("id,name"),
    ]);
    const cmap = {}; (clientData || []).forEach((c) => (cmap[c.id] = c.name));
    setJobs((jobData || []).map((j) => ({ ...j, client_name: cmap[j.client_id] || null })));
    setLastLoad(Date.now());
    setLoading(false);
  }, [range[0], range[1]]);

  // Load once when the date range changes — no background auto-refresh, so the
  // view never changes under you while you're editing. Use the Refresh button.
  useEffect(() => { load(); }, [load]);
  // Live timers only tick while no editor is open (keeps the screen still mid-edit).
  useEffect(() => {
    if (editJob || editSeries || resched) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [editJob, editSeries, resched]);

  const del = async (job) => { if (!window.confirm("Remove this visit?")) return; await supabase.from("jobs").delete().eq("id", job.id); load(); };
  const liveSecs = (job) => (job.elapsed_seconds || 0) +
    (job.status === "in_progress" && job.started_at ? Math.max(0, Math.floor((now - new Date(job.started_at).getTime()) / 1000)) : 0);

  const dayJobs = jobs.filter((j) => j.date === date);
  const crewNums = [...new Set(dayJobs.map((j) => j.crew_number))].sort((a, b) => a - b);
  const crewSummary = crewNums.map((n) => {
    const cj = dayJobs.filter((j) => j.crew_number === n && j.status !== "skipped");
    const doneN = cj.filter((j) => j.status === "completed" || j.status === "done_for_today").length;
    const inprog = cj.find((j) => j.status === "in_progress");
    const lastTs = cj.reduce((mx, j) => { const t = j.completed_at || j.started_at; return t && (!mx || t > mx) ? t : mx; }, null);
    let statusText;
    if (inprog) statusText = `● At ${inprog.client_name || inprog.address || "a stop"}`;
    else if (cj.length && doneN === cj.length) statusText = "Finished for the day";
    else if (doneN > 0) statusText = "Between stops";
    else statusText = "Not started";
    return { n, total: cj.length, doneN, inprog, lastTs, statusText };
  });

  const dayFiltered = (crewFilter ? dayJobs.filter((j) => j.crew_number === crewFilter) : dayJobs);
  const byStatus = (s) => dayFiltered.filter((j) => s.includes(j.status));
  const progress = byStatus(["in_progress"]);
  const scheduled = byStatus(["scheduled"]);
  const completed = byStatus(["completed", "done_for_today"]);
  const skippedJobs = byStatus(["skipped"]);

  const Row = ({ job }) => (
    <div className="card" style={{ padding: "11px 13px", borderLeft: `4px solid ${
      job.status === "skipped" ? "var(--warn)" :
      job.status === "in_progress" ? "var(--purple)" :
      job.status === "completed" || job.status === "done_for_today" ? "var(--leaf)" : "var(--danger)"}`, opacity: job.status === "skipped" ? 0.7 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1, cursor: "pointer" }} onClick={() => setEditJob(job)}>
          <div className="hd-bebas" style={{ fontSize: 18, color: "var(--cream)", letterSpacing: 1, lineHeight: 1.1 }}>
            {job.client_name || job.address || "Job"}
          </div>
          <div style={{ fontSize: 12, color: "var(--stone)" }}>{job.address}</div>
          <div className="hd-cond" style={{ fontSize: 12, color: "var(--mgr-lt)", marginTop: 3, letterSpacing: .5 }}>
            Crew {job.crew_number}{job.truck_number ? ` · Truck ${job.truck_number}` : ""}
            {job.is_project && <span style={{ color: "var(--purple)" }}> · Project</span>}
            {job.series_id && <span style={{ color: "var(--lime)" }}> · ↻ Recurring</span>}
          </div>
          {job.service_type && <div style={{ fontSize: 12, color: "#92B4F4", marginTop: 2 }}>{job.service_type}</div>}
          {job.status === "in_progress" && job.started_at && (
            <div className="hd-cond" style={{ fontSize: 12, color: "var(--purple)", marginTop: 3 }}>
              <Ic n="clock" size={12} /> {fmtClock(liveSecs(job))} · started {fmtTime(job.started_at)}
            </div>
          )}
          {(job.status === "completed" || job.status === "done_for_today") && (
            <div className="hd-cond" style={{ fontSize: 12, color: "var(--stone)", marginTop: 3 }}>
              <Ic n="clock" size={12} /> {fmtDuration(job.elapsed_seconds || 0)}
              {job.started_at && job.completed_at ? ` · ${fmtTime(job.started_at)}–${fmtTime(job.completed_at)}` : ""}
            </div>
          )}
          <div className="hd-cond" style={{ fontSize: 11, color: "var(--moss)", marginTop: 3 }}>tap to edit / view photos →</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <StatusChip status={job.status} />
          <div style={{ marginTop: 8 }}>
            <button className="x-btn" title="Delete" style={{ background: "rgba(224,85,64,.25)", width: 30, height: 30 }}
              onClick={() => del(job)}><Ic n="trash" size={14} color="var(--danger)" /></button>
          </div>
        </div>
      </div>
    </div>
  );

  const reload = () => load();
  const shiftRange = (dir) => {
    if (viewMode === "week") setDate(addDays(date, dir * 7));
    else if (viewMode === "month") { const d = new Date(date + "T12:00:00"); d.setMonth(d.getMonth() + dir); setDate(d.toLocaleDateString("en-CA")); }
    else setDate(addDays(date, dir));
  };

  // ----- week view -----
  const WeekView = () => {
    const start = weekAnchor(date);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    return (
      <div style={{ marginTop: 14 }}>
        {days.map((d) => {
          const dj = (crewFilter ? jobs.filter((j) => j.crew_number === crewFilter) : jobs).filter((j) => j.date === d);
          const isToday = d === todayStr();
          return (
            <div key={d} className="card" style={{ padding: "10px 12px", border: isToday ? "1.5px solid var(--mgr-lt)" : undefined }}>
              <div className="hd-bebas" style={{ fontSize: 15, color: "var(--mgr-lt)", letterSpacing: 1, marginBottom: dj.length ? 8 : 0 }}>
                {prettyDate(d)}{isToday ? " · TODAY" : ""} {dj.length ? `· ${dj.length}` : "· —"}
              </div>
              {dj.map((j) => (
                <div key={j.id} onClick={() => setEditJob(j)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid var(--bark2)", cursor: "pointer" }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="hd-cond" style={{ fontSize: 14, color: "var(--cream)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.client_name || j.address}</div>
                    <div className="hd-cond" style={{ fontSize: 11, color: "var(--stone)" }}>Crew {j.crew_number}{j.series_id ? " · ↻" : ""}{j.status === "skipped" ? " · skipped" : ""}</div>
                  </div>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background:
                    j.status === "skipped" ? "var(--warn)" : j.status === "in_progress" ? "var(--purple)" :
                    (j.status === "completed" || j.status === "done_for_today") ? "var(--leaf)" : "var(--danger)" }} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  // ----- month view -----
  const MonthView = () => {
    const d = new Date(date + "T12:00:00");
    const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    const gridStart = weekAnchor(first);
    const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    const monthIdx = d.getMonth();
    const counts = {};
    (crewFilter ? jobs.filter((j) => j.crew_number === crewFilter) : jobs).forEach((j) => { counts[j.date] = (counts[j.date] || 0) + 1; });
    return (
      <div style={{ marginTop: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 4 }}>
          {WD.map(([l]) => <div key={l} className="hd-cond" style={{ textAlign: "center", fontSize: 11, color: "var(--stone)" }}>{l}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
          {cells.map((c) => {
            const inMonth = new Date(c + "T12:00:00").getMonth() === monthIdx;
            const n = counts[c] || 0;
            const isToday = c === todayStr();
            return (
              <div key={c} onClick={() => { setDate(c); setViewMode("day"); }}
                style={{ aspectRatio: "1", borderRadius: 7, padding: 4, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
                  background: isToday ? "var(--mgr)" : n ? "var(--bark2)" : "transparent", opacity: inMonth ? 1 : 0.35, border: "1px solid var(--moss)" }}>
                <span className="hd-cond" style={{ fontSize: 12, color: isToday ? "#fff" : "var(--cream)" }}>{new Date(c + "T12:00:00").getDate()}</span>
                {n > 0 && <span className="hd-bebas" style={{ fontSize: 15, color: isToday ? "#fff" : "var(--lime)", marginTop: "auto" }}>{n}</span>}
              </div>
            );
          })}
        </div>
        <div className="hd-cond" style={{ fontSize: 12, color: "var(--stone)", marginTop: 8, textAlign: "center" }}>Tap a day to open it</div>
      </div>
    );
  };

  return (
    <div style={{ animation: "fadeUp .25s ease both" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div className="section-hd" style={{ margin: 0 }}>Job Tracker</div>
        <button className="btn btn-ghost btn-sm" style={{ width: "auto", padding: "8px 14px" }} disabled={loading} onClick={() => load()}>
          {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <><Ic n="refresh" size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Refresh</>}
        </button>
      </div>
      <div className="hd-cond" style={{ fontSize: 11, color: "var(--moss)", marginBottom: 12 }}>
        Updated {timeAgo(lastLoad)} · this screen only refreshes when you tap Refresh
      </div>

      <div className="seg" style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["day", "Day"], ["week", "Week"], ["month", "Month"]].map(([v, l]) => (
          <button key={v} className={viewMode === v ? "on" : ""} onClick={() => setViewMode(v)}>{l}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" style={{ width: "auto", padding: "10px 13px" }} onClick={() => shiftRange(-1)}>‹</button>
        {viewMode === "day"
          ? <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ flex: 1 }} />
          : <div className="hd-bebas" style={{ flex: 1, textAlign: "center", fontSize: 17, color: "var(--cream)", letterSpacing: 1 }}>
              {viewMode === "month"
                ? new Date(date + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })
                : `Week of ${prettyDate(weekAnchor(date))}`}
            </div>}
        <button className="btn btn-ghost btn-sm" style={{ width: "auto", padding: "10px 13px" }} onClick={() => shiftRange(1)}>›</button>
        <button className="btn btn-ghost btn-sm" style={{ width: "auto", padding: "10px 12px" }} onClick={() => setDate(todayStr())}>Today</button>
      </div>

      <button className="btn btn-ghost btn-sm" onClick={() => setResched(true)} style={{ marginBottom: 14, borderColor: "var(--mgr)", color: "var(--mgr-lt)" }}>
        <Ic n="cal2" size={15} style={{ marginRight: 7, verticalAlign: -3 }} />Reschedule / weather day
      </button>

      {loading && <div className="empty"><span className="spinner" /></div>}

      {!loading && viewMode === "week" && <WeekView />}
      {!loading && viewMode === "month" && <MonthView />}

      {!loading && viewMode === "day" && (
        <>
          {crewSummary.length > 0 && (
            <>
              <div className="section-hd">Crews Today</div>
              {crewSummary.map((c) => (
                <div key={c.n} className="card" onClick={() => setCrewFilter(crewFilter === c.n ? "" : c.n)}
                  style={{ padding: "11px 13px", cursor: "pointer", border: crewFilter === c.n ? "1.5px solid var(--mgr-lt)" : undefined }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <span className="hd-bebas" style={{ fontSize: 17, color: "var(--cream)", letterSpacing: 1 }}>CREW {c.n}</span>
                    <span className="hd-cond" style={{ fontSize: 13, color: c.doneN === c.total ? "var(--leaf)" : "var(--mgr-lt)" }}>{c.doneN}/{c.total} done</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 4, background: "var(--bark)", overflow: "hidden", marginBottom: 6 }}>
                    <div style={{ height: "100%", width: `${c.total ? (c.doneN / c.total) * 100 : 0}%`, background: c.inprog ? "var(--purple)" : "var(--leaf)" }} />
                  </div>
                  <div className="hd-cond" style={{ fontSize: 12, color: c.inprog ? "var(--purple)" : "var(--stone)", letterSpacing: .3 }}>
                    {c.statusText}{c.lastTs ? ` · updated ${timeAgo(c.lastTs)}` : ""}
                  </div>
                </div>
              ))}
              {crewFilter && (
                <div className="hd-cond" style={{ fontSize: 13, color: "var(--mgr-lt)", margin: "6px 0 10px", display: "flex", justifyContent: "space-between" }}>
                  <span>Showing Crew {crewFilter} only</span>
                  <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => setCrewFilter("")}>Show all crews</span>
                </div>
              )}
            </>
          )}

          <div style={{ marginTop: 14 }}><JobsMap jobs={dayFiltered.filter((j) => j.status !== "skipped")} /></div>

          {dayFiltered.length === 0 ? (
            <div className="empty" style={{ paddingTop: 30 }}>
              <Ic n="list" size={36} color="var(--moss)" style={{ marginBottom: 8 }} />
              <div className="hd-cond">No jobs {crewFilter ? `for Crew ${crewFilter}` : `on ${prettyDate(date)}`}</div>
            </div>
          ) : (
            <div style={{ marginTop: 18 }}>
              {progress.length > 0 && <><div className="section-hd"><Ic n="clock" size={14} /> In Progress — {progress.length}</div>{progress.map((j) => <Row key={j.id} job={j} />)}</>}
              {scheduled.length > 0 && <><div className="section-hd" style={{ marginTop: 14 }}>Scheduled — {scheduled.length}</div>{scheduled.map((j) => <Row key={j.id} job={j} />)}</>}
              {completed.length > 0 && <><div className="section-hd" style={{ marginTop: 14 }}><Ic n="check" size={14} /> Completed — {completed.length}</div>{completed.map((j) => <Row key={j.id} job={j} />)}</>}
              {skippedJobs.length > 0 && <><div className="section-hd" style={{ marginTop: 14 }}>Skipped — {skippedJobs.length}</div>{skippedJobs.map((j) => <Row key={j.id} job={j} />)}</>}
            </div>
          )}
        </>
      )}

      {editJob && <VisitEditor job={editJob} onClose={() => setEditJob(null)} onChanged={reload}
        onEditSeries={(sid, fd) => { setEditJob(null); setEditSeries({ seriesId: sid, fromDate: fd }); }} />}
      {editSeries && <SeriesEditor seriesId={editSeries.seriesId} fromDate={editSeries.fromDate}
        onClose={() => setEditSeries(null)} onChanged={reload} />}
      {resched && <RescheduleTool initialDate={date} onClose={() => setResched(false)} onChanged={reload} />}
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
        <AddressSearch clients={clients.filter((c) => !c.archived)} value={f.search}
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

  const addEmp = async () => { if (!newName.trim()) return; const { error } = await supabase.from("employees").insert({ name: newName.trim() }); if (error) { window.alert(`Couldn't add employee: ${error.message}`); return; } setNewName(""); load(); };
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
function HoursTab() {
  const [from, setFrom] = useState(addDays(todayStr(), -6));
  const [to, setTo] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("jobs")
      .select("members,elapsed_seconds,date")
      .gte("date", from).lte("date", to);
    const agg = {}; let unassigned = 0;
    (data || []).forEach((j) => {
      const secs = j.elapsed_seconds || 0;
      if (!secs) return;
      const mem = Array.isArray(j.members) ? j.members : [];
      if (mem.length === 0) { unassigned += secs; return; }
      mem.forEach((name) => {
        if (!agg[name]) agg[name] = { name, secs: 0, jobs: 0 };
        agg[name].secs += secs; agg[name].jobs += 1;
      });
    });
    const list = Object.values(agg).sort((a, b) => b.secs - a.secs);
    if (unassigned > 0) list.push({ name: "(Unassigned crew)", secs: unassigned, jobs: 0, unassigned: true });
    setRows(list); setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const totalSecs = rows.reduce((a, r) => a + r.secs, 0);

  const exportCsv = () => {
    const out = [["Employee", "Hours (decimal)", "H:M", "Jobs"]];
    rows.forEach((r) => out.push([r.name, (r.secs / 3600).toFixed(2), fmtDuration(r.secs), r.unassigned ? "" : r.jobs]));
    out.push(["TOTAL", (totalSecs / 3600).toFixed(2), fmtDuration(totalSecs), ""]);
    const csv = out.map((row) => row.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `labor-hours_${from}_to_${to}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const quick = [
    ["This week", () => { const dow = new Date(todayStr() + "T12:00:00").getDay(); setFrom(addDays(todayStr(), -((dow + 6) % 7))); setTo(todayStr()); }],
    ["Last 7 days", () => { setFrom(addDays(todayStr(), -6)); setTo(todayStr()); }],
    ["Last 14", () => { setFrom(addDays(todayStr(), -13)); setTo(todayStr()); }],
  ];

  return (
    <div style={{ animation: "fadeUp .25s ease both" }}>
      <div className="section-hd">Labor Hours</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <span className="label">From</span>
          <input className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <span className="label">To</span>
          <input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {quick.map(([l, fn]) => (
          <button key={l} className="btn btn-ghost btn-sm" style={{ width: "auto", padding: "8px 12px" }} onClick={fn}>{l}</button>
        ))}
      </div>

      {loading ? <div className="empty"><span className="spinner" /></div> : rows.length === 0 ? (
        <div className="empty" style={{ paddingTop: 20 }}>
          <Ic n="clock" size={34} color="var(--moss)" style={{ marginBottom: 8 }} />
          <div className="hd-cond">No tracked hours in this range</div>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 14, marginBottom: 12, textAlign: "center" }}>
            <div className="timer-big" style={{ fontSize: 30 }}>{(totalSecs / 3600).toFixed(1)}h</div>
            <div className="hd-cond" style={{ fontSize: 12, color: "var(--stone)", letterSpacing: 1, textTransform: "uppercase" }}>Total labor hours</div>
          </div>
          {rows.map((r) => (
            <div key={r.name} className="card" style={{ padding: "11px 13px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="hd-bebas" style={{ fontSize: 17, color: r.unassigned ? "var(--stone)" : "var(--cream)", letterSpacing: 1 }}>{r.name}</div>
                {!r.unassigned && <div className="hd-cond" style={{ fontSize: 12, color: "var(--stone)" }}>{r.jobs} job{r.jobs !== 1 ? "s" : ""}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="hd-bebas" style={{ fontSize: 19, color: "var(--lime)", letterSpacing: 1 }}>{(r.secs / 3600).toFixed(2)}h</div>
                <div className="hd-cond" style={{ fontSize: 11, color: "var(--stone)" }}>{fmtDuration(r.secs)}</div>
              </div>
            </div>
          ))}
          <button className="btn btn-mgr" style={{ marginTop: 14 }} onClick={exportCsv}>
            <Ic n="list" size={15} style={{ marginRight: 6, verticalAlign: -2 }} />EXPORT CSV
          </button>
        </>
      )}
    </div>
  );
}

// Add or edit a client property. Geocodes the address on save so it shows on maps.
function PropertyEditor({ client, onClose, onSaved }) {
  const isNew = !client;
  const [name, setName] = useState(client?.name || "");
  const [address, setAddress] = useState(client?.address || "");
  const [contact, setContact] = useState(client?.contact_name || "");
  const [phone, setPhone] = useState(client?.contact_phone || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async () => {
    if (!name.trim()) { setMsg("Name is required."); return; }
    setBusy(true); setMsg("");
    const row = { name: name.trim(), address: address.trim() || null, contact_name: contact.trim() || null, contact_phone: phone.trim() || null };
    const addrChanged = isNew || address.trim() !== (client?.address || "");
    if (row.address && addrChanged) {
      setMsg("Looking up location…");
      const g = await geocode(row.address);
      if (g) { row.lat = g.lat; row.lng = g.lng; }
      setMsg("");
    }
    const resp = isNew
      ? await supabase.from("clients").insert(row).select().single()
      : await supabase.from("clients").update(row).eq("id", client.id).select().single();
    setBusy(false);
    if (resp.error) { setMsg(resp.error.message); return; }
    onSaved?.(); onClose();
  };

  const setArchived = async (val) => {
    setBusy(true); setMsg("");
    const { error } = await supabase.from("clients").update({ archived: val }).eq("id", client.id);
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    onSaved?.(); onClose();
  };

  return (
    <Modal onClose={onClose}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="hd-bebas" style={{ fontSize: 20, color: "var(--mgr-lt)", letterSpacing: 1 }}>{isNew ? "ADD PROPERTY" : "EDIT PROPERTY"}</div>
          <button className="x-btn" onClick={onClose}>✕</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <span className="label">Name / customer</span>
          <input className="input" style={{ marginBottom: 10 }} placeholder="e.g. Smith Residence" value={name} onChange={(e) => setName(e.target.value)} />
          <span className="label">Address</span>
          <input className="input" style={{ marginBottom: 10 }} placeholder="123 Main St, Town, MA" value={address} onChange={(e) => setAddress(e.target.value)} />
          <span className="label">Contact name</span>
          <input className="input" style={{ marginBottom: 10 }} placeholder="Optional" value={contact} onChange={(e) => setContact(e.target.value)} />
          <span className="label">Phone</span>
          <input className="input" style={{ marginBottom: 14 }} placeholder="Optional" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {msg && <div className={msg === "Looking up location…" ? "hd-cond" : "error"} style={{ marginBottom: 10, fontSize: 13, color: msg === "Looking up location…" ? "var(--stone)" : undefined }}>{msg}</div>}
          <button className="btn btn-mgr btn-sm" disabled={busy} onClick={save}>{busy ? "Saving…" : isNew ? "Add property" : "Save changes"}</button>
          {isNew && <div className="hd-cond" style={{ fontSize: 11, color: "var(--moss)", marginTop: 8 }}>Once added, this property shows up in the address search when you build a schedule.</div>}
          {!isNew && (
            <div style={{ borderTop: "1px solid var(--moss)", marginTop: 14, paddingTop: 12 }}>
              {client.archived
                ? <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setArchived(false)}>Restore from archive</button>
                : <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setArchived(true)} style={{ color: "var(--warn)", borderColor: "var(--warn)" }}>Archive this property</button>}
              <div className="hd-cond" style={{ fontSize: 11, color: "var(--moss)", marginTop: 8 }}>
                Archiving hides it from the list and the schedule's address search. Past job history is kept and it can be restored anytime.
              </div>
            </div>
          )}
        </div>
    </Modal>
  );
}

function PropertiesTab() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("clients").select("*").order("name");
    setClients(data || []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const ql = q.trim().toLowerCase();
  const archivedCount = clients.filter((c) => c.archived).length;
  const base = clients.filter((c) => (showArchived ? c.archived : !c.archived));
  const filtered = ql ? base.filter((c) => (c.name || "").toLowerCase().includes(ql) || (c.address || "").toLowerCase().includes(ql)) : base;
  const shown = filtered.slice(0, 100);

  return (
    <div style={{ animation: "fadeUp .25s ease both" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div className="section-hd" style={{ margin: 0 }}>{showArchived ? "Archived" : "Properties"}</div>
        <button className="btn btn-mgr btn-sm" style={{ width: "auto", padding: "9px 14px" }} onClick={() => setAdding(true)}>
          <Ic n="plus" size={15} style={{ marginRight: 6, verticalAlign: -2 }} />Add
        </button>
      </div>

      <input className="input" placeholder="Search name or address…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span className="hd-cond" style={{ fontSize: 12, color: "var(--stone)" }}>
          {loading ? "Loading…" : `${filtered.length} ${showArchived ? "archived" : "propert" + (filtered.length === 1 ? "y" : "ies")}${ql ? " match" : ""}`}
        </span>
        <span className="hd-cond" style={{ fontSize: 12, color: "var(--mgr-lt)", cursor: "pointer", textDecoration: "underline" }}
          onClick={() => { setShowArchived((v) => !v); setQ(""); }}>
          {showArchived ? "← Back to active" : `View archived${archivedCount ? ` (${archivedCount})` : ""}`}
        </span>
      </div>

      {loading ? <div className="empty"><span className="spinner" /></div> : shown.length === 0 ? (
        <div className="empty" style={{ paddingTop: 24 }}>
          <Ic n="pin" size={34} color="var(--moss)" style={{ marginBottom: 8 }} />
          <div className="hd-cond">{ql ? "No matches" : showArchived ? "Nothing archived" : "No properties yet"}</div>
        </div>
      ) : shown.map((c) => (
        <div key={c.id} className="card" onClick={() => setEditing(c)} style={{ padding: "11px 13px", cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div className="hd-bebas" style={{ fontSize: 17, color: "var(--cream)", letterSpacing: .5, lineHeight: 1.1 }}>{c.name}</div>
              {c.address && <div style={{ fontSize: 13, color: "var(--stone)", marginTop: 2 }}>{c.address}</div>}
              {(c.contact_name || c.contact_phone) && (
                <div className="hd-cond" style={{ fontSize: 12, color: "var(--mgr-lt)", marginTop: 3 }}>
                  {c.contact_name}{c.contact_name && c.contact_phone ? " · " : ""}{c.contact_phone}
                </div>
              )}
              {c.lat == null && <div className="hd-cond" style={{ fontSize: 11, color: "var(--warn)", marginTop: 3 }}>No map location</div>}
            </div>
            <Ic n="edit" size={16} color="var(--moss)" style={{ flexShrink: 0, marginTop: 2 }} />
          </div>
        </div>
      )) }
      {!loading && filtered.length > shown.length && (
        <div className="hd-cond" style={{ fontSize: 12, color: "var(--stone)", textAlign: "center", marginTop: 8 }}>
          Showing first {shown.length} of {filtered.length} — search to narrow down
        </div>
      )}

      {(adding || editing) && <PropertyEditor client={editing} onClose={() => { setAdding(false); setEditing(null); }} onSaved={load} />}
    </div>
  );
}

function ManagerHome({ onLogout }) {
  const [tab, setTab] = useState("build");
  const [flash, setFlash] = useState("");
  const tabs = [
    { id: "build", label: "Build", icon: "plus" },
    { id: "jobs", label: "Jobs", icon: "map" },
    { id: "props", label: "Clients", icon: "pin" },
    { id: "projects", label: "Projects", icon: "folder" },
    { id: "crews", label: "Crews", icon: "user" },
    { id: "hours", label: "Hours", icon: "clock" },
  ];
  const onSchedDone = (m) => { setFlash(m); setTab("jobs"); };

  return (
    <div className="screen">
      <div className="topbar mgr">
        <div style={{ lineHeight: 1.05 }}>
          <div className="topbar-title" style={{ fontSize: 18, letterSpacing: 1 }}>{"J&J & Son Lawn Care"}</div>
          <div className="hd-cond" style={{ fontSize: 10, letterSpacing: 1, color: "var(--stone)", textTransform: "uppercase" }}>A TotalFlo app · Manager</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ThemeToggle />
          <button className="logout" onClick={onLogout}>Sign out</button>
        </div>
      </div>
      <div className="content">
        {flash && tab === "jobs" && <div className="success" style={{ marginBottom: 12 }}><Ic n="check" size={16} /> {flash}</div>}
        {tab === "build" && <BuildSchedule onDone={onSchedDone} />}
        {tab === "jobs" && <ManagerJobs />}
        {tab === "props" && <PropertiesTab />}
        {tab === "projects" && <ProjectsTab />}
        {tab === "crews" && <CrewsTab />}
        {tab === "hours" && <HoursTab />}
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
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem("tf_lang") || "en"; } catch { return "en"; }
  });
  const setLang = (l) => {
    setLangState(l);
    try { localStorage.setItem("tf_lang", l); } catch { /* ignore */ }
  };
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem("tf_theme") || "dark"; } catch { return "dark"; }
  });
  const setTheme = (tm) => {
    setThemeState(tm);
    try { localStorage.setItem("tf_theme", tm); } catch { /* ignore */ }
  };
  useEffect(() => { try { document.documentElement.dataset.theme = theme; } catch { /* ignore */ } }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <LangContext.Provider value={{ lang, setLang }}>
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
      </LangContext.Provider>
    </ThemeContext.Provider>
  );
}
