"use strict";

/* ---------- Estado y persistencia ---------- */
const STORAGE_KEY = "finanzas.v1";
const CURRENCIES = ["ARS", "USD", "EUR", "MXN", "CLP", "COP", "UYU", "PEN", "BRL"];
const CATEGORIES = ["Vivienda", "Servicios", "Alimentación", "Transporte", "Salud", "Educación", "Ocio", "Suscripciones", "Deudas", "Otros"];
const FREQS = { 1: "Mensual", 2: "Bimestral", 3: "Trimestral", 6: "Semestral", 12: "Anual" };
const ASSET_TYPES = ["Acciones", "Bonos", "Fondos / ETF", "Cripto", "Plazo fijo", "Inmuebles", "Efectivo / Divisas", "Otro"];
const PALETTE = ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#0891b2", "#dc2626", "#65a30d", "#db2777"];

const emptyState = () => ({
  settings: { currency: "ARS" },
  incomes: [], recurring: [], expenses: [], short: [], long: [], portfolio: [],
});

let state = load();
let ui = { tab: "resumen", month: monthKey(new Date()) };

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...emptyState(), ...JSON.parse(raw) } : emptyState();
  } catch { return emptyState(); }
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* almacenamiento no disponible */ }
}

/* ---------- Utilidades ---------- */
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sum = (arr, f) => arr.reduce((a, x) => a + num(f(x)), 0);
function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function money(n) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: state.settings.currency, maximumFractionDigits: 0 }).format(num(n));
}
const pct = (n) => `${(num(n)).toFixed(1).replace(".0", "")}%`;
const monthlyEq = (r) => num(r.amount) / (num(r.freq) || 1);
function monthsUntil(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr + "T00:00:00"), n = new Date();
  return Math.max(0, (d.getFullYear() - n.getFullYear()) * 12 + d.getMonth() - n.getMonth());
}
function monthLabel(key) {
  const [y, m] = key.split("-");
  return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

/* ---------- Formularios (modal genérico) ---------- */
const dlg = document.getElementById("dlg");
let onSubmit = null;

function openForm(title, fields, values, cb) {
  document.getElementById("dlg-title").textContent = title;
  document.getElementById("dlg-fields").innerHTML = fields.map((f) => {
    const v = values?.[f.key] ?? f.default ?? "";
    let input;
    if (f.type === "select") {
      const opts = Array.isArray(f.options) ? f.options.map((o) => [o, o]) : Object.entries(f.options);
      input = `<select name="${f.key}">${opts.map(([val, lab]) => `<option value="${esc(val)}" ${String(val) === String(v) ? "selected" : ""}>${esc(lab)}</option>`).join("")}</select>`;
    } else {
      const extra = f.type === "number" ? `step="${f.step ?? "any"}" min="${f.min ?? 0}"` : "";
      input = `<input name="${f.key}" type="${f.type || "text"}" value="${esc(v)}" ${extra} ${f.required ? "required" : ""}>`;
    }
    return `<label class="field"><span>${esc(f.label)}</span>${input}</label>`;
  }).join("");
  onSubmit = (data) => {
    const out = {};
    fields.forEach((f) => { out[f.key] = f.type === "number" ? num(data.get(f.key)) : String(data.get(f.key) ?? "").trim(); });
    cb(out);
  };
  dlg.showModal();
}
document.getElementById("dlg-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (onSubmit) onSubmit(new FormData(e.target));
  dlg.close(); save(); render();
});
document.getElementById("dlg-cancel").addEventListener("click", () => dlg.close());

