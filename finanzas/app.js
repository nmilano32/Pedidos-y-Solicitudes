"use strict";

/* =====================================================================
   Mis Finanzas
   Datos: base compartida de la página (capability "db") cuando existe,
   si no, localStorage del navegador.
   Los gastos se miden "por caja": una compra en 6 cuotas con tarjeta
   suma una cuota en cada resumen que se paga, no todo en el mes de compra.
   ===================================================================== */

const LOCAL_KEY = "finanzas.v2";
const LEGACY_KEY = "finanzas.v1";
const MIGRATED_KEY = "finanzas.migrated";
const COLLS = ["incomes", "recurring", "expenses", "cards", "short", "long", "portfolio"];

const CURRENCIES = ["ARS", "USD", "EUR", "MXN", "CLP", "COP", "UYU", "PEN", "BRL"];
const CATEGORIES = ["Vivienda", "Servicios", "Alimentación", "Transporte", "Salud", "Educación", "Deudas", "Ocio", "Suscripciones", "Otros"];
const NEEDS = new Set(["Vivienda", "Servicios", "Alimentación", "Transporte", "Salud", "Educación", "Deudas"]);
const FREQS = { 1: "Mensual", 2: "Bimestral", 3: "Trimestral", 6: "Semestral", 12: "Anual" };
const ASSET_TYPES = ["Acciones", "Bonos", "Fondos / ETF", "Cripto", "Plazo fijo", "Inmuebles", "Efectivo / Divisas", "Otro"];
const BASE_METHODS = { cash: "Efectivo", debit: "Débito", transfer: "Transferencia / billetera" };
const PALETTE = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)", "var(--c7)", "var(--c8)"];

/* Comercios y marcas habituales: sirven de sugerencia y para autocompletar la categoría */
const MERCHANTS = {
  "Alimentación": ["Carrefour", "Coto", "Jumbo", "Disco", "Día", "Walmart", "Verdulería", "Carnicería", "Panadería", "PedidosYa", "Rappi", "McDonald's", "Starbucks"],
  "Transporte": ["YPF", "Shell", "Axion", "Uber", "Cabify", "SUBE", "Peaje"],
  "Salud": ["Farmacity", "Farmacia", "OSDE", "Swiss Medical", "Médico"],
  "Educación": ["Colegio", "Universidad", "Udemy", "Coursera"],
  "Ocio": ["Cine", "Cinemark", "Steam", "Restaurante", "Salida"],
  "Suscripciones": ["Netflix", "Spotify", "Disney+", "HBO Max", "YouTube Premium", "Amazon Prime", "iCloud", "Google One"],
  "Servicios": ["Edenor", "Edesur", "Metrogas", "AySA", "Personal", "Claro", "Movistar", "Telecentro", "Fibertel"],
  "Vivienda": ["Alquiler", "Expensas", "IKEA", "Easy", "Sodimac"],
  "Otros": ["Mercado Libre", "Amazon", "Zara", "Falabella"],
};

const emptyState = () => ({
  settings: { currency: "ARS", needsPct: 50, wantsPct: 30, started: false },
  incomes: [], recurring: [], expenses: [], cards: [], short: [], long: [], portfolio: [],
});

let state = emptyState();
let sampleData = null;
let sampleMode = false;
const store = { mode: "loading", db: null, ready: false, readOnly: false, error: null, legacy: null };
const ui = { tab: "resumen", month: monthKey(new Date()), merchantRange: "3" };

/* ---------- Utilidades ---------- */
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sum = (arr, f) => arr.reduce((a, x) => a + num(f(x)), 0);
function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function addMonths(key, n) { const [y, m] = key.split("-").map(Number); return monthKey(new Date(y, m - 1 + n, 1)); }
const nowKey = () => monthKey(new Date());
const today = () => { const d = new Date(); return `${monthKey(d)}-${String(d.getDate()).padStart(2, "0")}`; };
const S = () => (sampleMode ? sampleData : state);
const cur = () => state.settings.currency;
function money(n) { return new Intl.NumberFormat("es-AR", { style: "currency", currency: cur(), maximumFractionDigits: 0 }).format(num(n)); }
const compact = (n) => new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(num(n));
const pct = (n) => `${num(n).toFixed(1).replace(/\.0$/, "")}%`;
function monthLabel(key) { const [y, m] = key.split("-"); return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" }); }
function monthShort(key) { const [y, m] = key.split("-"); return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "short" }).replace(".", ""); }
const monthlyEq = (r) => num(r.amount) / (num(r.freq) || 1);
const active = (it, key) => (!it.start || it.start <= key) && (!it.end || it.end >= key);
function monthsUntil(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr + "T00:00:00"), n = new Date();
  return Math.max(0, (d.getFullYear() - n.getFullYear()) * 12 + d.getMonth() - n.getMonth());
}

/* ---------- Medios de pago ---------- */
function methodOptions() {
  const o = { ...BASE_METHODS };
  S().cards.forEach((c) => { o[c.id] = `Tarjeta ${c.name}`; });
  return o;
}
const methodLabel = (id) => methodOptions()[id] || BASE_METHODS[id] || "Otro";
const cardOf = (id) => S().cards.find((c) => c.id === id);

/* Cuotas de un gasto: en qué mes cae cada una */
function schedule(e) {
  const card = cardOf(e.method);
  const n = card ? Math.max(1, Math.round(num(e.installments) || 1)) : 1;
  const per = num(e.amount) / n;
  const base = (e.date || today()).slice(0, 7);
  let first = base;
  if (card) {
    const day = Number((e.date || today()).slice(8, 10));
    const closeM = day <= num(card.closeDay) ? base : addMonths(base, 1);
    first = num(card.dueDay) > num(card.closeDay) ? closeM : addMonths(closeM, 1);
  }
  return Array.from({ length: n }, (_, i) => ({ month: addMonths(first, i), amount: per, n: i + 1, of: n }));
}

/* ---------- Persistencia ---------- */
function saveLocal() {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); } catch { /* sin almacenamiento */ }
}
function readLocal(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
const hasData = (s) => COLLS.some((c) => (s[c] || []).length > 0);

function persist(coll, item) {
  if (store.db) store.db.collection(coll).doc(item.id).set(item).catch(onDbError);
  else saveLocal();
}
function unpersist(coll, id) {
  if (store.db) store.db.collection(coll).doc(id).delete().catch(onDbError);
  else saveLocal();
}
function putSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  if (store.db) store.db.doc("settings/main").set(state.settings).catch(onDbError);
  else saveLocal();
}
function put(coll, item) {
  const i = state[coll].findIndex((x) => x.id === item.id);
  if (i >= 0) state[coll][i] = item; else state[coll].push(item);
  persist(coll, item);
}
function remove(coll, id) {
  state[coll] = state[coll].filter((x) => x.id !== id);
  unpersist(coll, id);
}

let toastTimer = null;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
}
function onDbError(e) {
  if (e && e.code === "invalid_argument") { store.readOnly = true; toast("No tenés permiso para modificar estos datos. Pedí acceso de Contribuidor."); }
  else if (e && e.code === "revoked") { store.error = "revoked"; }
  else { toast("No se pudo guardar. Revisá tu conexión e intentá de nuevo."); }
  render();
}

/* Antes de escribir: modo ejemplo y solo lectura */
function guard(kind) {
  if (store.readOnly) { toast("Tenés acceso de solo lectura."); return false; }
  if (sampleMode) {
    if (kind !== "add") { toast("Esto es un ejemplo. Tocá «Empezar desde cero» para cargar tus datos."); return false; }
    exitSample();
  }
  return true;
}
function exitSample() {
  sampleMode = false;
  putSettings({ started: true });
}

/* ---------- Carga inicial ---------- */
function startLocal() {
  store.mode = "local";
  const saved = readLocal(LOCAL_KEY) || readLocal(LEGACY_KEY);
  if (saved) state = { ...emptyState(), ...saved, settings: { ...emptyState().settings, ...(saved.settings || {}) } };
  store.ready = true;
  sampleMode = !hasData(state) && !state.settings.started;
  if (sampleMode) sampleData = makeSample();
  render();
}

function startDb(db) {
  store.mode = "cloud"; store.db = db;
  const pending = new Set([...COLLS, "settings"]);
  const arrive = (key) => {
    pending.delete(key);
    if (pending.size) return;
    if (!store.ready) {
      store.ready = true;
      const old = readLocal(LOCAL_KEY) || readLocal(LEGACY_KEY);
      let migrated = false;
      try { migrated = localStorage.getItem(MIGRATED_KEY) === "1"; } catch { /* nada */ }
      if (old && hasData(old) && !migrated) store.legacy = old;
    }
    sampleMode = !hasData(state) && !state.settings.started;
    if (sampleMode && !sampleData) sampleData = makeSample();
    render();
  };
  COLLS.forEach((c) => {
    db.collection(c).onSnapshot((snap) => {
      state[c] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
      arrive(c);
    }, onDbError);
  });
  db.doc("settings/main").onSnapshot((snap) => {
    if (snap.exists) state.settings = { ...emptyState().settings, ...snap.data() };
    arrive("settings");
  }, onDbError);
}

async function init() {
  render();
  const claude = window.claude;
  if (!claude || !claude.use) { startLocal(); return; }
  try {
    const [db, user] = await Promise.all([claude.use("db"), claude.use("user").catch(() => null)]);
    if (user && typeof user.can === "function" && user.can("data.write") === false) store.readOnly = true;
    if (db) startDb(db); else startLocal();
  } catch { startLocal(); }
}

/* Mover datos viejos del navegador (o de un respaldo) a la base */
async function importState(data) {
  if (!data || typeof data !== "object" || !COLLS.some((c) => Array.isArray(data[c]))) throw new Error("formato");
  if (!guard("add")) return 0;
  let n = 0;
  for (const c of COLLS) {
    for (const item of data[c] || []) {
      if (!item || typeof item !== "object") continue;
      put(c, { ...item, id: String(item.id || uid()) });
      n++;
    }
  }
  if (data.settings && data.settings.currency) putSettings({ currency: data.settings.currency });
  return n;
}

/* ---------- Datos de ejemplo (solo en pantalla, no se guardan) ---------- */
function makeSample() {
  const k0 = nowKey(), start = addMonths(k0, -5);
  const d = (key, n) => `${key}-${String(n).padStart(2, "0")}`;
  const visa = { id: "s-visa", name: "Visa", closeDay: 24, dueDay: 5 };
  const master = { id: "s-master", name: "Mastercard", closeDay: 10, dueDay: 20 };
  const ex = [];
  for (let i = -5; i <= 0; i++) {
    const k = addMonths(k0, i), v = 1 + (Math.abs(i) % 3) * 0.08;
    ex.push({ id: uid(), date: d(k, 3), desc: "Compra semanal", merchant: "Carrefour", category: "Alimentación", method: "debit", amount: Math.round(85000 * v), installments: 1 });
    ex.push({ id: uid(), date: d(k, 9), desc: "Nafta", merchant: "YPF", category: "Transporte", method: "s-visa", amount: Math.round(40000 * v), installments: 1 });
    ex.push({ id: uid(), date: d(k, 16), desc: "Cena con amigos", merchant: "Restaurante", category: "Ocio", method: "cash", amount: Math.round(32000 * v), installments: 1 });
    ex.push({ id: uid(), date: d(k, 21), desc: "Pedido", merchant: "PedidosYa", category: "Alimentación", method: "s-master", amount: Math.round(18000 * v), installments: 1 });
  }
  ex.push({ id: uid(), date: d(addMonths(k0, -2), 12), desc: "Notebook", merchant: "Mercado Libre", category: "Otros", method: "s-visa", amount: 960000, installments: 6 });
  ex.push({ id: uid(), date: d(addMonths(k0, -1), 14), desc: "Zapatillas", merchant: "Zara", category: "Otros", method: "s-master", amount: 150000, installments: 3 });
  const in8 = new Date(); in8.setMonth(in8.getMonth() + 8);
  return {
    ...emptyState(),
    incomes: [{ id: uid(), name: "Sueldo (ejemplo)", amount: 1500000, start }, { id: uid(), name: "Ingreso extra (ejemplo)", amount: 250000, start }],
    cards: [visa, master],
    recurring: [
      { id: uid(), name: "Alquiler", category: "Vivienda", method: "transfer", amount: 520000, freq: 1, day: 5, start },
      { id: uid(), name: "Luz y gas", category: "Servicios", method: "debit", amount: 90000, freq: 2, day: 12, start },
      { id: uid(), name: "Internet", category: "Servicios", method: "s-visa", amount: 28000, freq: 1, day: 15, start },
      { id: uid(), name: "Netflix y Spotify", category: "Suscripciones", method: "s-visa", amount: 14000, freq: 1, day: 20, start },
      { id: uid(), name: "Seguro del auto", category: "Transporte", method: "debit", amount: 480000, freq: 12, day: 28, start },
    ],
    expenses: ex,
    short: [{ id: uid(), name: "Fondo de emergencia", target: 1800000, saved: 950000, deadline: in8.toISOString().slice(0, 10), log: [] }],
    long: [{ id: uid(), name: "Retiro", initial: 800000, monthly: 120000, rate: 6, years: 20, target: 50000000 }],
    portfolio: [
      { id: uid(), name: "ETF global", type: "Fondos / ETF", invested: 600000, current: 710000, updated: today() },
      { id: uid(), name: "Plazo fijo", type: "Plazo fijo", invested: 400000, current: 428000, updated: today() },
      { id: uid(), name: "Dólares", type: "Efectivo / Divisas", invested: 300000, current: 330000, updated: today() },
    ],
  };
}

/* ---------- Formularios (modal genérico) ---------- */
const dlg = document.getElementById("dlg");
let onSubmit = null;

function openForm(title, fields, values, cb, hook) {
  document.getElementById("dlg-title").textContent = title;
  document.getElementById("dlg-note").textContent = "";
  document.getElementById("dlg-fields").innerHTML = fields.map((f) => {
    const v = values?.[f.key] ?? f.default ?? "";
    let input;
    if (f.type === "select") {
      const opts = Array.isArray(f.options) ? f.options.map((o) => [o, o]) : Object.entries(f.options);
      input = `<select name="${f.key}">${opts.map(([val, lab]) => `<option value="${esc(val)}" ${String(val) === String(v) ? "selected" : ""}>${esc(lab)}</option>`).join("")}</select>`;
    } else {
      const extra = f.type === "number" ? `step="${f.step ?? "any"}" min="${f.min ?? 0}"` : "";
      const list = f.suggest ? `list="dl-${f.key}"` : "";
      input = `<input name="${f.key}" type="${f.type || "text"}" value="${esc(v)}" ${extra} ${list} ${f.required ? "required" : ""} autocomplete="off">`;
      if (f.suggest) input += `<datalist id="dl-${f.key}">${f.suggest.map((s) => `<option value="${esc(s)}"></option>`).join("")}</datalist>`;
    }
    return `<label class="field"><span>${esc(f.label)}</span>${input}</label>`;
  }).join("");
  onSubmit = (data) => {
    const out = {};
    fields.forEach((f) => {
      const raw = data.get(f.key);
      out[f.key] = f.type === "number" ? num(raw) : String(raw ?? "").trim();
    });
    cb(out);
  };
  dlg.showModal();
  if (hook) hook(document.getElementById("dlg-form"));
}
document.getElementById("dlg-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (onSubmit) onSubmit(new FormData(e.target));
  dlg.close(); render();
});
document.getElementById("dlg-cancel").addEventListener("click", () => dlg.close());