/* ---------- Definición de colecciones ---------- */
const today = () => new Date().toISOString().slice(0, 10);
const COLL = {
  incomes: { title: "ingreso", fields: [
    { key: "name", label: "Fuente (sueldo, alquiler…)", required: true },
    { key: "amount", label: "Monto mensual", type: "number", required: true },
  ] },
  recurring: { title: "gasto fijo", fields: [
    { key: "name", label: "Nombre", required: true },
    { key: "category", label: "Categoría", type: "select", options: CATEGORIES },
    { key: "amount", label: "Monto", type: "number", required: true },
    { key: "freq", label: "Frecuencia", type: "select", options: FREQS, default: 1 },
    { key: "day", label: "Día de vencimiento", type: "number", min: 1, step: 1, default: 1 },
  ] },
  expenses: { title: "gasto", fields: [
    { key: "date", label: "Fecha", type: "date", required: true, default: today() },
    { key: "desc", label: "Descripción", required: true },
    { key: "category", label: "Categoría", type: "select", options: CATEGORIES },
    { key: "amount", label: "Monto", type: "number", required: true },
  ] },
  short: { title: "meta de corto plazo", fields: [
    { key: "name", label: "Objetivo (viaje, notebook…)", required: true },
    { key: "target", label: "Monto objetivo", type: "number", required: true },
    { key: "saved", label: "Ya ahorrado", type: "number" },
    { key: "deadline", label: "Fecha límite", type: "date", required: true },
  ] },
  long: { title: "ahorro de largo plazo", fields: [
    { key: "name", label: "Nombre (retiro, casa…)", required: true },
    { key: "initial", label: "Capital inicial", type: "number" },
    { key: "monthly", label: "Aporte mensual", type: "number" },
    { key: "rate", label: "Rendimiento anual estimado (%)", type: "number", default: 5 },
    { key: "years", label: "Plazo (años)", type: "number", min: 1, step: 1, default: 10 },
    { key: "target", label: "Meta (opcional)", type: "number" },
  ] },
  portfolio: { title: "activo", fields: [
    { key: "name", label: "Activo (AAPL, Bono AL30, BTC…)", required: true },
    { key: "type", label: "Tipo", type: "select", options: ASSET_TYPES },
    { key: "invested", label: "Monto invertido", type: "number", required: true },
    { key: "current", label: "Valor actual", type: "number", required: true },
  ] },
};

function addItem(coll) {
  openForm(`Agregar ${COLL[coll].title}`, COLL[coll].fields, null, (v) => state[coll].push({ id: uid(), ...v }));
}
function editItem(coll, id) {
  const item = state[coll].find((x) => x.id === id);
  if (!item) return;
  openForm(`Editar ${COLL[coll].title}`, COLL[coll].fields, item, (v) => Object.assign(item, v));
}
function delItem(coll, id) {
  if (!confirm("¿Eliminar este elemento?")) return;
  state[coll] = state[coll].filter((x) => x.id !== id);
  save(); render();
}

/* ---------- Cálculos ---------- */
function monthData(key) {
  const incomes = sum(state.incomes, (i) => i.amount);
  const fixed = sum(state.recurring, monthlyEq);
  const spot = state.expenses.filter((e) => e.date?.startsWith(key));
  const spotTotal = sum(spot, (e) => e.amount);
  const balance = incomes - fixed - spotTotal;
  const byCat = {};
  state.recurring.forEach((r) => { byCat[r.category] = (byCat[r.category] || 0) + monthlyEq(r); });
  spot.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + num(e.amount); });
  return { incomes, fixed, spot, spotTotal, balance, byCat };
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
  const invested = sum(state.portfolio, (p) => p.invested), current = sum(state.portfolio, (p) => p.current);
  return { invested, current, gain: current - invested, ret: invested ? ((current - invested) / invested) * 100 : 0 };
};

/* ---------- Vistas ---------- */
const TABS = [
  ["resumen", "📊 Resumen"], ["fijos", "🔁 Gastos fijos"], ["gastos", "🧾 Gastos del mes"],
  ["corto", "🎯 Ahorro corto plazo"], ["largo", "🌱 Ahorro largo plazo"], ["portfolio", "📈 Portfolio"],
];

const kpi = (label, value, cls = "") => `<div class="card kpi"><div class="label">${label}</div><div class="value ${cls}">${value}</div></div>`;
const actions = (coll, id) => `<button class="btn sm" data-action="edit" data-coll="${coll}" data-id="${id}">Editar</button> <button class="btn sm danger" data-action="del" data-coll="${coll}" data-id="${id}">✕</button>`;
const empty = (msg) => `<div class="card empty">${msg}</div>`;
const addBtn = (coll, label) => `<button class="btn primary" data-action="add" data-coll="${coll}">+ ${label}</button>`;