const cfm = document.getElementById("cfm");
let cfmCb = null;
function confirmBox(msg, cb) { document.getElementById("cfm-msg").textContent = msg; cfmCb = cb; cfm.showModal(); }
document.getElementById("cfm-no").addEventListener("click", () => cfm.close());
document.getElementById("cfm-yes").addEventListener("click", () => { cfm.close(); if (cfmCb) cfmCb(); });

/* ---------- Colecciones ---------- */
const knownMerchants = () => {
  const map = new Map();
  Object.entries(MERCHANTS).forEach(([cat, list]) => list.forEach((m) => map.set(m.toLowerCase(), { name: m, cat })));
  [...S().expenses].sort((a, b) => (a.date || "").localeCompare(b.date || "")).forEach((e) => {
    if (e.merchant) map.set(e.merchant.toLowerCase(), { name: e.merchant, cat: e.category });
  });
  return map;
};

const COLL = {
  incomes: { title: "ingreso", fields: () => [
    { key: "name", label: "Fuente (sueldo, alquiler…)", required: true },
    { key: "amount", label: "Monto mensual", type: "number", required: true },
    { key: "start", label: "Desde (mes)", type: "month", default: nowKey() },
    { key: "end", label: "Hasta (mes, vacío si sigue)", type: "month" },
  ] },
  recurring: { title: "gasto fijo", fields: () => [
    { key: "name", label: "Nombre", required: true },
    { key: "category", label: "Categoría", type: "select", options: CATEGORIES },
    { key: "method", label: "Cómo se paga", type: "select", options: methodOptions(), default: "debit" },
    { key: "amount", label: "Monto de cada pago", type: "number", required: true },
    { key: "freq", label: "Frecuencia", type: "select", options: FREQS, default: 1 },
    { key: "day", label: "Día de vencimiento", type: "number", min: 1, step: 1, default: 1 },
    { key: "start", label: "Desde (mes)", type: "month", default: nowKey() },
    { key: "end", label: "Hasta (mes, vacío si sigue)", type: "month" },
  ] },
  expenses: { title: "gasto", fields: () => [
    { key: "date", label: "Fecha de la compra", type: "date", required: true, default: today() },
    { key: "desc", label: "Qué compraste", required: true },
    { key: "merchant", label: "Comercio o marca", suggest: [...knownMerchants().values()].map((m) => m.name) },
    { key: "category", label: "Categoría", type: "select", options: CATEGORIES },
    { key: "method", label: "Medio de pago", type: "select", options: methodOptions(), default: "cash" },
    { key: "installments", label: "Cuotas (solo tarjeta de crédito)", type: "number", min: 1, step: 1, default: 1 },
    { key: "amount", label: "Monto total", type: "number", required: true },
  ] },
  cards: { title: "tarjeta", fields: () => [
    { key: "name", label: "Nombre (Visa, Master…)", required: true },
    { key: "closeDay", label: "Día de cierre del resumen", type: "number", min: 1, step: 1, default: 25, required: true },
    { key: "dueDay", label: "Día de vencimiento", type: "number", min: 1, step: 1, default: 5, required: true },
  ] },
  short: { title: "meta de corto plazo", fields: () => [
    { key: "name", label: "Objetivo (viaje, fondo de emergencia…)", required: true },
    { key: "target", label: "Monto objetivo", type: "number", required: true },
    { key: "saved", label: "Ya ahorrado", type: "number" },
    { key: "deadline", label: "Fecha límite", type: "date", required: true },
  ] },
  long: { title: "ahorro de largo plazo", fields: () => [
    { key: "name", label: "Nombre (retiro, casa…)", required: true },
    { key: "initial", label: "Capital inicial", type: "number" },
    { key: "monthly", label: "Aporte mensual", type: "number" },
    { key: "rate", label: "Rendimiento anual estimado (%)", type: "number", default: 5 },
    { key: "years", label: "Plazo (años)", type: "number", min: 1, step: 1, default: 10 },
    { key: "target", label: "Meta (opcional)", type: "number" },
  ] },
  portfolio: { title: "activo", fields: () => [
    { key: "name", label: "Activo (AAPL, Bono AL30, BTC…)", required: true },
    { key: "type", label: "Tipo", type: "select", options: ASSET_TYPES },
    { key: "invested", label: "Monto invertido", type: "number", required: true },
    { key: "current", label: "Valor actual", type: "number", required: true },
  ] },
};

/* Ayudas dentro del formulario de gasto: autocompleta categoría y explica cuándo se paga */
function expenseHook(form) {
  const f = (n) => form.elements[n];
  const merchants = knownMerchants();
  let touched = false;
  f("category").addEventListener("change", () => { touched = true; });
  const note = () => {
    const e = { date: f("date").value || today(), method: f("method").value, amount: num(f("amount").value), installments: f("installments").value };
    const sch = schedule(e), card = cardOf(e.method);
    document.getElementById("dlg-note").textContent = card
      ? `Entra en el resumen de ${card.name} que vence en ${monthLabel(sch[0].month)}. ${sch.length > 1 ? `${sch.length} cuotas de ${money(sch[0].amount)}, hasta ${monthLabel(sch[sch.length - 1].month)}.` : `Pago de ${money(sch[0].amount)}.`}`
      : `Se paga en ${monthLabel(sch[0].month)}.`;
  };
  f("merchant").addEventListener("input", () => {
    const hit = merchants.get(f("merchant").value.trim().toLowerCase());
    if (hit && !touched) f("category").value = hit.cat;
  });
  ["date", "method", "installments", "amount"].forEach((n) => f(n).addEventListener("input", note));
  f("method").addEventListener("change", note);
  note();
}

function addItem(coll) {
  const hook = coll === "expenses" ? expenseHook : null;
  openForm(`Agregar ${COLL[coll].title}`, COLL[coll].fields(), null, (v) => {
    if (coll === "expenses") v.installments = Math.max(1, Math.round(v.installments || 1));
    put(coll, { id: uid(), ...v, ...(coll === "portfolio" ? { updated: today() } : {}), ...(coll === "short" ? { log: [] } : {}) });
  }, hook);
}
function editItem(coll, id) {
  const item = state[coll].find((x) => x.id === id);
  if (!item) return;
  openForm(`Editar ${COLL[coll].title}`, COLL[coll].fields(), item, (v) => {
    const next = { ...item, ...v };
    if (coll === "expenses") next.installments = Math.max(1, Math.round(v.installments || 1));
    if (coll === "portfolio" && num(v.current) !== num(item.current)) {
      next.updated = today();
      next.hist = [...(item.hist || []), { d: today(), v: num(v.current) }].slice(-36);
    }
    put(coll, next);
  }, coll === "expenses" ? expenseHook : null);
}
function delItem(coll, id) {
  confirmBox("¿Eliminar este elemento?", () => { remove(coll, id); render(); });
}
function togglePaid(id, checked) {
  const r = state.recurring.find((x) => x.id === id);
  if (!r) return;
  const paid = { ...(r.paid || {}) };
  if (checked) paid[ui.month] = Math.round(monthlyEq(r)); else delete paid[ui.month];
  put("recurring", { ...r, paid });
}

/* ---------- Cálculos ---------- */
function fixedCost(r, key) {
  const p = (r.paid || {})[key];
  return typeof p === "number" ? p : monthlyEq(r);
}

/* Todo lo que se paga en un mes (base caja) */
function monthData(key) {
  const s = S();
  const incomes = sum(s.incomes.filter((i) => active(i, key)), (i) => i.amount);
  const items = [];
  s.recurring.filter((r) => active(r, key)).forEach((r) => items.push({ cat: r.category, method: r.method || "transfer", amount: fixedCost(r, key), kind: "fijo" }));
  s.expenses.forEach((e) => schedule(e).forEach((p) => {
    if (p.month === key) items.push({ cat: e.category, method: e.method || "cash", amount: p.amount, kind: "gasto", e, p });
  }));
  const fixed = sum(items.filter((i) => i.kind === "fijo"), (i) => i.amount);
  const spot = sum(items.filter((i) => i.kind === "gasto"), (i) => i.amount);
  const cards = sum(items.filter((i) => i.kind === "gasto" && cardOf(i.method)), (i) => i.amount);
  const byCat = {}, byMethod = {};
  items.forEach((i) => {
    byCat[i.cat] = (byCat[i.cat] || 0) + i.amount;
    byMethod[i.method] = (byMethod[i.method] || 0) + i.amount;
  });
  const needs = sum(Object.entries(byCat).filter(([c]) => NEEDS.has(c)), ([, v]) => v);
  const wants = sum(Object.entries(byCat).filter(([c]) => !NEEDS.has(c)), ([, v]) => v);
  return { key, incomes, fixed, spot, cards, other: spot - cards, balance: incomes - fixed - spot, byCat, byMethod, needs, wants, items };
}
function projection(g) {
  const r = num(g.rate) / 100 / 12, n = Math.round(num(g.years) * 12);
  const points = [];
  let bal = num(g.initial), contributed = num(g.initial);
  for (let m = 0; m <= n; m++) {
    if (m > 0) { bal = bal * (1 + r) + num(g.monthly); contributed += num(g.monthly); }
    if (m % 12 === 0 || m === n) points.push({ m, bal, contributed });
  }
  return { final: bal, contributed, points };
}
const portfolioTotals = () => {
  const p = S().portfolio, invested = sum(p, (x) => x.invested), current = sum(p, (x) => x.current);
  return { invested, current, gain: current - invested, ret: invested ? ((current - invested) / invested) * 100 : 0 };
};

/* ---------- Vistas ---------- */
const TABS = [
  ["resumen", "Resumen"], ["fijos", "Gastos fijos"], ["gastos", "Gastos"], ["futuro", "Próximos meses"], ["historial", "Historial"],
  ["comercios", "Comercios y marcas"], ["medios", "Medios de pago"], ["corto", "Ahorro corto plazo"], ["largo", "Ahorro largo plazo"], ["portfolio", "Portfolio"],
];

const kpi = (label, value, cls = "") => `<div class="card kpi"><div class="label">${label}</div><div class="value ${cls}">${value}</div></div>`;
const actions = (coll, id) => `<button class="btn sm" data-action="edit" data-coll="${coll}" data-id="${id}">Editar</button> <button class="btn sm danger" data-action="del" data-coll="${coll}" data-id="${id}" aria-label="Eliminar">✕</button>`;
const empty = (msg) => `<div class="card empty">${msg}</div>`;
const addBtn = (coll, label) => `<button class="btn primary" data-action="add" data-coll="${coll}">+ ${label}</button>`;
const monthPicker = () => `<input type="month" id="month" value="${ui.month}" aria-label="Mes">`;

function bars(map, labelFn = (k) => k) {
  const entries = Object.entries(map).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] || 1;
  if (!entries.length) return `<div class="muted">Sin movimientos en este mes.</div>`;
  return entries.map(([c, v]) => `<div class="cat"><span>${esc(labelFn(c))}</span><div class="bar"><i style="width:${(v / max) * 100}%"></i></div><span class="num">${money(v)}</span></div>`).join("");
}

/* La fórmula: 50/30/20 + colchón + compromisos del mes que viene */
function formulaCard(d) {
  const s = state.settings, needsT = num(s.needsPct), wantsT = num(s.wantsPct), saveT = 100 - needsT - wantsT;
  if (!d.incomes) return `<div class="card"><h2>Tu fórmula</h2><div class="muted">Cargá tus ingresos para ver cuánto destinar a lo esencial, a los gustos y al ahorro.</div></div>`;
  const nP = (d.needs / d.incomes) * 100, wP = (d.wants / d.incomes) * 100, sP = (d.balance / d.incomes) * 100;
  const lvl = (v, t, higherBetter) => (higherBetter ? (v >= t ? "good" : v >= t - 5 ? "warn" : "bad") : (v <= t ? "good" : v <= t + 5 ? "warn" : "bad"));
  const tag = { good: "En camino", warn: "Cerca", bad: "Para ajustar" };
  const row = (title, text, actual, target, level, help) => `
    <div class="status"><div><b>${title}</b> <span class="muted">${text}</span></div>
      <span class="tag ${level}">${tag[level]}</span>
      <div class="bar ${level}"><i style="width:${Math.max(0, Math.min(100, actual))}%"></i><b style="left:${Math.min(100, target)}%"></b></div>
      <div class="help">${help}</div></div>`;
  const next = monthData(addMonths(nowKey(), 1));
  const commit = next.incomes ? ((next.fixed + next.spot) / next.incomes) * 100 : 0;
  const needsAvg = d.needs || 1;
  const cushion = d.needs ? sum(S().short, (g) => g.saved) / needsAvg : 0;
  const lN = lvl(nP, needsT, false), lW = lvl(wP, wantsT, false), lS = lvl(sP, saveT, true);
  const lC = cushion >= 3 ? "good" : cushion >= 1 ? "warn" : "bad";
  const lK = commit <= 60 ? "good" : commit <= 75 ? "warn" : "bad";
  const tips = [];
  if (lS !== "good") tips.push(`Pagate primero: el día que cobrás apartá ${money((d.incomes * saveT) / 100)} (${pct(saveT)}) a una meta de ahorro, y vivís con el resto.`);
  if (lN === "bad") tips.push(`Tus gastos esenciales superan el ${pct(needsT)}. Revisá los fijos más grandes (alquiler, servicios, deudas) o buscá subir tus ingresos.`);
  if (lW === "bad") tips.push(`Tus gustos pasan el ${pct(wantsT)}. Elegí una categoría de ocio o suscripciones y ponele un tope este mes.`);
  if (lC !== "good") tips.push(`Armá un colchón de 3 a 6 meses de gastos esenciales (${money(d.needs * 3)} a ${money(d.needs * 6)}). Hoy cubrís ${cushion.toFixed(1)} meses.`);
  if (lK !== "good") tips.push(`El mes que viene ya tenés comprometido el ${pct(commit)} de tus ingresos entre fijos y cuotas. Pensalo antes de sumar compras en cuotas.`);
  if (!tips.length) tips.push("Vas bien con la fórmula. Mantené el hábito y revisá el historial una vez por mes.");
  return `<div class="card"><div class="row"><h2>Tu fórmula</h2><button class="btn sm" data-action="percent">Ajustar porcentajes</button></div>
    <div class="muted" style="font-size:.82rem;margin-bottom:.4rem">Regla práctica ${needsT}/${wantsT}/${saveT}: ${needsT}% a lo esencial, ${wantsT}% a gustos y ${saveT}% a ahorro. Es una guía general: ajustala a tu situación.</div>
    ${row("Esenciales", `${money(d.needs)} · ${pct(nP)} (máx. ${pct(needsT)})`, nP, needsT, lN, "Vivienda, servicios, comida, transporte, salud, educación y deudas.")}
    ${row("Gustos", `${money(d.wants)} · ${pct(wP)} (máx. ${pct(wantsT)})`, wP, wantsT, lW, "Ocio, suscripciones y otros.")}
    ${row("Ahorro", `${money(d.balance)} · ${pct(sP)} (mín. ${pct(saveT)})`, sP, saveT, lS, "Lo que sobra de tus ingresos después de pagar todo el mes.")}
    ${row("Colchón de emergencia", `${cushion.toFixed(1)} meses (ideal 3 a 6)`, Math.min(100, (cushion / 6) * 100), 50, lC, `Tus metas de corto plazo (${money(sum(S().short, (g) => g.saved))}) cubren ${cushion.toFixed(1)} meses de gastos esenciales.`)}
    ${row("Compromisos del mes que viene", `${money(next.fixed + next.spot)} · ${pct(commit)} (máx. 60%)`, commit, 60, lK, "Fijos y cuotas ya cargados, sobre tus ingresos.")}
    <h3 style="margin-top:.8rem">Qué hacer ahora</h3><ul class="tips">${tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`;
}