function catBars(byCat) {
  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] || 1;
  if (!entries.length) return `<div class="muted">Sin gastos registrados.</div>`;
  return entries.map(([c, v]) => `<div class="cat"><span>${esc(c)}</span><div class="bar"><i style="width:${(v / max) * 100}%"></i></div><span class="num">${money(v)}</span></div>`).join("");
}

function viewResumen() {
  const d = monthData(ui.month), p = portfolioTotals();
  const rate = d.incomes ? (d.balance / d.incomes) * 100 : 0;
  const shortSaved = sum(state.short, (g) => g.saved);
  const longProj = sum(state.long, (g) => projection(g).final);
  return `
  <div class="row"><h2>${monthLabel(ui.month)}</h2><input type="month" id="month" value="${ui.month}"></div>
  <div class="grid">
    ${kpi("Ingresos mensuales", money(d.incomes), "good")}
    ${kpi("Gastos fijos (prom. mensual)", money(d.fixed))}
    ${kpi("Gastos del mes", money(d.spotTotal))}
    ${kpi("Disponible / ahorro", money(d.balance), d.balance >= 0 ? "good" : "bad")}
    ${kpi("Tasa de ahorro", d.incomes ? pct(rate) : "—", rate >= 0 ? "good" : "bad")}
  </div>
  <div class="card"><h2>Gastos por categoría</h2>${catBars(d.byCat)}</div>
  <div class="grid">
    ${kpi("Ahorrado a corto plazo", money(shortSaved))}
    ${kpi("Proyección largo plazo", money(longProj))}
    ${kpi("Portfolio actual", money(p.current))}
    ${kpi("Rendimiento portfolio", `${p.gain >= 0 ? "+" : ""}${money(p.gain)} (${pct(p.ret)})`, p.gain >= 0 ? "good" : "bad")}
  </div>
  <div class="card"><h2>Ingresos mensuales</h2>
    ${state.incomes.length ? `<div class="table-wrap"><table><tbody>${state.incomes.map((i) => `<tr><td>${esc(i.name)}</td><td class="num">${money(i.amount)}</td><td class="act">${actions("incomes", i.id)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="muted">Agregá tus fuentes de ingreso para calcular tu balance.</div>`}
    <p>${addBtn("incomes", "Agregar ingreso")}</p>
  </div>`;
}

function viewFijos() {
  const paid = (r) => (r.paid || {})[ui.month];
  const total = sum(state.recurring, monthlyEq);
  return `
  <div class="row"><h2>Gastos fijos y recurrentes</h2>${addBtn("recurring", "Agregar gasto fijo")}</div>
  <div class="row"><span class="muted">Total mensual equivalente: <b>${money(total)}</b></span><input type="month" id="month" value="${ui.month}"></div>
  ${state.recurring.length ? `<div class="card table-wrap"><table>
    <thead><tr><th>Pagado</th><th>Nombre</th><th>Categoría</th><th>Frecuencia</th><th>Vence</th><th class="num">Monto</th><th class="num">Mensual eq.</th><th></th></tr></thead>
    <tbody>${[...state.recurring].sort((a, b) => num(a.day) - num(b.day)).map((r) => `<tr>
      <td><input type="checkbox" data-action="paid" data-id="${r.id}" ${paid(r) ? "checked" : ""} aria-label="Pagado en ${ui.month}"></td>
      <td>${esc(r.name)}</td><td>${esc(r.category)}</td><td>${FREQS[r.freq] || "Mensual"}</td><td>día ${esc(r.day)}</td>
      <td class="num">${money(r.amount)}</td><td class="num">${money(monthlyEq(r))}</td><td class="act">${actions("recurring", r.id)}</td></tr>`).join("")}</tbody></table></div>`
    : empty("Todavía no cargaste gastos fijos (alquiler, luz, internet, suscripciones…).")}`;
}

function viewGastos() {
  const d = monthData(ui.month);
  const list = [...d.spot].sort((a, b) => b.date.localeCompare(a.date));
  return `
  <div class="row"><h2>Gastos del momento</h2>${addBtn("expenses", "Agregar gasto")}</div>
  <div class="row"><span class="muted">Total del mes: <b>${money(d.spotTotal)}</b></span><input type="month" id="month" value="${ui.month}"></div>
  ${list.length ? `<div class="card table-wrap"><table><thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th class="num">Monto</th><th></th></tr></thead>
    <tbody>${list.map((e) => `<tr><td>${esc(e.date)}</td><td>${esc(e.desc)}</td><td>${esc(e.category)}</td><td class="num">${money(e.amount)}</td><td class="act">${actions("expenses", e.id)}</td></tr>`).join("")}</tbody></table></div>`
    : empty("No hay gastos registrados en este mes.")}`;
}

function viewCorto() {
  return `
  <div class="row"><h2>Metas de ahorro a corto plazo</h2>${addBtn("short", "Nueva meta")}</div>
  ${state.short.length ? state.short.map((g) => {
    const target = num(g.target), saved = num(g.saved), p = target ? Math.min(100, (saved / target) * 100) : 0;
    const months = monthsUntil(g.deadline), left = Math.max(0, target - saved);
    const need = months > 0 ? left / months : left;
    return `<div class="card goal"><h3>${esc(g.name)}</h3>
      <div class="bar good"><i style="width:${p}%"></i></div>
      <div class="meta"><span>${money(saved)} de ${money(target)} (${pct(p)})</span><span>Fecha límite: ${esc(g.deadline)}</span></div>
      <div class="meta"><span>${left === 0 ? "🎉 ¡Meta cumplida!" : months > 0 ? `Ahorrá ${money(need)}/mes durante ${months} mes(es)` : `Vencida · faltan ${money(left)}`}</span>
      <span><button class="btn sm primary" data-action="contribute" data-id="${g.id}">+ Aportar</button> ${actions("short", g.id)}</span></div></div>`;
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
    ${target ? `<line x1="${P}" y1="${y(target)}" x2="${W - P / 2}" y2="${y(target)}" stroke="var(--warn)" stroke-dasharray="5 4"/><text x="${W - P / 2}" y="${y(target) - 4}" text-anchor="end" font-size="11" fill="var(--warn)">Meta</text>` : ""}
    <path d="${line("contributed")}" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="4 3"/>
    <path d="${line("bal")}" fill="none" stroke="var(--good)" stroke-width="3"/>
    <text x="${P}" y="${H - 8}" font-size="11" fill="var(--muted)">Hoy</text>
    <text x="${W - P / 2}" y="${H - 8}" text-anchor="end" font-size="11" fill="var(--muted)">${years} años</text>
  </svg>`;
}

function viewLargo() {
  return `
  <div class="row"><h2>Ahorro e inversión a largo plazo</h2>${addBtn("long", "Nuevo plan")}</div>
  ${state.long.length ? state.long.map((g) => {
    const pr = projection(g), gain = pr.final - pr.contributed, target = num(g.target);
    return `<div class="card goal"><h3>${esc(g.name)}</h3>
      <div class="grid">${kpi("Valor proyectado", money(pr.final), "good")}${kpi("Aportado", money(pr.contributed))}${kpi("Intereses ganados", money(gain), "good")}</div>
      ${chart(pr.points, target)}
      <div class="meta"><span>${money(g.monthly)}/mes · ${pct(g.rate)} anual · ${g.years} años${target ? ` · ${pr.final >= target ? "✅ alcanzás la meta" : `faltarían ${money(target - pr.final)}`}` : ""}</span><span>${actions("long", g.id)}</span></div>
      <div class="muted" style="font-size:.78rem">Línea verde: valor con interés compuesto. Línea gris: lo que aportás. Es una estimación, no una garantía.</div></div>`;
  }).join("") : empty("Simulá tu retiro, la casa propia o la educación de tus hijos con aportes mensuales e interés compuesto.")}`;
}

function viewPortfolio() {
  const t = portfolioTotals();
  const byType = {};
  state.portfolio.forEach((p) => { byType[p.type] = (byType[p.type] || 0) + num(p.current); });
  const types = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const share = (v) => (t.current ? (v / t.current) * 100 : 0);
  return `
  <div class="row"><h2>Mi portfolio financiero</h2>${addBtn("portfolio", "Agregar activo")}</div>
  <div class="grid">
    ${kpi("Valor actual", money(t.current))}${kpi("Invertido", money(t.invested))}
    ${kpi("Ganancia / pérdida", `${t.gain >= 0 ? "+" : ""}${money(t.gain)}`, t.gain >= 0 ? "good" : "bad")}${kpi("Retorno", pct(t.ret), t.gain >= 0 ? "good" : "bad")}
  </div>
  ${state.portfolio.length ? `
  <div class="card"><h2>Distribución por tipo</h2>
    <div class="stack">${types.map(([k, v], i) => `<div title="${esc(k)}" style="width:${share(v)}%;background:${PALETTE[i % PALETTE.length]}"></div>`).join("")}</div>
    ${types.map(([k, v], i) => `<div><span class="dot" style="background:${PALETTE[i % PALETTE.length]}"></span>${esc(k)} — ${pct(share(v))} (${money(v)})</div>`).join("")}</div>
  <div class="card table-wrap"><table><thead><tr><th>Activo</th><th>Tipo</th><th class="num">Invertido</th><th class="num">Actual</th><th class="num">Resultado</th><th></th></tr></thead>
    <tbody>${state.portfolio.map((p) => {
      const g = num(p.current) - num(p.invested), r = num(p.invested) ? (g / num(p.invested)) * 100 : 0;
      return `<tr><td>${esc(p.name)}</td><td>${esc(p.type)}</td><td class="num">${money(p.invested)}</td><td class="num">${money(p.current)}</td>
      <td class="num ${g >= 0 ? "good" : "bad"}">${g >= 0 ? "+" : ""}${money(g)} (${pct(r)})</td><td class="act">${actions("portfolio", p.id)}</td></tr>`;
    }).join("")}</tbody></table></div>` : empty("Registrá tus inversiones (acciones, bonos, cripto, plazo fijo, inmuebles…) para ver su distribución y rendimiento.")}`;
}

const VIEWS = { resumen: viewResumen, fijos: viewFijos, gastos: viewGastos, corto: viewCorto, largo: viewLargo, portfolio: viewPortfolio };

function render() {
  document.getElementById("tabs").innerHTML = TABS.map(([k, l]) => `<button role="tab" data-action="tab" data-tab="${k}" class="${ui.tab === k ? "active" : ""}">${l}</button>`).join("");
  document.getElementById("view").innerHTML = VIEWS[ui.tab]();
  document.getElementById("currency").value = state.settings.currency;
}

/* ---------- Eventos ---------- */
document.getElementById("currency").innerHTML = CURRENCIES.map((c) => `<option>${c}</option>`).join("");
document.getElementById("currency").addEventListener("change", (e) => { state.settings.currency = e.target.value; save(); render(); });

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const { action, coll, id } = el.dataset;
  if (action === "tab") { ui.tab = el.dataset.tab; render(); }
  else if (action === "add") addItem(coll);
  else if (action === "edit") editItem(coll, id);
  else if (action === "del") delItem(coll, id);
  else if (action === "contribute") {
    const g = state.short.find((x) => x.id === id);
    openForm(`Aporte a "${g.name}"`, [{ key: "amount", label: "Monto aportado (negativo para retirar)", type: "number", min: -1e12, required: true }], null, (v) => { g.saved = Math.max(0, num(g.saved) + v.amount); });
  } else if (action === "export") {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
    a.download = `finanzas-${today()}.json`; a.click(); URL.revokeObjectURL(a.href);
  }
});

document.addEventListener("change", (e) => {
  if (e.target.id === "month" && e.target.value) { ui.month = e.target.value; render(); }
  else if (e.target.dataset.action === "paid") {
    const r = state.recurring.find((x) => x.id === e.target.dataset.id);
    r.paid = { ...(r.paid || {}), [ui.month]: e.target.checked };
    save();
  }
});

document.getElementById("import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== "object" || !Array.isArray(data.expenses)) throw new Error("formato");
    if (!confirm("Esto reemplaza los datos actuales. ¿Continuar?")) return;
    state = { ...emptyState(), ...data }; save(); render();
  } catch { alert("El archivo no es un respaldo válido."); }
  e.target.value = "";
});

render();