function viewResumen() {
  const d = monthData(ui.month), p = portfolioTotals(), s = S();
  const rate = d.incomes ? (d.balance / d.incomes) * 100 : 0;
  const shortSaved = sum(s.short, (g) => g.saved);
  const longProj = sum(s.long, (g) => projection(g).final);
  return `
  <div class="row"><h2>${monthLabel(ui.month)}</h2>${monthPicker()}</div>
  <div class="grid">
    ${kpi("Ingresos", money(d.incomes), "good")}
    ${kpi("Gastos fijos", money(d.fixed))}
    ${kpi("Gastos y cuotas del mes", money(d.spot))}
    ${kpi("Disponible / ahorro", money(d.balance), d.balance >= 0 ? "good" : "bad")}
    ${kpi("Tasa de ahorro", d.incomes ? pct(rate) : "—", rate >= 0 ? "good" : "bad")}
  </div>
  <div class="muted" style="font-size:.82rem;margin:-.4rem 0 1rem">Se cuenta lo que pagás en el mes: una compra en 6 cuotas suma una cuota por mes, en el resumen donde vence.</div>
  ${formulaCard(d)}
  <div class="grid">
    <div class="card"><h2>Por categoría</h2>${bars(d.byCat)}</div>
    <div class="card"><h2>Por medio de pago</h2>${bars(d.byMethod, methodLabel)}</div>
  </div>
  <div class="grid">
    ${kpi("Ahorrado a corto plazo", money(shortSaved))}
    ${kpi("Proyección largo plazo", money(longProj))}
    ${kpi("Portfolio actual", money(p.current))}
    ${kpi("Rendimiento portfolio", `${p.gain >= 0 ? "+" : ""}${money(p.gain)} (${pct(p.ret)})`, p.gain >= 0 ? "good" : "bad")}
  </div>
  <div class="card"><h2>Ingresos mensuales</h2>
    ${s.incomes.length ? `<div class="table-wrap"><table><tbody>${s.incomes.map((i) => `<tr><td>${esc(i.name)}<div class="muted" style="font-size:.78rem">${i.start ? `desde ${esc(i.start)}` : ""}${i.end ? ` hasta ${esc(i.end)}` : ""}</div></td><td class="num">${money(i.amount)}</td><td class="act">${actions("incomes", i.id)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="muted">Agregá tus fuentes de ingreso para calcular tu balance.</div>`}
    <p>${addBtn("incomes", "Agregar ingreso")}</p>
  </div>`;
}

function viewFijos() {
  const s = S(), paid = (r) => (r.paid || {})[ui.month] !== undefined;
  const list = s.recurring.filter((r) => active(r, ui.month));
  const total = sum(list, (r) => fixedCost(r, ui.month));
  return `
  <div class="row"><h2>Gastos fijos y recurrentes</h2>${addBtn("recurring", "Agregar gasto fijo")}</div>
  <div class="row"><span class="muted">Total de ${monthLabel(ui.month)}: <b>${money(total)}</b></span>${monthPicker()}</div>
  ${list.length ? `<div class="card table-wrap"><table>
    <thead><tr><th>Pagado</th><th>Nombre</th><th>Medio</th><th>Frecuencia</th><th>Vence</th><th class="num">Pago</th><th class="num">Mensual eq.</th><th></th></tr></thead>
    <tbody>${[...list].sort((a, b) => num(a.day) - num(b.day)).map((r) => `<tr>
      <td><input type="checkbox" data-action="paid" data-id="${r.id}" ${paid(r) ? "checked" : ""} aria-label="Pagado en ${ui.month}"></td>
      <td>${esc(r.name)}<div class="muted" style="font-size:.78rem">${esc(r.category)}</div></td><td>${esc(methodLabel(r.method || "transfer"))}</td><td>${FREQS[r.freq] || "Mensual"}</td><td>día ${esc(r.day)}</td>
      <td class="num">${money(r.amount)}</td><td class="num">${money(fixedCost(r, ui.month))}</td><td class="act">${actions("recurring", r.id)}</td></tr>`).join("")}</tbody></table></div>`
    : empty("No hay gastos fijos activos en este mes (alquiler, luz, internet, suscripciones…).")}`;
}

function viewGastos() {
  const s = S();
  const list = s.expenses.filter((e) => (e.date || "").startsWith(ui.month)).sort((a, b) => b.date.localeCompare(a.date));
  const total = sum(list, (e) => e.amount);
  return `
  <div class="row"><h2>Gastos del momento</h2>${addBtn("expenses", "Agregar gasto")}</div>
  <div class="row"><span class="muted">Compras de ${monthLabel(ui.month)}: <b>${money(total)}</b></span>${monthPicker()}</div>
  ${list.length ? `<div class="card table-wrap"><table><thead><tr><th>Fecha</th><th>Detalle</th><th>Medio</th><th>Se paga</th><th class="num">Total</th><th></th></tr></thead>
    <tbody>${list.map((e) => {
      const sch = schedule(e), card = cardOf(e.method);
      const when = card ? `${sch.length > 1 ? `${sch.length} cuotas · ` : ""}desde ${monthShort(sch[0].month)}` : monthShort(sch[0].month);
      return `<tr><td>${esc(e.date)}</td><td>${esc(e.desc)}<div class="muted" style="font-size:.78rem">${esc([e.merchant, e.category].filter(Boolean).join(" · "))}</div></td><td>${esc(methodLabel(e.method || "cash"))}</td><td>${esc(when)}</td><td class="num">${money(e.amount)}</td><td class="act">${actions("expenses", e.id)}</td></tr>`;
    }).join("")}</tbody></table></div>`
    : empty("No hay compras registradas en este mes.")}`;
}

function viewFuturo() {
  const s = S(), keys = Array.from({ length: 6 }, (_, i) => addMonths(nowKey(), i));
  const rows = keys.map((k) => monthData(k));
  const cardsList = s.cards;
  const inProgress = s.expenses.map((e) => ({ e, sch: schedule(e) })).filter(({ sch }) => sch.length > 1 && sch[sch.length - 1].month >= nowKey())
    .sort((a, b) => a.sch[a.sch.length - 1].month.localeCompare(b.sch[b.sch.length - 1].month));
  return `
  <div class="row"><h2>Próximos meses</h2></div>
  <div class="muted" style="margin-bottom:.8rem">Lo que ya está comprometido con tus gastos fijos y las cuotas de tarjeta. Sirve para decidir antes de comprar.</div>
  <div class="card table-wrap"><table>
    <thead><tr><th>Mes</th><th class="num">Ingresos</th><th class="num">Fijos</th><th class="num">Tarjetas</th><th class="num">Otros</th><th class="num">Queda</th><th>Comprometido</th></tr></thead>
    <tbody>${rows.map((d) => {
      const c = d.incomes ? ((d.fixed + d.spot) / d.incomes) * 100 : 0, lv = c <= 60 ? "good" : c <= 75 ? "warn" : "bad";
      return `<tr><td>${esc(monthLabel(d.key))}</td><td class="num">${money(d.incomes)}</td><td class="num">${money(d.fixed)}</td><td class="num">${money(d.cards)}</td><td class="num">${money(d.other)}</td>
      <td class="num ${d.balance >= 0 ? "good" : "bad"}">${money(d.balance)}</td><td style="min-width:110px"><div class="bar ${lv}"><i style="width:${Math.min(100, c)}%"></i></div><span class="muted" style="font-size:.78rem">${d.incomes ? pct(c) : "—"}</span></td></tr>`;
    }).join("")}</tbody></table></div>
  ${cardsList.length ? `<div class="card table-wrap"><h2>Resumen de cada tarjeta</h2><table><thead><tr><th>Tarjeta</th>${keys.map((k) => `<th class="num">${monthShort(k)}</th>`).join("")}</tr></thead>
    <tbody>${cardsList.map((c) => `<tr><td>${esc(c.name)}</td>${rows.map((d) => `<td class="num">${money(sum(d.items.filter((i) => i.method === c.id), (i) => i.amount))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : ""}
  <div class="card table-wrap"><h2>Cuotas en curso</h2>
    ${inProgress.length ? `<table><thead><tr><th>Compra</th><th>Tarjeta</th><th class="num">Cuota</th><th>Va por</th><th>Termina</th></tr></thead><tbody>${inProgress.map(({ e, sch }) => {
      const nowIdx = sch.findIndex((x) => x.month >= nowKey()), done = nowIdx < 0 ? sch.length : nowIdx;
      return `<tr><td>${esc(e.desc)}</td><td>${esc(methodLabel(e.method))}</td><td class="num">${money(sch[0].amount)}</td><td>${Math.min(sch.length, done + 1)} de ${sch.length}</td><td>${esc(monthLabel(sch[sch.length - 1].month))}</td></tr>`;
    }).join("")}</tbody></table>` : `<div class="muted">No tenés compras en cuotas.</div>`}</div>`;
}

function viewHistorial() {
  const keys = Array.from({ length: 12 }, (_, i) => addMonths(nowKey(), i - 11));
  const rows = keys.map((k) => monthData(k));
  const W = 640, H = 230, PL = 44, PB = 26, PT = 12, n = rows.length;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.incomes, r.fixed + r.spot)));
  const gw = (W - PL - 8) / n, bw = gw * 0.34, y = (v) => PT + (H - PT - PB) * (1 - v / max);
  const svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ingresos y gastos de los últimos 12 meses">
    <line x1="${PL}" y1="${y(0)}" x2="${W - 4}" y2="${y(0)}" stroke="var(--line)"/>
    <line x1="${PL}" y1="${y(max)}" x2="${W - 4}" y2="${y(max)}" stroke="var(--line)" stroke-dasharray="3 3"/>
    <text x="${PL - 6}" y="${y(max) + 4}" text-anchor="end" font-size="10">${compact(max)}</text>
    <text x="${PL - 6}" y="${y(0) + 4}" text-anchor="end" font-size="10">0</text>
    ${rows.map((r, i) => {
      const x0 = PL + i * gw + gw * 0.14, spent = r.fixed + r.spot;
      return `<rect x="${x0.toFixed(1)}" y="${y(r.incomes).toFixed(1)}" width="${bw.toFixed(1)}" height="${(y(0) - y(r.incomes)).toFixed(1)}" fill="var(--c1)"/>
      <rect x="${(x0 + bw + 2).toFixed(1)}" y="${y(spent).toFixed(1)}" width="${bw.toFixed(1)}" height="${(y(0) - y(spent)).toFixed(1)}" fill="var(--c2)"/>
      <text x="${(x0 + bw).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10">${monthShort(r.key)}</text>`;
    }).join("")}</svg>`;
  const withData = rows.filter((r) => r.incomes || r.fixed || r.spot);
  const saved = sum(withData, (r) => r.balance);
  return `
  <div class="row"><h2>Historial de movimientos</h2></div>
  <div class="grid">${kpi("Meses con datos", String(withData.length))}${kpi("Ahorro acumulado (12 meses)", money(saved), saved >= 0 ? "good" : "bad")}${kpi("Gasto promedio mensual", money(withData.length ? sum(withData, (r) => r.fixed + r.spot) / withData.length : 0))}</div>
  <div class="card"><h2>Ingresos y gastos por mes</h2>${svg}<div class="legend"><span><span class="dot" style="background:var(--c1)"></span>Ingresos</span><span><span class="dot" style="background:var(--c2)"></span>Gastos pagados</span></div></div>
  <div class="card table-wrap"><table><thead><tr><th>Mes</th><th class="num">Ingresos</th><th class="num">Fijos</th><th class="num">Gastos y cuotas</th><th class="num">Balance</th><th class="num">Ahorro</th></tr></thead>
    <tbody>${[...rows].reverse().map((r) => `<tr><td>${esc(monthLabel(r.key))}</td><td class="num">${money(r.incomes)}</td><td class="num">${money(r.fixed)}</td><td class="num">${money(r.spot)}</td><td class="num ${r.balance >= 0 ? "good" : "bad"}">${money(r.balance)}</td><td class="num">${r.incomes ? pct((r.balance / r.incomes) * 100) : "—"}</td></tr>`).join("")}</tbody></table></div>
  <div class="muted" style="font-size:.82rem">Cada movimiento queda guardado con su fecha. Los ingresos y gastos fijos cuentan desde el mes en que los empezaste.</div>`;
}

function viewComercios() {
  const s = S(), range = ui.merchantRange;
  const from = range === "all" ? "0000-00" : addMonths(nowKey(), -(Number(range) - 1));
  const list = s.expenses.filter((e) => (e.date || "").slice(0, 7) >= from);
  const map = new Map();
  list.forEach((e) => {
    const name = e.merchant || "(sin comercio)";
    const m = map.get(name) || { name, total: 0, count: 0, cats: {}, last: "" };
    m.total += num(e.amount); m.count++; m.cats[e.category] = (m.cats[e.category] || 0) + num(e.amount);
    if ((e.date || "") > m.last) m.last = e.date;
    map.set(name, m);
  });
  const rows = [...map.values()].sort((a, b) => b.total - a.total);
  const grand = sum(rows, (r) => r.total) || 1;
  const top = rows.find((r) => r.name !== "(sin comercio)");
  return `
  <div class="row"><h2>Comercios y marcas</h2>
    <select id="mrange" aria-label="Período"><option value="1" ${range === "1" ? "selected" : ""}>Este mes</option><option value="3" ${range === "3" ? "selected" : ""}>Últimos 3 meses</option><option value="12" ${range === "12" ? "selected" : ""}>Últimos 12 meses</option><option value="all" ${range === "all" ? "selected" : ""}>Todo</option></select></div>
  <div class="muted" style="margin-bottom:.8rem">Dónde se va tu plata. Completá «Comercio o marca» al cargar cada gasto y acá aparece el ranking. Te sugerimos marcas conocidas y te acordamos la categoría.</div>
  ${rows.length ? `${top ? `<div class="card">Donde más gastás: <b>${esc(top.name)}</b> (${money(top.total)}, ${pct((top.total / grand) * 100)} del total).</div>` : ""}
  <div class="card table-wrap"><table><thead><tr><th>Comercio / marca</th><th>Categoría</th><th class="num">Compras</th><th class="num">Ticket prom.</th><th class="num">Total</th><th style="min-width:90px">Peso</th></tr></thead>
    <tbody>${rows.map((r) => {
      const cat = Object.entries(r.cats).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
      return `<tr><td>${esc(r.name)}<div class="muted" style="font-size:.78rem">última: ${esc(r.last)}</div></td><td>${esc(cat)}</td><td class="num">${r.count}</td><td class="num">${money(r.total / r.count)}</td><td class="num">${money(r.total)}</td><td><div class="bar"><i style="width:${(r.total / grand) * 100}%"></i></div></td></tr>`;
    }).join("")}</tbody></table></div>` : empty("Todavía no hay gastos en este período.")}`;
}

function viewMedios() {
  const s = S(), k0 = nowKey(), k1 = addMonths(k0, 1);
  const d0 = monthData(k0), d1 = monthData(k1);
  const due = (d, c) => sum(d.items.filter((i) => i.method === c.id), (i) => i.amount);
  return `
  <div class="row"><h2>Medios de pago</h2>${addBtn("cards", "Agregar tarjeta")}</div>
  <div class="card"><b>Siempre disponibles:</b> ${Object.values(BASE_METHODS).map(esc).join(", ")}. Agregá tus tarjetas de crédito para saber en qué resumen cae cada compra y cuántas cuotas te quedan.</div>
  ${s.cards.length ? `<div class="card table-wrap"><table><thead><tr><th>Tarjeta</th><th>Cierre</th><th>Vence</th><th class="num">${esc(monthShort(k0))}</th><th class="num">${esc(monthShort(k1))}</th><th></th></tr></thead>
    <tbody>${s.cards.map((c) => `<tr><td>${esc(c.name)}</td><td>día ${esc(c.closeDay)}</td><td>día ${esc(c.dueDay)}${num(c.dueDay) > num(c.closeDay) ? "" : " (mes siguiente)"}</td><td class="num">${money(due(d0, c))}</td><td class="num">${money(due(d1, c))}</td><td class="act">${actions("cards", c.id)}</td></tr>`).join("")}</tbody></table></div>`
    : empty("Sin tarjetas cargadas.")}
  <div class="muted" style="font-size:.82rem">Las compras hasta el día de cierre entran en el resumen de ese mes; las posteriores, en el siguiente. Las cuotas se reparten mes a mes.</div>`;
}

function viewCorto() {
  return `
  <div class="row"><h2>Metas de ahorro a corto plazo</h2>${addBtn("short", "Nueva meta")}</div>
  ${S().short.length ? S().short.map((g) => {
    const target = num(g.target), saved = num(g.saved), p = target ? Math.min(100, (saved / target) * 100) : 0;
    const months = monthsUntil(g.deadline), left = Math.max(0, target - saved);
    const need = months > 0 ? left / months : left;
    const log = (g.log || []).slice(-3).reverse();
    return `<div class="card goal"><h3>${esc(g.name)}</h3>
      <div class="bar good"><i style="width:${p}%"></i></div>
      <div class="meta"><span>${money(saved)} de ${money(target)} (${pct(p)})</span><span>Fecha límite: ${esc(g.deadline)}</span></div>
      <div class="meta"><span>${left === 0 ? "Meta cumplida" : months > 0 ? `Ahorrá ${money(need)}/mes durante ${months} mes(es)` : `Vencida · faltan ${money(left)}`}</span>
      <span><button class="btn sm primary" data-action="contribute" data-id="${g.id}">+ Aportar</button> ${actions("short", g.id)}</span></div>
      ${log.length ? `<div class="meta"><span>Últimos aportes: ${log.map((l) => `${esc(l.d)} ${l.a >= 0 ? "+" : ""}${money(l.a)}`).join(" · ")}</span></div>` : ""}</div>`;
  }).join("") : empty("Creá una meta (vacaciones, fondo de emergencia, electrodoméstico…) y seguí tu progreso.")}`;
}

function chart(points, target) {
  const W = 600, H = 220, P = 30;
  const maxY = Math.max(target || 0, ...points.map((p) => p.bal), 1), maxX = points[points.length - 1].m || 1;
  const x = (m) => P + (m / maxX) * (W - P * 1.5), y = (v) => H - P - (v / maxY) * (H - P * 1.6);
  const line = (key) => points.map((p, i) => `${i ? "L" : "M"}${x(p.m).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const years = Math.round(maxX / 12);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Proyección de ahorro">
    <line x1="${P}" y1="${H - P}" x2="${W - P / 2}" y2="${H - P}" stroke="var(--line)"/>
    ${target ? `<line x1="${P}" y1="${y(target)}" x2="${W - P / 2}" y2="${y(target)}" stroke="var(--warn)" stroke-dasharray="5 4"/><text x="${W - P / 2}" y="${y(target) - 4}" text-anchor="end" font-size="11">Meta</text>` : ""}
    <path d="${line("contributed")}" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="4 3"/>
    <path d="${line("bal")}" fill="none" stroke="var(--good)" stroke-width="3"/>
    <text x="${P}" y="${H - 8}" font-size="11">Hoy</text>
    <text x="${W - P / 2}" y="${H - 8}" text-anchor="end" font-size="11">${years} años</text>
  </svg>`;
}

function viewLargo() {
  return `
  <div class="row"><h2>Ahorro e inversión a largo plazo</h2>${addBtn("long", "Nuevo plan")}</div>
  ${S().long.length ? S().long.map((g) => {
    const pr = projection(g), gain = pr.final - pr.contributed, target = num(g.target);
    return `<div class="card goal"><h3>${esc(g.name)}</h3>
      <div class="grid">${kpi("Valor proyectado", money(pr.final), "good")}${kpi("Aportado", money(pr.contributed))}${kpi("Intereses ganados", money(gain), "good")}</div>
      ${chart(pr.points, target)}
      <div class="meta"><span>${money(g.monthly)}/mes · ${pct(g.rate)} anual · ${g.years} años${target ? ` · ${pr.final >= target ? "alcanzás la meta" : `faltarían ${money(target - pr.final)}`}` : ""}</span><span>${actions("long", g.id)}</span></div>
      <div class="muted" style="font-size:.78rem">Línea verde: valor con interés compuesto. Línea gris: lo que aportás. Es una estimación, no una garantía.</div></div>`;
  }).join("") : empty("Simulá tu retiro, la casa propia o la educación de tus hijos con aportes mensuales e interés compuesto.")}`;
}

function viewPortfolio() {
  const t = portfolioTotals(), items = S().portfolio;
  const byType = {};
  items.forEach((p) => { byType[p.type] = (byType[p.type] || 0) + num(p.current); });
  const types = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const share = (v) => (t.current ? (v / t.current) * 100 : 0);
  return `
  <div class="row"><h2>Mi portfolio financiero</h2>${addBtn("portfolio", "Agregar activo")}</div>
  <div class="grid">
    ${kpi("Valor actual", money(t.current))}${kpi("Invertido", money(t.invested))}
    ${kpi("Ganancia / pérdida", `${t.gain >= 0 ? "+" : ""}${money(t.gain)}`, t.gain >= 0 ? "good" : "bad")}${kpi("Retorno", pct(t.ret), t.gain >= 0 ? "good" : "bad")}
  </div>
  ${items.length ? `
  <div class="card"><h2>Distribución por tipo</h2>
    <div class="stack">${types.map(([k, v], i) => `<div title="${esc(k)}" style="width:${share(v)}%;background:${PALETTE[i % PALETTE.length]}"></div>`).join("")}</div>
    ${types.map(([k, v], i) => `<div><span class="dot" style="background:${PALETTE[i % PALETTE.length]}"></span>${esc(k)}: ${pct(share(v))} (${money(v)})</div>`).join("")}</div>
  <div class="card table-wrap"><table><thead><tr><th>Activo</th><th>Tipo</th><th class="num">Invertido</th><th class="num">Actual</th><th class="num">Resultado</th><th></th></tr></thead>
    <tbody>${items.map((p) => {
      const g = num(p.current) - num(p.invested), r = num(p.invested) ? (g / num(p.invested)) * 100 : 0;
      return `<tr><td>${esc(p.name)}<div class="muted" style="font-size:.78rem">${p.updated ? `actualizado ${esc(p.updated)}` : ""}</div></td><td>${esc(p.type)}</td><td class="num">${money(p.invested)}</td><td class="num">${money(p.current)}</td>
      <td class="num ${g >= 0 ? "good" : "bad"}">${g >= 0 ? "+" : ""}${money(g)} (${pct(r)})</td><td class="act">${actions("portfolio", p.id)}</td></tr>`;
    }).join("")}</tbody></table></div>` : empty("Registrá tus inversiones (acciones, bonos, cripto, plazo fijo, inmuebles…) para ver su distribución y rendimiento.")}`;
}

const VIEWS = { resumen: viewResumen, fijos: viewFijos, gastos: viewGastos, futuro: viewFuturo, historial: viewHistorial, comercios: viewComercios, medios: viewMedios, corto: viewCorto, largo: viewLargo, portfolio: viewPortfolio };

function banners() {
  let h = "";
  if (store.error === "revoked") h += `<div class="banner">Se perdió el acceso a los datos compartidos. Recargá la página.</div>`;
  if (store.legacy) h += `<div class="banner"><span>Hay datos guardados solo en este navegador. ¿Querés pasarlos al almacenamiento compartido?</span><span class="btns"><button class="btn sm primary" data-action="migrate">Traerlos</button><button class="btn sm" data-action="skip-migrate">Ahora no</button></span></div>`;
  if (sampleMode) h += `<div class="banner"><span>Estás viendo datos de ejemplo. No se guardan.</span><button class="btn sm primary" data-action="clear">Empezar desde cero</button></div>`;
  return h;
}

function render() {
  const chip = document.getElementById("store-chip");
  const chips = { loading: ["Conectando…", ""], cloud: ["Guardado y compartido", "ok"], local: ["Solo en este dispositivo", "warn"] };
  const [label, cls] = store.readOnly ? ["Solo lectura", "warn"] : chips[store.mode];
  chip.textContent = label; chip.className = `chip ${cls}`;
  document.getElementById("tabs").innerHTML = TABS.map(([k, l]) => `<button role="tab" aria-selected="${ui.tab === k}" data-action="tab" data-tab="${k}" class="${ui.tab === k ? "active" : ""}">${l}</button>`).join("");
  const view = document.getElementById("view");
  view.innerHTML = store.ready ? banners() + VIEWS[ui.tab]() : `<div class="card empty">Cargando tus datos…</div>`;
  document.getElementById("currency").value = state.settings.currency;
}

/* ---------- Eventos ---------- */
document.getElementById("currency").innerHTML = CURRENCIES.map((c) => `<option>${c}</option>`).join("");
document.getElementById("currency").addEventListener("change", (e) => { if (!store.readOnly) putSettings({ currency: e.target.value }); render(); });

function percentForm() {
  const s = state.settings;
  openForm("Ajustar fórmula", [
    { key: "needsPct", label: "% para lo esencial", type: "number", step: 1, default: s.needsPct },
    { key: "wantsPct", label: "% para gustos", type: "number", step: 1, default: s.wantsPct },
  ], s, (v) => {
    const n = Math.min(100, Math.max(0, v.needsPct)), w = Math.min(100 - n, Math.max(0, v.wantsPct));
    putSettings({ needsPct: n, wantsPct: w });
  });
  document.getElementById("dlg-note").textContent = "El ahorro es lo que queda hasta llegar a 100%.";
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const { action, coll, id } = el.dataset;
  if (el.tagName === "INPUT") return;
  if (action === "tab") { ui.tab = el.dataset.tab; render(); }
  else if (action === "add") { if (guard("add")) addItem(coll); }
  else if (action === "edit") { if (guard("edit")) editItem(coll, id); }
  else if (action === "del") { if (guard("del")) delItem(coll, id); }
  else if (action === "percent") { if (guard("add")) percentForm(); }
  else if (action === "clear") { if (guard("add")) { putSettings({ started: true }); render(); } }
  else if (action === "contribute") {
    if (!guard("edit")) return;
    const g = state.short.find((x) => x.id === id);
    if (!g) return;
    openForm(`Aporte a "${g.name}"`, [{ key: "amount", label: "Monto aportado (negativo para retirar)", type: "number", min: -1e12, required: true }], null, (v) => {
      put("short", { ...g, saved: Math.max(0, num(g.saved) + v.amount), log: [...(g.log || []), { d: today(), a: v.amount }].slice(-20) });
    });
  } else if (action === "migrate") {
    importState(store.legacy).then((n) => {
      try { localStorage.setItem(MIGRATED_KEY, "1"); } catch { /* nada */ }
      store.legacy = null; toast(`Listo: se pasaron ${n} registros.`); render();
    }).catch(() => toast("No se pudieron pasar los datos."));
  } else if (action === "skip-migrate") {
    try { localStorage.setItem(MIGRATED_KEY, "1"); } catch { /* nada */ }
    store.legacy = null; render();
  } else if (action === "export") {
    document.getElementById("exp-text").value = JSON.stringify(state, null, 2);
    document.getElementById("imp-text").value = "";
    document.getElementById("exp-msg").textContent = "";
    document.getElementById("exp").showModal();
  } else if (action === "copy-export") {
    const t = document.getElementById("exp-text");
    t.select();
    const msg = document.getElementById("exp-msg");
    const ok = () => { msg.textContent = "Copiado. Pegalo en un archivo de texto para guardarlo."; };
    const manual = () => { msg.textContent = "Texto seleccionado: copialo con Ctrl+C."; };
    if (navigator.clipboard) navigator.clipboard.writeText(t.value).then(ok, manual); else manual();
  } else if (action === "close-export") { document.getElementById("exp").close(); }
  else if (action === "do-import") {
    const msg = document.getElementById("exp-msg");
    let data;
    try { data = JSON.parse(document.getElementById("imp-text").value); } catch { msg.textContent = "El texto no es un respaldo válido."; return; }
    importState(data).then((n) => { document.getElementById("exp").close(); toast(`Se importaron ${n} registros.`); render(); })
      .catch(() => { msg.textContent = "El texto no es un respaldo válido."; });
  }
});

document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "month" && t.value) { ui.month = t.value; render(); }
  else if (t.id === "mrange") { ui.merchantRange = t.value; render(); }
  else if (t.dataset && t.dataset.action === "paid") {
    if (!guard("edit")) { t.checked = !t.checked; return; }
    togglePaid(t.dataset.id, t.checked);
  }
});

document.getElementById("import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (file) {
    document.getElementById("imp-text").value = await file.text();
    document.getElementById("exp-msg").textContent = "Archivo cargado. Tocá «Importar» para sumarlo a tus datos.";
  }
  e.target.value = "";
});

init();
