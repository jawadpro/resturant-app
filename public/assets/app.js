/* MFD Books — browser app. All data comes from and goes to the Laravel API; the server checks every permission. */
(() => {
'use strict';

/* ---------- state ---------- */
let TODAY = '', FIRST = '', CFG = null, ME = null, NIGHTS = {}, PAY = null, ACT = [], USERS = [], LASTCOUNT = null, PENDING = 0;
let INC = [], EXP = [], EXPK = {}, INCK = {}, MONTHS = [];
const UI = { lang: 'en', view: 'dash', month: '', date: '', rep: { type: 'daily', from: '', to: '' }, preview: null, loginMsg: '' };
try { UI.lang = localStorage.getItem('mfd-lang') || 'en'; } catch (e) {}

/* ---------- utils ---------- */
const uid = () => Math.random().toString(36).slice(2, 12);
const n0 = v => (typeof v === 'number' && isFinite(v)) ? v : 0;
const fmt = v => (v < 0 ? '−' : '') + '฿' + Math.abs(Math.round(v)).toLocaleString('en-US');
const fmtN = v => (v < 0 ? '−' : '') + Math.abs(Math.round(v)).toLocaleString('en-US');
const pct = v => (v != null && isFinite(v)) ? (v * 100).toFixed(1) + '%' : '—';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const dS = o => o.toISOString().slice(0, 10);
const addD = (s, n) => { const o = dO(s); o.setUTCDate(o.getUTCDate() + n); return dS(o); };
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], DOW_TH = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const th = () => UI.lang === 'th';
const longD = s => { const o = dO(s); return th() ? `${DOW_TH[o.getUTCDay()]} ${o.getUTCDate()} ${MON_TH[o.getUTCMonth()]} ${o.getUTCFullYear() + 543}` : `${DOW[o.getUTCDay()]} ${o.getUTCDate()} ${MON[o.getUTCMonth()]} ${o.getUTCFullYear()}`; };
const shortD = s => { const o = dO(s); return `${o.getUTCDate()} ${MON[o.getUTCMonth()]}`; };
const monL = ym => { const [y, m] = ym.split('-').map(Number); return `${MON[m - 1]} ${y}`; };
const cn = c => th() ? c.th : c.en;
const initials = n => String(n || '?').split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
const ROLE = { owner: 'Owner', manager: 'Manager', staff: 'Staff' };
const ST = { draft: 'Being filled in', submitted: 'Waiting for approval', approved: 'Approved', closed: 'Closed', missing: 'Nothing entered' };
const ST_TH = { draft: 'กำลังกรอก', submitted: 'รออนุมัติ', approved: 'อนุมัติแล้ว', closed: 'ร้านปิด', missing: 'ไม่มีข้อมูล' };
const MGR = () => CFG.manager, OWN = () => CFG.owner;
const paidLabel = k => k === 'owner' ? (th() ? `${OWN()} จ่ายให้` : `Paid by ${OWN()}`) : (th() ? CFG.paid[k].th : CFG.paid[k].en);

/* ---------- API ---------- */
function csrf() { return document.querySelector('meta[name="csrf-token"]').content; }
function setCsrf(t) { if (t) document.querySelector('meta[name="csrf-token"]').content = t; }
async function api(method, url, body, form) {
  const opt = { method, credentials: 'same-origin', headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf(), 'X-Requested-With': 'XMLHttpRequest' } };
  if (form) opt.body = form; else if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  let r;
  try { r = await fetch(url, opt); } catch (e) { throw new Error(th() ? 'ไม่มีอินเทอร์เน็ต ลองอีกครั้ง' : 'No connection. Check the internet and try again.'); }
  let j = {}; try { j = await r.json(); } catch (e) {}
  if ((r.status === 401 || r.status === 419) && !url.startsWith('/login')) { ME = null; UI.loginMsg = 'Your session ended. Sign in again.'; render(); throw new Error('Signed out'); }
  if (!r.ok) { const er = new Error(j.message && !j.errors ? j.message : (j.errors ? Object.values(j.errors)[0][0] : 'Something went wrong. Try again.')); er.status = r.status; throw er; }
  return j;
}
async function load() {
  const b = await api('GET', '/api/bootstrap');
  TODAY = b.today; CFG = b.config; ME = b.me; NIGHTS = b.nights || {}; PAY = b.payroll || null; ACT = b.activity || []; USERS = b.users || []; LASTCOUNT = b.lastCount ?? null; PENDING = b.pendingUpdates || 0;
  FIRST = b.firstDate || TODAY;
  INC = CFG.income; EXP = CFG.expenses.map(c => ({ ...c, g: c.group })); EXPK = Object.fromEntries(EXP.map(c => [c.k, c])); INCK = Object.fromEntries(INC.map(c => [c.k, c]));
  MONTHS = []; { let [y, m] = FIRST.slice(0, 7).split('-').map(Number); const [ty, tm] = TODAY.slice(0, 7).split('-').map(Number); while (y < ty || (y === ty && m <= tm)) { MONTHS.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } } }
  if (!UI.month || !MONTHS.includes(UI.month)) UI.month = TODAY.slice(0, 7);
  if (!UI.rep.from) { UI.rep.from = TODAY.slice(0, 8) + '01'; UI.rep.to = TODAY; }
  if (!UI.date) UI.date = TODAY;
}
async function reload() { await load(); render(); }

/* ---------- calculations (same as app/Support/Books.php) ---------- */
function dayCalc(d) {
  const sales = Object.values(d.inc || {}).reduce((a, b) => a + n0(b), 0); let pl = 0, capex = 0, till = 0;
  for (const l of d.exp || []) { const a = n0(l.amt), g = (EXPK[l.cat] || {}).g; if (g === 'capital') capex += a; else if (g !== 'advance') pl += a; if (l.paid === 'till') till += a; }
  const cashSales = sales - n0(d.qr) - n0(d.card) - n0(d.grab);
  const expected = d.float == null ? null : n0(d.float) + cashSales - till - n0(d.banked);
  const variance = (expected == null || d.counted == null || d.counted === '') ? null : n0(d.counted) - expected;
  return { sales, pl, capex, till, cashSales, expected, variance, net: sales - pl };
}
const statusOf = date => { const d = NIGHTS[date]; if (d) return d.status; if (date >= FIRST && date < TODAY) return 'missing'; return 'empty'; };
function monthAgg(ym, upto) {
  const [y, m] = ym.split('-').map(Number), n = Math.min(daysIn(y, m), upto || 99);
  const a = { sales: 0, pl: 0, capex: 0, inc: {}, exp: {}, nights: 0, missing: [], pending: [], daily: [] };
  for (let i = 1; i <= n; i++) {
    const ds = `${ym}-${String(i).padStart(2, '0')}`, d = NIGHTS[ds], st = statusOf(ds);
    if (st === 'missing') a.missing.push(ds);
    if (!d || d.status === 'closed' || d.status === 'draft') { a.daily.push(null); continue; }
    if (d.status === 'submitted') a.pending.push(ds);
    const c = dayCalc(d); a.sales += c.sales; a.pl += c.pl; a.capex += c.capex; if (c.sales > 0) a.nights++;
    for (const [k, v] of Object.entries(d.inc || {})) a.inc[k] = (a.inc[k] || 0) + n0(v);
    for (const l of d.exp) if (!(EXPK[l.cat] || {}).g) a.exp[l.cat] = (a.exp[l.cat] || 0) + n0(l.amt);
    a.daily.push({ d: i, sales: c.sales, exp: c.pl });
  }
  a.net = a.sales - a.pl; a.margin = a.sales ? a.net / a.sales : NaN; a.avg = a.nights ? a.sales / a.nights : 0; return a;
}
function payCalc(r) {
  const half = r.m / 2, daily = r.m * 12 / 365, gross = Math.max(0, half - n0(r.abs) * daily - n0(r.fine)); let left = gross;
  const rent = Math.min(n0(r.rent), left); left -= rent; const elec = Math.min(n0(r.elec), left); left -= elec; const adv = Math.min(n0(r.adv), left); left -= adv;
  return { half, daily, absDed: n0(r.abs) * daily, gross, rent, elec, adv, carry: n0(r.rent) + n0(r.elec) + n0(r.adv) - rent - elec - adv, pay: left };
}
function newDay(date) {
  return { date, inc: {}, qr: null, card: null, grab: null, banked: null, float: date === TODAY ? LASTCOUNT : null, counted: null, status: 'draft', by: ME.name, note: '',
    exp: [{ id: uid(), cat: 'staffcomm', amt: null, note: '', paid: 'till', receipt: null, auto: true }], _new: true };
}

/* ---------- autosave ---------- */
const SAVE = { timer: null, busy: false, again: false, state: 'saved', ver: 0, dirty: false };
function payload(d) { return { inc: d.inc, exp: d.exp.map(l => ({ id: l.id, cat: l.cat, amt: l.amt, paid: l.paid, note: l.note, auto: !!l.auto })), qr: d.qr, card: d.card, grab: d.grab, banked: d.banked, float: d.float, counted: d.counted, note: d.note }; }
function setSaveState(s) { SAVE.state = s; const e = document.getElementById('savestate'); if (e) e.textContent = s === 'saving' ? (th() ? 'กำลังบันทึก…' : 'Saving…') : s === 'error' ? (th() ? 'บันทึกไม่สำเร็จ' : 'Not saved, retrying…') : (th() ? 'บันทึกแล้ว ✓' : 'Saved ✓'); }
function queueSave() { SAVE.ver++; SAVE.dirty = true; setSaveState('saving'); clearTimeout(SAVE.timer); SAVE.timer = setTimeout(saveNow, 700); }
async function saveNow() {
  clearTimeout(SAVE.timer);
  const date = UI.date, d = NIGHTS[date]; if (!d) return;
  if (SAVE.busy) { SAVE.again = true; return SAVE.wait; }
  if (!SAVE.dirty) return;
  SAVE.busy = true; SAVE.dirty = false; const ver = SAVE.ver;
  SAVE.wait = (async () => {
    try {
      const r = await api('PUT', `/api/nights/${date}`, payload(d));
      const cur = NIGHTS[date];
      if (cur && SAVE.ver === ver) NIGHTS[date] = r.night;
      else if (cur) { const rec = Object.fromEntries(r.night.exp.map(l => [l.id, l.receipt])); cur.exp.forEach(l => { if (l.id in rec && typeof rec[l.id] === 'string') l.receipt = rec[l.id]; }); delete cur._new; }
      setSaveState('saved');
    } catch (e) { if (e.message !== 'Signed out') { toast(e.message); if (e.status === 409 || e.status === 403 || e.status === 422) { setSaveState('saved'); await reload(); } else { SAVE.dirty = true; setSaveState('error'); SAVE.timer = setTimeout(saveNow, 4000); } } }
    finally { SAVE.busy = false; if (SAVE.again) { SAVE.again = false; SAVE.dirty = true; await saveNow(); } }
  })();
  return SAVE.wait;
}

/* ---------- icons ---------- */
const I = {
  dash: '<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/>', night: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.5 3 5.2"/>',
  rep: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>', users: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.4 4.2-6.5 8-6.5s7 2.1 8 6.5"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>', up: '<path d="M4 17l6-6 4 4 6-7"/><path d="M15 8h5v5"/>', down: '<path d="M4 7l6 6 4-4 6 7"/><path d="M15 16h5v-5"/>',
  rcpt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>', chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>', box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', wallet: '<path d="M4 7h14a2 2 0 0 1 2 2v9H6a2 2 0 0 1-2-2z"/><path d="M4 7l11-3v3M16 13h2"/>',
  out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>', dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', key: '<circle cx="8" cy="14" r="4"/><path d="M11 11l9-9M16 6l3 3"/>'
};
const ic = (k, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`;
const pill = st => `<span class="pill p-${st}">${th() ? ST_TH[st] : ST[st]}</span>`;
const REPORTS = {
  daily: ['Daily summary', 'One row per night: sales, payments, costs, profit and cash count.', 'cal'],
  sales: ['Sales by category', 'Sales split by food, bar, staff drinks and other income.', 'up'],
  expenses: ['Expenses list', 'Every payment: category, amount, how it was paid, note and receipt.', 'rcpt'],
  pl: ['Monthly profit & loss', 'Each month’s income and costs by category, with profit and margin.', 'chart'],
  cash: ['Cash counts', 'Opening float, expected cash, counted cash and any shortfall.', 'cash'],
  payroll: ['Payroll', 'The current pay period: gross, deductions and net pay per person.', 'team'],
  all: ['Everything', 'A full export of every night and every line, for a backup or the accountant.', 'box']
};

/* ---------- shell ---------- */
function navItems() {
  if (!ME) return [];
  if (ME.role === 'staff') return [['night', th() ? 'คืนนี้' : 'Tonight', 'night'], ['mine', th() ? 'รายการของฉัน' : 'My entries', 'list']];
  const pend = Object.values(NIGHTS).filter(d => d.status === 'submitted').length;
  const items = [['dash', 'Dashboard', 'dash'], ['entries', 'Daily entries', 'cal', pend], ['payroll', 'Payroll', 'team']];
  if (ME.role === 'owner') items.push(['reports', 'Reports', 'rep'], ['users', 'Users', 'users']);
  return items;
}
function render() {
  const root = document.getElementById('app'); document.documentElement.lang = UI.lang;
  if (!ME) { root.innerHTML = vLogin(); setTimeout(() => document.getElementById('lu')?.focus(), 0); return; }
  const items = navItems(); if (!items.some(i => i[0] === UI.view) && UI.view !== 'entry') UI.view = items[0][0];
  const V = { dash: vDash, entries: vEntries, entry: vEntry, payroll: vPayroll, reports: vReports, users: vUsers, night: vNight, mine: vMine }[UI.view];
  const [title, sub, body] = V();
  const cur = v => UI.view === v || (UI.view === 'entry' && v === (ME.role === 'staff' ? 'mine' : 'entries'));
  const menu = items.map(([v, l, i, b]) => `<button data-act="go" data-v="${v}" ${cur(v) ? 'aria-current="page"' : ''}>${ic(i)}<span>${l}</span>${b ? `<span class="badge">${b}</span>` : ''}</button>`).join('');
  const langSeg = `<div class="seg" role="group" aria-label="Language"><button data-act="lang" data-v="en" aria-pressed="${UI.lang === 'en'}">EN</button><button data-act="lang" data-v="th" aria-pressed="${UI.lang === 'th'}">ไทย</button></div>`;
  root.innerHTML = `<div class="outer"><div class="frame">
    <aside class="side"><div class="logo"><span class="m"><i></i><i></i><i></i><i></i></span>MFD Books</div>
      <nav class="menu" aria-label="Sections">${menu}</nav>
      <div class="who-card"><small>${th() ? 'เข้าสู่ระบบโดย' : 'Signed in as'}</small><b>${esc(ME.name)} · ${ROLE[ME.role]}</b>
        <div class="row" style="gap:6px"><button class="btn sm" data-act="logout">${ic('out', 16)} ${th() ? 'ออกจากระบบ' : 'Sign out'}</button><button class="btn sm ghost" style="color:var(--brand-ink)" data-act="mypw" title="Change password">${ic('key', 16)}</button></div></div></aside>
    <div class="main">
      <div class="mtop"><div class="logo"><span class="m"><i></i><i></i><i></i><i></i></span>MFD Books</div><button class="btn sm ghost" data-act="mypw" aria-label="Change password">${ic('key', 16)}</button><button class="btn sm" data-act="logout">${th() ? 'ออก' : 'Sign out'}</button></div>
      <header class="top"><h1>${title}${sub ? `<span class="sub">${sub}</span>` : ''}</h1>${langSeg}<div class="me"><span class="av">${initials(ME.name)}</span><span class="nm">${esc(ME.name)}</span></div></header>
      <main class="content">${PENDING && ME.role === 'owner' ? `<div class="banner b-warn row between"><span><b>A database update is ready.</b> A new version of the app was uploaded. Apply it so everything works.</span><button class="btn sm pri" data-act="sysupdate">Apply update</button></div>` : ''}${body}</main></div></div></div>
    <nav class="bnav" aria-label="Sections">${items.map(([v, l, i]) => `<button data-act="go" data-v="${v}" ${cur(v) ? 'aria-current="page"' : ''}>${ic(i)}<span>${l}</span></button>`).join('')}</nav>`;
  if (UI.view === 'dash') drawCash();
  if (UI.view === 'reports') loadPreview();
}
function toast(m) { const e = document.getElementById('toast'); e.textContent = m; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, 3200); }
function modal(html) { const m = document.getElementById('modal'); m.innerHTML = `<div class="modal-bg" data-act="mclose"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`; m.hidden = false; }
function closeModal() { const m = document.getElementById('modal'); m.hidden = true; m.innerHTML = ''; }
function confirmModal(title, text, label, fn) {
  modal(`<h3>${title}</h3><p class="muted" style="margin:0">${text}</p><div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="mclose">Cancel</button><button class="btn pri" id="cok">${label}</button></div>`);
  document.getElementById('cok').onclick = async () => { closeModal(); try { await fn(); } catch (e) { toast(e.message); } };
}
async function act(fn) { try { await fn(); } catch (e) { if (e.message !== 'Signed out') toast(e.message); } }

/* ---------- login ---------- */
function vLogin() {
  return `<div class="login"><div class="lbox">
    <div class="lbrand"><div class="logo"><span class="m"><i></i><i></i><i></i><i></i></span>MFD Books</div>
      <h2>The nightly books for ${esc(CFG ? CFG.business : '')}.</h2><p>Staff close the night in a few minutes. The owner sees every baht, approves pay and downloads any report, from anywhere.</p></div>
    <form class="lform" id="loginForm" autocomplete="on">
      <div><h1>Sign in</h1><p class="muted" style="margin:6px 0 0">Everyone uses the same screen. You’ll see the parts that are yours.</p></div>
      <label class="f" for="lu">Username<input type="text" id="lu" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Your username" required></label>
      <label class="f" for="lp">Password<span class="pw"><input type="password" id="lp" name="password" autocomplete="current-password" placeholder="Your password" required><button type="button" data-act="showpw">Show</button></span></label>
      <div class="err" id="lerr" role="alert">${esc(UI.loginMsg)}</div>
      <button class="btn pri" type="submit" id="lbtn" style="padding:12px">Sign in</button>
      <p class="muted small" style="margin:0">Forgot your password? Ask ${esc(CFG ? CFG.owner : 'the owner')} to reset it.</p>
    </form></div></div>`;
}
async function doLogin() {
  const u = document.getElementById('lu').value.trim(), p = document.getElementById('lp').value, el = document.getElementById('lerr'), btn = document.getElementById('lbtn');
  if (!u || !p) { el.textContent = 'Enter your username and password.'; return; }
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const r = await api('POST', '/login', { username: u, password: p }); setCsrf(r.csrf); UI.loginMsg = '';
    await load(); UI.view = ME.role === 'staff' ? 'night' : 'dash'; UI.date = TODAY; render(); toast(`Welcome, ${ME.name}`);
  } catch (e) { el.textContent = e.message; btn.disabled = false; btn.textContent = 'Sign in'; document.getElementById('lp').select(); }
}

/* ---------- dashboard ---------- */
function vDash() {
  const ym = UI.month, i = MONTHS.indexOf(ym), a = monthAgg(ym), part = ym === TODAY.slice(0, 7), upto = part ? +TODAY.slice(8) : null, p = i > 0 ? monthAgg(MONTHS[i - 1], upto) : null;
  const vs = p ? `vs ${part ? '1–' + upto + ' ' : ''}${MON[+MONTHS[i - 1].slice(5) - 1]}` : '';
  const dl = (c, pv, good = true) => { if (!p || !pv || !isFinite(c) || !isFinite(pv)) return ''; const d = (c / pv - 1) * 100, up = d >= 0; return `<span class="delta ${(up === good) ? 'd-up' : 'd-down'}">${up ? '↗' : '↘'} ${Math.abs(d).toFixed(1)}%</span>`; };
  const pend = Object.keys(NIGHTS).filter(k => NIGHTS[k].status === 'submitted').sort();
  const noR = []; for (const [k, d] of Object.entries(NIGHTS)) if (d.status !== 'approved') for (const l of d.exp) if (l.receipt === false && n0(l.amt) >= CFG.receiptFlag) noR.push(k);
  const owed = Object.values(NIGHTS).reduce((s, d) => s + d.exp.filter(l => l.paid === 'owner').reduce((x, l) => x + n0(l.amt), 0), 0);
  const attn = [];
  if (pend.length) attn.push(`<button data-act="go" data-v="entries"><span class="dot" style="background:var(--warn-soft);color:var(--warn)">${pend.length}</span><span><b>Waiting for approval</b><span class="t">${pend.map(shortD).join(', ')}</span></span></button>`);
  if (a.missing.length) attn.push(`<button data-act="go" data-v="entries"><span class="dot" style="background:var(--crit-soft);color:var(--crit)">${a.missing.length}</span><span><b>Nights with nothing entered</b><span class="t">${a.missing.slice(0, 12).map(shortD).join(', ')}${a.missing.length > 12 ? '…' : ''}</span></span></button>`);
  if (noR.length) attn.push(`<button data-act="go" data-v="entries"><span class="dot" style="background:var(--warn-soft);color:var(--warn)">${noR.length}</span><span><b>Expenses over ฿${CFG.receiptFlag} without a receipt</b><span class="t">${[...new Set(noR)].map(shortD).join(', ')}</span></span></button>`);
  if (!attn.length) attn.push(`<div class="banner b-good">All caught up.</div>`);
  const costs = Object.entries(a.exp).sort((x, y) => y[1] - x[1]); const top = costs.slice(0, 5); const rest = costs.slice(5).reduce((s, x) => s + x[1], 0); if (rest) top.push(['__o', rest]);
  const margin = isFinite(a.margin) ? Math.max(0, a.margin) : 0, R = 58, C = 2 * Math.PI * R;
  const recent = Object.keys(NIGHTS).filter(k => k.startsWith(ym)).sort().reverse().slice(0, 6);
  const quick = [['entries', 'Review', 'check'], ['reports', 'Reports', 'dl'], ['adduser', 'Add user', 'plus'], ['payroll', 'Payroll', 'team']].filter(q => ME.role === 'owner' || !['reports', 'adduser'].includes(q[0]));
  const body = `
  <div class="chips" role="group" aria-label="Month">${MONTHS.map(m => `<button data-act="month" data-v="${m}" aria-pressed="${m === ym}">${monL(m)}</button>`).join('')}</div>
  <div class="dash">
    <div class="col">
      <div class="hero"><div class="logo"><span class="m"><i></i><i></i><i></i><i></i></span>${esc(CFG.business)}</div>
        <div><small>Profit · ${monL(ym)}${part ? ' so far' : ''}</small><div class="big tn">${fmt(a.net)}</div></div>
        <div class="foot"><span>${a.nights} nights open</span><span>${fmt(Math.round(margin * 100))} kept per ฿100 sold</span></div></div>
      <div class="quick" style="grid-template-columns:repeat(${quick.length},1fr)">${quick.map(([v, l, i]) => `<button data-act="${v === 'adduser' ? 'adduser' : 'go'}" data-v="${v}"><span class="ic">${ic(i, 18)}</span>${l}</button>`).join('')}</div>
      <section class="card"><div class="card-h"><h2>Needs attention</h2></div><div class="attn">${attn.join('')}</div></section>
      <section class="card"><div class="card-h"><h2>Owed to ${esc(OWN())}</h2><span class="pill p-info">Bills ${esc(OWN())} paid</span></div><div style="font-size:24px;font-weight:700" class="tn">${fmt(owed)}</div><p class="muted small" style="margin:4px 0 0">Expenses marked as “Paid by ${esc(OWN())}”.</p></section>
    </div>
    <div class="col">
      <div class="kpis">
        <div class="card kpi"><div class="head"><span class="ic">${ic('up', 18)}</span>${dl(a.sales, p?.sales)}</div><div class="v tn">${fmt(a.sales)}</div><div class="l">Total sales <span class="xs">${vs}</span></div></div>
        <div class="card kpi"><div class="head"><span class="ic">${ic('down', 18)}</span>${dl(a.pl, p?.pl, false)}</div><div class="v tn">${fmt(a.pl)}</div><div class="l">Total costs <span class="xs">${vs}</span></div></div>
        <div class="card kpi"><div class="head"><span class="ic">${ic('wallet', 18)}</span>${dl(a.avg, p?.avg)}</div><div class="v tn">${fmt(a.avg)}</div><div class="l">Average night <span class="xs">${vs}</span></div></div>
      </div>
      <section class="card"><div class="card-h"><div><h2>Sales and costs</h2><div class="muted small">Every month</div></div><div class="legend"><span><i style="background:var(--s1)"></i>Sales</span><span><i style="background:var(--s2)"></i>Costs</span></div></div>
        <div class="chart" id="cash"></div>
        <details style="margin-top:6px"><summary class="small" style="cursor:pointer;color:var(--s1);font-weight:600">Show as table</summary><div class="tbl"><table><thead><tr><th>Month</th><th class="n">Sales</th><th class="n">Costs</th><th class="n">Profit</th></tr></thead><tbody>${MONTHS.map(m => { const x = monthAgg(m); return `<tr><td>${monL(m)}</td><td class="n">${fmtN(x.sales)}</td><td class="n">${fmtN(x.pl)}</td><td class="n">${fmtN(x.net)}</td></tr>`; }).join('')}</tbody></table></div></details></section>
      <section class="card"><div class="card-h"><h2>Recent nights</h2><button class="btn sm" data-act="go" data-v="entries">See all</button></div>
        ${recent.length ? `<div class="tbl"><table><thead><tr><th>Night</th><th>Entered by</th><th class="n">Sales</th><th class="n">Costs</th><th>Status</th></tr></thead><tbody>
        ${recent.map(k => { const d = NIGHTS[k], c = dayCalc(d); return `<tr class="click" data-act="open" data-v="${k}"><td><b>${shortD(k)}</b><span class="s2">${DOW[dO(k).getUTCDay()]}</span></td><td>${esc(d.by || '')}</td><td class="n">${fmtN(c.sales)}</td><td class="n">${fmtN(c.pl)}</td><td>${pill(d.status)}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted">No nights entered this month yet.</p>'}</section>
    </div>
    <div class="col c3">
      <section class="card"><div class="card-h"><h2>Where the money goes</h2><span class="muted small">${monL(ym)}</span></div>
        <div class="ring-wrap"><svg width="168" height="168" viewBox="0 0 168 168" aria-hidden="true"><circle cx="84" cy="84" r="${R}" fill="none" stroke="var(--s2)" stroke-width="20"/><circle cx="84" cy="84" r="${R}" fill="none" stroke="var(--s1)" stroke-width="20" stroke-dasharray="${(margin * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 84 84)"/></svg>
          <div class="c"><small>Profit kept</small><b class="tn">${pct(a.margin)}</b><small>of sales</small></div></div>
        <div class="legend" style="justify-content:center;margin-bottom:14px"><span><i style="background:var(--s1)"></i>Profit ${fmt(a.net)}</span><span><i style="background:var(--s2)"></i>Costs ${fmt(a.pl)}</span></div>
        <div class="costs">${top.map(([k, v]) => `<div class="r"><span class="pct tn">${a.pl ? Math.round(v / a.pl * 100) : 0}%</span><span>${k === '__o' ? 'Everything else' : esc(EXPK[k]?.en || k)}</span><span class="tn">${fmt(v)}</span></div>`).join('')}</div></section>
      <section class="card"><div class="card-h"><h2>Recent activity</h2></div><div class="feed">${ACT.slice(0, 7).map(x => `<div class="it"><span class="av sm">${initials(x.who)}</span><div><p><b>${esc(x.who)}</b> ${esc(x.text)}</p><small>${shortD(x.t.slice(0, 10))} · ${x.t.slice(11)}</small></div></div>`).join('') || '<p class="muted small">Nothing yet.</p>'}</div></section>
    </div>
  </div>`;
  return [ME.role === 'owner' ? `Hello, ${esc(ME.name)}` : 'Dashboard', `${monL(ym)}${part ? ' so far' : ''}`, body];
}
function niceMax(v) { if (v <= 0) return 1000; const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
function drawCash() {
  const el = document.getElementById('cash'); if (!el) return; const data = MONTHS.slice(-12).map(m => ({ m, ...monthAgg(m) }));
  const W = Math.max(300, el.clientWidth || 600), H = 240, P = { l: 46, r: 6, t: 12, b: 26 }, iw = W - P.l - P.r, ih = H - P.t - P.b;
  const mx = niceMax(Math.max(1, ...data.map(d => Math.max(d.sales, d.pl)))), mid = P.t + ih / 2, sc = v => v / mx * (ih / 2);
  const bw = iw / data.length, barW = Math.min(34, bw * 0.48); let g = '', bars = '', hits = '';
  for (const v of [mx, mx / 2, 0, -mx / 2, -mx]) { const y = mid - sc(v); g += `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" stroke="${v === 0 ? '#C9D2C6' : '#EDF1EA'}" stroke-width="1"/><text x="${P.l - 8}" y="${y + 3.5}" text-anchor="end">${v === 0 ? '0' : (v < 0 ? '−' : '') + Math.abs(v / 1000) + 'k'}</text>`; }
  data.forEach((d, i) => {
    const cx = P.l + bw * i + bw / 2, x = cx - barW / 2, hs = sc(d.sales), hc = sc(d.pl), r = Math.min(6, barW / 2, hs, hc || 6), sel = d.m === UI.month;
    if (hs > 0) bars += `<path d="M${x},${mid - 1} L${x},${mid - hs + r} Q${x},${mid - hs} ${x + r},${mid - hs} L${x + barW - r},${mid - hs} Q${x + barW},${mid - hs} ${x + barW},${mid - hs + r} L${x + barW},${mid - 1} Z" fill="var(--s1)" opacity="${sel ? 1 : .82}"/>`;
    if (hc > 0) bars += `<path d="M${x},${mid + 1} L${x},${mid + hc - r} Q${x},${mid + hc} ${x + r},${mid + hc} L${x + barW - r},${mid + hc} Q${x + barW},${mid + hc} ${x + barW},${mid + hc - r} L${x + barW},${mid + 1} Z" fill="var(--s2)" opacity="${sel ? 1 : .82}"/>`;
    g += `<text x="${cx}" y="${H - 6}" text-anchor="middle" style="font-weight:${sel ? 700 : 400};fill:${sel ? 'var(--ink)' : 'var(--muted)'}">${MON[+d.m.slice(5) - 1]}</text>`;
    hits += `<rect x="${P.l + bw * i}" y="${P.t}" width="${bw}" height="${ih}" fill="transparent" data-i="${i}" style="cursor:pointer"/>`;
  });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly sales above the line and costs below">${g}${bars}<g id="hl"></g>${hits}</svg><div class="tip" id="tip" hidden></div>`;
  const svg = el.querySelector('svg'), tip = el.querySelector('#tip'), hl = el.querySelector('#hl');
  svg.addEventListener('pointermove', e => { const t = e.target.closest('rect[data-i]'); if (!t) return; const i = +t.dataset.i, d = data[i];
    tip.hidden = false; tip.innerHTML = `<b>${monL(d.m)}</b><div class="r"><span>Sales</span><span>${fmt(d.sales)}</span></div><div class="r"><span>Costs</span><span>${fmt(d.pl)}</span></div><div class="r"><span>Profit</span><b>${fmt(d.net)}</b></div>`;
    hl.innerHTML = `<rect x="${P.l + bw * i + 4}" y="${P.t}" width="${bw - 8}" height="${ih}" rx="10" fill="rgba(14,122,74,.06)"/>`;
    const s = el.clientWidth / W, px = (P.l + bw * i + bw / 2) * s, tw = tip.offsetWidth || 160; tip.style.left = Math.min(Math.max(0, px - tw / 2), el.clientWidth - tw) + 'px'; tip.style.top = '-8px'; tip.style.transform = 'translateY(-100%)'; });
  svg.addEventListener('pointerleave', () => { tip.hidden = true; hl.innerHTML = ''; });
  svg.addEventListener('click', e => { const t = e.target.closest('rect[data-i]'); if (t) { UI.month = data[+t.dataset.i].m; render(); } });
}

/* ---------- daily entries ---------- */
function vEntries() {
  const ym = UI.month, [y, m] = ym.split('-').map(Number), n = daysIn(y, m), rows = []; let cA = 0, cW = 0, cM = 0;
  for (let i = n; i >= 1; i--) {
    const ds = `${ym}-${String(i).padStart(2, '0')}`; if (ds > TODAY) continue; const d = NIGHTS[ds], st = statusOf(ds);
    if (st === 'approved') cA++; if (st === 'submitted') cW++; if (st === 'missing') cM++;
    if (!d) { if (ds < FIRST && ds !== TODAY) continue;
      rows.push(`<tr><td><b>${shortD(ds)}</b><span class="s2">${DOW[dO(ds).getUTCDay()]}</span></td><td class="muted">—</td><td class="n">—</td><td class="n">—</td><td class="n">—</td><td>${pill(ds === TODAY ? 'draft' : 'missing')}</td><td class="n"><button class="btn sm" data-act="startday" data-v="${ds}">Add entry</button> <button class="btn sm ghost" data-act="closeday" data-v="${ds}">Mark closed</button></td></tr>`); continue; }
    const c = dayCalc(d);
    rows.push(`<tr class="click" data-act="open" data-v="${ds}"><td><b>${shortD(ds)}</b><span class="s2">${DOW[dO(ds).getUTCDay()]}</span></td><td>${esc(d.by || '')}</td><td class="n">${d.status === 'closed' ? '—' : fmtN(c.sales)}</td><td class="n">${d.status === 'closed' ? '—' : fmtN(c.pl)}</td><td class="n">${c.variance == null ? '<span class="muted">—</span>' : Math.abs(c.variance) <= 20 ? '<span style="color:var(--good)">OK</span>' : `<span class="neg">${fmt(c.variance)}</span>`}</td><td>${pill(d.status)}</td><td class="n"><button class="btn sm ${d.status === 'submitted' ? 'pri' : ''}">${d.status === 'submitted' ? 'Review' : 'Open'}</button></td></tr>`);
  }
  const body = `<div class="chips" role="group" aria-label="Month">${MONTHS.map(x => `<button data-act="month" data-v="${x}" aria-pressed="${x === ym}">${monL(x)}</button>`).join('')}</div>
    <div class="row"><span class="pill p-approved">${cA} approved</span><span class="pill p-submitted">${cW} waiting</span><span class="pill p-missing">${cM} nothing entered</span></div>
    <section class="card">${rows.length ? `<div class="tbl"><table><thead><tr><th>Night</th><th>Entered by</th><th class="n">Sales</th><th class="n">Costs</th><th class="n">Till</th><th>Status</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table></div>` : '<p class="muted">No nights in this month yet.</p>'}</section>`;
  return ['Daily entries', 'Every night of the month. Open one to check and approve it.', body];
}

/* ---------- entry form ---------- */
function canEdit(d) { if (!d) return false; if (ME.role === 'staff') return d.status === 'draft' && UI.date === TODAY; return d.status === 'draft' || d.status === 'submitted'; }
const mi = (id, v, dis, attrs = '') => `<div class="money"><input type="number" inputmode="decimal" min="0" step="any" id="${id}" value="${v == null || v === '' ? '' : v}" ${dis ? 'disabled' : ''} ${attrs} placeholder="0"></div>`;
function entryForm(date) {
  const d = NIGHTS[date], ed = canEdit(d), c = dayCalc(d), T = th();
  const drinks = CFG.drinkPrice ? n0(d.inc.staff) / CFG.drinkPrice : 0;
  const sales = INC.map(x => `<div class="fl"><label for="inc-${x.k}">${cn(x)}${!T ? `<small>${x.th}</small>` : ''}${x.k === 'staff' ? `<span class="hint" id="drinks">${Number.isInteger(drinks) && drinks > 0 ? `${drinks} ${T ? 'แก้ว' : 'drinks'} × ฿${CFG.drinkPrice}` : ''}</span>` : ''}</label>${mi('inc-' + x.k, d.inc[x.k], !ed, `data-f="inc" data-k="${x.k}"`)}</div>`).join('');
  const cats = EXP.filter(x => !x.legacy || d.exp.some(l => l.cat === x.k));
  const lines = d.exp.map(l => {
    const fl = [];
    if (l.auto) fl.push(`<span class="pill p-lime">${T ? 'คำนวณอัตโนมัติ' : 'Automatic'}: ${(CFG.commRate * 100).toFixed(1)}% ${T ? 'ของยอดเครื่องดื่มพนักงาน' : 'of staff drinks'}</span>`);
    if (l.paid === 'owner') fl.push(`<span class="pill p-info">${T ? `เพิ่มในยอดที่ค้าง${esc(OWN())}` : `Added to what’s owed to ${esc(OWN())}`}</span>`);
    if (l.receipt === false && n0(l.amt) >= CFG.receiptFlag) fl.push(`<span class="pill p-submitted">${T ? 'ไม่มีใบเสร็จ' : `No receipt for ฿${CFG.receiptFlag}+`}</span>`);
    let rc = '';
    if (typeof l.receipt === 'string') rc = `<a class="rc has" href="${esc(l.receipt)}" target="_blank" rel="noopener">${T ? 'ใบเสร็จ ✓' : 'Receipt ✓'}</a>${ed ? `<label class="rc" title="Replace photo">${T ? 'เปลี่ยน' : 'Replace'}<input type="file" accept="image/*" capture="environment" data-rcpt="${l.id}"></label>` : ''}`;
    else if (l.receipt === false && ed) rc = `<label class="rc">${T ? 'ถ่ายรูปใบเสร็จ' : 'Add receipt photo'}<input type="file" accept="image/*" capture="environment" data-rcpt="${l.id}"></label>`;
    else if (l.receipt === false) rc = `<span class="rc">${T ? 'ไม่มีใบเสร็จ' : 'No receipt'}</span>`;
    return `<div class="xl"><div class="cat"><select aria-label="Category" data-lf="cat" data-id="${l.id}" ${!ed || l.auto ? 'disabled' : ''}>${cats.map(x => `<option value="${x.k}" ${x.k === l.cat ? 'selected' : ''}>${esc(cn(x))}</option>`).join('')}</select></div>
      <div>${mi('amt-' + l.id, l.amt, !ed, `data-lf="amt" data-id="${l.id}" aria-label="Amount"`)}</div>
      <div><select aria-label="Paid from" data-lf="paid" data-id="${l.id}" ${!ed ? 'disabled' : ''}>${Object.keys(CFG.paid).map(k => `<option value="${k}" ${l.paid === k ? 'selected' : ''}>${esc(paidLabel(k))}</option>`).join('')}</select></div>
      <div class="acts">${rc}${ed ? `<button class="del" data-act="delline" data-id="${l.id}" aria-label="Remove">✕</button>` : ''}</div>
      <div class="note"><input type="text" maxlength="500" data-lf="note" data-id="${l.id}" value="${esc(l.note)}" placeholder="${T ? 'ซื้ออะไร (ร้าน / รายการ)' : 'What was it for? (shop, item)'}" ${!ed ? 'disabled' : ''} aria-label="Note"></div>
      <div class="flags">${fl.join('')}</div></div>`;
  }).join('');
  const H = (n, t, h, r = '') => `<div class="card-h"><h2><span class="step">${n}</span>${t}</h2>${r}</div><p class="help">${h}</p>`;
  return `<div class="formgrid">
      <section class="card">${H(1, T ? 'ยอดขาย' : 'Sales', T ? 'ใส่ยอดรวมคืนนี้ของแต่ละประเภท' : 'Tonight’s total for each kind of sale.', `<b class="tn" id="o-sales">${fmt(c.sales)}</b>`)}${sales}</section>
      <div style="display:flex;flex-direction:column;gap:18px">
      <section class="card">${H(2, T ? 'ลูกค้าจ่ายด้วย' : 'How customers paid', T ? 'ใส่เฉพาะ QR บัตร และ Grab ระบบคิดเงินสดให้' : 'Only QR, card and Grab. Cash is worked out for you.')}
        <div class="fl"><label for="f-qr">QR / PromptPay</label>${mi('f-qr', d.qr, !ed, 'data-f="qr"')}</div>
        <div class="fl"><label for="f-card">${T ? 'บัตรเครดิต' : 'Card'}</label>${mi('f-card', d.card, !ed, 'data-f="card"')}</div>
        <div class="fl"><label for="f-grab">Grab<small>${T ? 'ยอดที่ Grab จ่ายให้ร้าน' : 'Orders paid through the Grab app'}</small></label>${mi('f-grab', d.grab, !ed, 'data-f="grab"')}</div>
        <div class="calc"><span>${T ? 'ขายเงินสด' : 'Cash sales'}</span><b class="v" id="o-cs">${fmt(c.cashSales)}</b></div></section>
      <section class="card">${H(4, T ? 'นับเงินสด' : 'Count the cash', T ? 'นับเงินในลิ้นชักตอนปิดร้าน' : 'Count the drawer at closing. The app tells you if it’s short or over.')}
        <div class="fl"><label for="f-float">${T ? 'เงินทอนตั้งต้น' : 'Opening float'}<small>${T ? 'เงินทอนตอนเปิดร้าน' : 'Change in the till when you opened'}</small></label>${mi('f-float', d.float, !ed, 'data-f="float"')}</div>
        <div class="fl"><label for="f-banked">${T ? 'นำฝากธนาคาร' : 'Taken to the bank'}</label>${mi('f-banked', d.banked, !ed, 'data-f="banked"')}</div>
        <div class="calc tot"><span>${T ? 'เงินสดที่ควรมี' : 'Should be in the till'}</span><b class="v" id="o-exp">${c.expected == null ? '—' : fmt(c.expected)}</b></div>
        <div class="fl"><label for="f-counted">${T ? 'เงินสดที่นับได้' : 'Cash counted'}</label>${mi('f-counted', d.counted, !ed, 'data-f="counted"')}</div>
        <div class="calc"><span>${T ? 'ส่วนต่าง' : 'Difference'}</span><span id="o-var">${varPill(c)}</span></div></section>
      </div></div>
    <section class="card">${H(3, T ? 'จ่ายออกวันนี้' : 'Paid out today', T ? 'ทุกอย่างที่จ่ายจากลิ้นชัก พร้อมรูปใบเสร็จ' : 'Everything bought today. Pick what it was, the amount, and add a photo of the receipt.')}
      <div>${lines || `<p class="muted">${T ? 'ยังไม่มีรายการ' : 'Nothing paid out yet.'}</p>`}</div>${ed ? `<button class="btn sm" data-act="addline" style="margin-top:12px">${ic('plus', 16)} ${T ? 'เพิ่มค่าใช้จ่าย' : 'Add expense'}</button>` : ''}</section>
    <section class="card">${H(5, T ? 'หมายเหตุ' : 'Notes', T ? 'มีอะไรผิดปกติไหม' : 'Anything unusual tonight?')}<textarea id="f-note" rows="3" maxlength="2000" data-f="note" ${!ed ? 'disabled' : ''} placeholder="${T ? 'เช่น ของแตก ไฟดับ' : 'Breakages, free drinks, a power cut…'}">${esc(d.note)}</textarea></section>`;
}
function varPill(c) {
  if (c.variance == null) return `<span class="muted small">${th() ? 'ใส่เงินทอนและยอดที่นับ' : 'Enter float and count'}</span>`;
  const v = c.variance, a = Math.abs(v);
  return a <= 20 ? `<span class="pill p-approved">${th() ? 'ตรง' : 'Balanced'}</span>` : `<span class="pill ${a <= 200 ? 'p-submitted' : 'p-missing'}">${v < 0 ? (th() ? 'ขาด' : 'Short') : (th() ? 'เกิน' : 'Over')} ${fmt(a)}</span>`;
}
function sumBar(date, actions, showSave) {
  const c = dayCalc(NIGHTS[date]);
  return `<div class="sumbar"><div class="figs"><div><small>${th() ? 'ยอดขาย' : 'Sales'}</small><b id="b-s">${fmt(c.sales)}</b></div><div><small>${th() ? 'จ่ายออก' : 'Paid out'}</small><b id="b-e">${fmt(c.pl)}</b></div><div><small>${th() ? 'กำไรคืนนี้' : 'Tonight’s profit'}</small><b id="b-n">${fmt(c.net)}</b></div></div>
    <div class="row">${showSave ? `<span class="small" id="savestate" style="opacity:.8"></span>` : ''}${actions}</div></div>`;
}
function upd() {
  const d = NIGHTS[UI.date]; if (!d) return; const c = dayCalc(d); const s = (i, v) => { const e = document.getElementById(i); if (e) e.innerHTML = v; };
  s('o-sales', fmt(c.sales)); s('o-cs', fmt(c.cashSales)); s('o-exp', c.expected == null ? '—' : fmt(c.expected)); s('o-var', varPill(c)); s('b-s', fmt(c.sales)); s('b-e', fmt(c.pl)); s('b-n', fmt(c.net));
  const dr = CFG.drinkPrice ? n0(d.inc.staff) / CFG.drinkPrice : 0; s('drinks', Number.isInteger(dr) && dr > 0 ? `${dr} ${th() ? 'แก้ว' : 'drinks'} × ฿${CFG.drinkPrice}` : '');
}

function vNight() {
  UI.date = TODAY; const T = th();
  if (!NIGHTS[TODAY]) NIGHTS[TODAY] = newDay(TODAY);
  const d = NIGHTS[TODAY];
  if (d.status !== 'draft') {
    const c = dayCalc(d), done = d.status === 'closed';
    return [T ? 'คืนนี้' : 'Tonight', longD(TODAY), `<section class="card"><div class="done"><span class="ok">${ic('check', 26)}</span><div><h2 style="font-size:20px">${done ? (T ? 'คืนนี้ร้านปิด' : 'Marked as closed tonight') : (T ? `ส่งให้ ${esc(MGR())} แล้ว` : `Sent to ${esc(MGR())}`)}</h2><p class="muted" style="margin:4px 0 0">${T ? 'ตอนนี้แก้ไขไม่ได้แล้ว' : `It’s locked now. If something is wrong, tell ${esc(MGR())}.`}</p></div></div></section>
      ${done ? '' : `<div class="kpis"><div class="card kpi"><div class="v tn">${fmt(c.sales)}</div><div class="l">${T ? 'ยอดขาย' : 'Sales'}</div></div><div class="card kpi"><div class="v tn">${fmt(c.pl)}</div><div class="l">${T ? 'จ่ายออก' : 'Paid out'}</div></div><div class="card kpi"><div class="v">${varPill(c)}</div><div class="l">${T ? 'นับเงินสด' : 'Cash count'}</div></div></div>`}`];
  }
  const started = d.by && d.by !== ME.name ? `<div class="banner b-warn">${T ? `${esc(d.by)} เริ่มกรอกไว้แล้ว คุณกรอกต่อได้` : `${esc(d.by)} started tonight’s form. You can carry on with it.`}</div>` : '';
  return [T ? 'ปิดยอดคืนนี้' : 'Close the night', `${longD(TODAY)} · ${T ? 'บันทึกอัตโนมัติขณะพิมพ์' : 'saves as you type'}`,
    `<div class="banner b-info">${T ? `สวัสดี ${esc(ME.name)} กรอกขั้นตอน 1 ถึง 5 แล้วกดส่ง` : `Hi ${esc(ME.name)}. Fill in steps 1 to 5, then press <b>Send to ${esc(MGR())}</b>.`}</div>${started}${entryForm(TODAY)}${sumBar(TODAY, `<button class="btn" data-act="submit">${T ? `ส่งให้ ${esc(MGR())}` : `Send to ${esc(MGR())}`}</button>`, true)}`];
}
function vMine() {
  const mine = Object.keys(NIGHTS).filter(k => NIGHTS[k].byId === ME.id && !NIGHTS[k]._new).sort().reverse();
  const body = mine.length ? `<section class="card"><div class="tbl"><table><thead><tr><th>${th() ? 'วันที่' : 'Night'}</th><th class="n">${th() ? 'ยอดขาย' : 'Sales'}</th><th class="n">${th() ? 'จ่ายออก' : 'Paid out'}</th><th class="n">${th() ? 'นับเงิน' : 'Till'}</th><th>${th() ? 'สถานะ' : 'Status'}</th></tr></thead><tbody>
    ${mine.map(k => { const d = NIGHTS[k], c = dayCalc(d); return `<tr class="click" data-act="open" data-v="${k}"><td><b>${shortD(k)}</b><span class="s2">${DOW[dO(k).getUTCDay()]}</span></td><td class="n">${fmtN(c.sales)}</td><td class="n">${fmtN(c.pl)}</td><td class="n">${c.variance == null ? '—' : Math.abs(c.variance) <= 20 ? 'OK' : fmt(c.variance)}</td><td>${pill(d.status)}</td></tr>`; }).join('')}</tbody></table></div></section>`
    : `<section class="card empty"><p class="muted">${th() ? 'ยังไม่มีรายการ' : 'Nothing yet. Your nights show here after you send them.'}</p></section>`;
  return [th() ? 'รายการของฉัน' : 'My entries', th() ? 'คืนที่คุณกรอก' : 'Nights you closed', body];
}
function vEntry() {
  const date = UI.date, d = NIGHTS[date];
  const back = `<button class="btn sm" data-act="go" data-v="${ME.role === 'staff' ? 'mine' : 'entries'}">← ${ME.role === 'staff' ? 'My entries' : 'Daily entries'}</button>`;
  if (!d) return [longD(date), '', `${back}<section class="card empty"><p>Nothing entered for this night.</p></section>`];
  if (d.status === 'closed') return [longD(date), '', `${back}<section class="card empty"><h3>Bar closed</h3><p class="muted">No trading this night.</p>${ME.role !== 'staff' ? `<button class="btn" data-act="unclose">Undo</button>` : ''}</section>`];
  let banner = '', acts = '';
  if (ME.role !== 'staff') {
    if (d.status === 'submitted') { banner = `<div class="banner b-warn"><b>Check and approve.</b> ${esc(d.by)} sent this${d.submittedAt ? ` at ${d.submittedAt.slice(11)}` : ''}. Check the till and the receipts, fix anything, then approve.</div>`; acts = `<button class="btn ghost" data-act="sendback">Send back</button><button class="btn" data-act="approve">Approve</button>`; }
    if (d.status === 'approved') { banner = `<div class="banner b-good"><b>Approved${d.approvedBy ? ` by ${esc(d.approvedBy)}` : ''}.</b> This night is locked.${ME.role === 'owner' ? ' Only you can reopen it.' : ''}</div>`; if (ME.role === 'owner') acts = `<button class="btn ghost" data-act="reopen">Reopen</button>`; }
    if (d.status === 'draft') { banner = `<div class="banner b-info">Being filled in by ${esc(d.by || '')}.</div>`; acts = `<button class="btn" data-act="approve">Approve</button>`; }
  } else banner = d.status === 'approved' ? `<div class="banner b-good">Approved. Thanks!</div>` : `<div class="banner b-warn">Sent to ${esc(MGR())}. You can’t change it now.</div>`;
  return [longD(date), d.by ? `Entered by ${esc(d.by)}${d.by === 'Excel import' ? ' · from the old spreadsheet' : ''}` : '', `<div class="row between">${back}${pill(d.status)}</div>${banner}${entryForm(date)}${sumBar(date, acts, canEdit(d))}`];
}

/* ---------- payroll ---------- */
function vPayroll() {
  if (!PAY) return ['Payroll', '', `<section class="card empty"><p class="muted">No pay period yet.</p>${ME.role === 'owner' ? '<button class="btn pri" data-act="paystart">Start a pay period</button>' : ''}</section>`];
  const lock = PAY.status !== 'draft'; let tg = 0, tp = 0;
  const rows = PAY.rows.map(r => {
    const p = payCalc(r); tg += p.gross; tp += p.pay;
    const inp = f => `<input type="number" min="0" step="any" value="${r[f] || ''}" placeholder="0" data-pf="${f}" data-id="${r.id}" ${lock ? 'disabled' : ''} aria-label="${f} ${esc(r.n)}">`;
    return `<tr><td><button class="btn ghost sm" style="padding:0" data-act="slip" data-id="${r.id}"><b>${esc(r.n)}</b></button><span class="s2">${esc(r.p || '')}</span></td><td>${inp('m')}</td><td>${inp('abs')}</td><td>${inp('fine')}</td><td>${inp('adv')}</td><td>${inp('rent')}</td><td>${inp('elec')}</td><td class="n" id="pg-${r.id}">${fmtN(p.gross)}</td><td class="n" id="pp-${r.id}"><b>${fmtN(p.pay)}</b></td><td id="pf-${r.id}">${p.carry > 0 ? `<span class="pill p-missing">${fmt(p.carry)} to next pay</span>` : ''}</td><td>${lock ? '' : `<button class="del" data-act="payrm" data-id="${r.id}" aria-label="Remove ${esc(r.n)}">✕</button>`}</td></tr>`;
  }).join('');
  let act = '';
  if (PAY.status === 'draft') act = ME.role === 'owner' ? `<button class="btn pri" data-act="payapprove">Approve payroll</button>` : `<span class="pill p-submitted">${esc(OWN())} approves when ready</span>`;
  else act = `<span class="pill p-approved">Approved${PAY.approvedBy ? ` by ${esc(PAY.approvedBy)}` : ''}</span>${ME.role === 'owner' ? ' <button class="btn pri" data-act="paystart">Start next pay period</button>' : ''}`;
  const add = lock ? '' : `<form id="payadd" class="row" style="margin-top:14px"><input type="text" id="pa-n" placeholder="Name" required maxlength="80" style="width:160px"><input type="text" id="pa-p" placeholder="Position" maxlength="60" style="width:140px"><input type="number" id="pa-m" placeholder="Monthly salary" min="0" required style="width:150px"><button class="btn sm" type="submit">${ic('plus', 16)} Add person</button></form>`;
  return ['Payroll', `${PAY.period} · half-month pay`, `<div class="row between"><p class="muted small" style="margin:0;max-width:70ch">Half the monthly salary, minus days off (monthly × 12 ÷ 365 per day) and late fines, gives gross. Rent, electricity and advances come off to give net pay. Anything owed beyond that carries to the next pay. Tap a name for the payslip.</p><div class="row">${act}</div></div>
    <section class="card"><div class="tbl"><table class="pay"><thead><tr><th>Staff</th><th>Monthly</th><th>Days off</th><th>Late fine</th><th>Advance</th><th>Rent</th><th>Electric</th><th class="n">Gross</th><th class="n">Net pay</th><th></th><th></th></tr></thead>
    <tbody>${rows}<tr class="tot"><td>${PAY.rows.length} staff</td><td colspan="6"></td><td class="n" id="pg-t">${fmtN(tg)}</td><td class="n" id="pp-t">${fmtN(tp)}</td><td></td><td></td></tr></tbody></table></div>${add}</section>`];
}
function slip(id) {
  const r = PAY.rows.find(x => String(x.id) === String(id)), p = payCalc(r); const L = (a, b, c = '') => `<div class="r ${c}"><span>${a}</span><span>${b}</span></div>`;
  modal(`<div class="row between"><div><span class="xs muted" style="font-weight:700;letter-spacing:.06em">PAYSLIP · สลิปเงินเดือน</span><h3>${esc(r.n)} · ${esc(r.p || '')}</h3><span class="small muted">${esc(CFG.business)} · ${PAY.period}</span></div><button class="x" data-act="mclose">✕</button></div>
  <div class="slip">${L('Half-month salary · เงินเดือน', fmtN(p.half))}${p.absDed ? L(`Days off (${r.abs}) · ขาดงาน`, '−' + fmtN(p.absDed)) : ''}${n0(r.fine) ? L('Late fine · ปรับมาสาย', '−' + fmtN(r.fine)) : ''}${L('Gross · รวม', fmtN(p.gross), 't')}
  ${p.rent ? L('Room rent · ค่าห้อง', '−' + fmtN(p.rent)) : ''}${p.elec ? L('Electricity · ค่าไฟ', '−' + fmtN(p.elec)) : ''}${p.adv ? L('Advance repaid · หักเงินเบิก', '−' + fmtN(p.adv)) : ''}${L('Net pay · รับสุทธิ', fmt(p.pay), 't')}${p.carry ? L('Carried to next pay · ยกไปงวดหน้า', fmt(p.carry)) : ''}</div>`);
}
const payTimers = {};

/* ---------- reports ---------- */
function vReports() {
  const R = UI.rep, rep = REPORTS[R.type];
  const lastM = (() => { const d = dO(TODAY.slice(0, 8) + '01'); d.setUTCDate(0); return [dS(d).slice(0, 8) + '01', dS(d)]; })();
  const quick = [['This month', TODAY.slice(0, 8) + '01', TODAY], ['Last month', ...lastM], ['Last 3 months', addD(TODAY.slice(0, 8) + '01', -62).slice(0, 8) + '01', TODAY], ['Everything', FIRST, TODAY]];
  const P = UI.preview;
  const table = !P ? '<p class="muted">Loading preview…</p>' : P.count === 0 ? '<p class="muted">Nothing in these dates.</p>' :
    `<div class="tbl"><table><thead><tr>${P.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${P.rows.map(r => `<tr>${r.map(v => `<td class="${/^-?\d+(\.\d+)?$/.test(String(v)) ? 'n' : ''}">${esc(/^-?\d+\.\d\d$/.test(String(v)) ? fmtN(+v) : v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${P.count > 8 ? `<p class="muted small" style="margin:10px 0 0">Showing the first 8 rows. The download has all ${P.count}.</p>` : ''}`;
  const href = `/reports/${R.type}.csv?from=${R.from}&to=${R.to}`;
  const body = `<div class="reports">${Object.entries(REPORTS).map(([k, r]) => `<button class="rep" data-act="reptype" data-v="${k}" aria-pressed="${k === R.type}"><span class="ic">${ic(r[2], 19)}</span><b>${r[0]}</b><span>${r[1]}</span></button>`).join('')}</div>
    <section class="card"><div class="card-h"><div><h2>${rep[0]}</h2><div class="muted small">${R.type === 'payroll' ? (PAY ? PAY.period : '') : `${shortD(R.from)} ${R.from.slice(0, 4)} to ${shortD(R.to)} ${R.to.slice(0, 4)}`}${P ? ` · ${P.count} rows` : ''}</div></div><a class="btn pri" href="${href}" download>${ic('dl', 17)} Download CSV</a></div>
      ${R.type === 'payroll' ? '' : `<div class="range" style="margin-bottom:14px"><label class="f" for="rf">From<input type="date" id="rf" value="${R.from}" max="${TODAY}" data-rep="from"></label><label class="f" for="rt">To<input type="date" id="rt" value="${R.to}" max="${TODAY}" data-rep="to"></label>
        <div class="chips">${quick.map(([l, f, t]) => `<button data-act="repq" data-f="${f}" data-t="${t}" aria-pressed="${R.from === f && R.to === t}">${l}</button>`).join('')}</div></div>`}
      ${table}</section>`;
  return ['Reports', 'Pick a report and dates, then download it as a CSV file for Excel or the accountant.', body];
}
let prevKey = '';
async function loadPreview() {
  const R = UI.rep, key = `${R.type}|${R.from}|${R.to}`; if (key === prevKey && UI.preview) return; prevKey = key;
  try { UI.preview = await api('GET', `/api/reports/${R.type}/preview?from=${R.from}&to=${R.to}`); if (UI.view === 'reports' && prevKey === key) render(); } catch (e) { toast(e.message); }
}

/* ---------- users ---------- */
function vUsers() {
  const rows = USERS.map(u => `<tr><td><div class="row" style="gap:10px;flex-wrap:nowrap"><span class="av sm ${u.role === 'owner' ? 'dk' : ''}">${initials(u.name)}</span><div><b>${esc(u.name)}</b><span class="s2">@${esc(u.username)}</span></div></div></td>
    <td><span class="pill ${u.role === 'owner' ? 'p-info' : u.role === 'manager' ? 'p-lime' : 'p-draft'}">${ROLE[u.role]}</span></td>
    <td>${u.active ? '<span class="pill p-approved">Active</span>' : '<span class="pill p-missing">Turned off</span>'}</td>
    <td class="small">${u.last ? `${shortD(u.last.slice(0, 10))} · ${u.last.slice(11)}` : '<span class="muted">Never</span>'}</td>
    <td class="n">${u.id === ME.id ? '<span class="muted small">You</span>' : `<button class="btn sm" data-act="resetpw" data-id="${u.id}">Reset password</button> <button class="btn sm ghost" data-act="toggleuser" data-id="${u.id}">${u.active ? 'Turn off' : 'Turn on'}</button> <button class="btn sm ghost danger" data-act="deluser" data-id="${u.id}">Remove</button>`}</td></tr>`).join('');
  return ['Users', 'Who can sign in, and what they can see.', `<div class="row between"><div class="row"><span class="pill p-draft">Staff: tonight’s form and their own nights</span><span class="pill p-lime">Manager: approve nights, prepare payroll</span><span class="pill p-info">Owner: everything, reports and users</span></div><button class="btn pri" data-act="adduser">${ic('plus', 17)} Add user</button></div>
    <section class="card"><div class="tbl"><table><thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></section>`];
}
function genPw() { const w = ['mango', 'lotus', 'sunset', 'bamboo', 'coral', 'orchid', 'pepper', 'island', 'harbor', 'jasmine', 'papaya', 'lagoon']; const a = new Uint32Array(3); crypto.getRandomValues(a); return `${w[a[0] % w.length]}-${w[a[1] % w.length]}${10 + a[2] % 90}`; }
function addUserModal() {
  modal(`<div class="row between"><h3>Add a user</h3><button class="x" data-act="mclose">✕</button></div>
    <form id="uform" style="display:flex;flex-direction:column;gap:12px">
      <label class="f" for="un">Full name<input type="text" id="un" required maxlength="80" autocomplete="off"></label>
      <label class="f" for="uu">Username<input type="text" id="uu" required maxlength="20" autocapitalize="none" spellcheck="false" autocomplete="off"></label>
      <label class="f" for="ur">Role<select id="ur"><option value="staff">Staff: enters the nightly form</option><option value="manager">Manager: approves nights, prepares payroll</option><option value="owner">Owner: everything</option></select></label>
      <label class="f" for="upw">Password<div class="row" style="flex-wrap:nowrap"><input type="text" id="upw" required minlength="8" value="${genPw()}" autocomplete="off"><button type="button" class="btn sm" data-act="genpw">New</button></div></label>
      <div class="err" id="uerr"></div>
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-act="mclose">Cancel</button><button class="btn pri" type="submit">Create login</button></div></form>`);
  setTimeout(() => document.getElementById('un')?.focus(), 0);
}
function credModal(u, pw, title) {
  modal(`<div class="row between"><h3>${title}</h3><button class="x" data-act="mclose">✕</button></div>
  <p class="muted" style="margin:0">Give these details to ${esc(u.name)}. The password is shown only now.</p>
  <div class="cred"><span>Address: <code>${esc(location.origin)}</code></span><span>Username: <code>${esc(u.username)}</code></span><span>Password: <code>${esc(pw)}</code></span></div>
  <div class="row" style="justify-content:flex-end"><button class="btn" id="cpcred">Copy</button><button class="btn pri" data-act="mclose">Done</button></div>`);
  document.getElementById('cpcred').onclick = async () => { try { await navigator.clipboard.writeText(`MFD Books\n${location.origin}\nUsername: ${u.username}\nPassword: ${pw}`); toast('Copied'); } catch (e) { toast('Copy isn’t allowed here. Write them down instead.'); } };
}
function myPwModal() {
  modal(`<div class="row between"><h3>Change your password</h3><button class="x" data-act="mclose">✕</button></div>
    <form id="pwform" style="display:flex;flex-direction:column;gap:12px">
      <label class="f" for="pc">Current password<input type="password" id="pc" required autocomplete="current-password"></label>
      <label class="f" for="pn">New password <span class="muted xs" style="font-weight:400">at least 8 characters</span><input type="password" id="pn" required minlength="8" autocomplete="new-password"></label>
      <div class="err" id="pwerr"></div>
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-act="mclose">Cancel</button><button class="btn pri" type="submit">Change password</button></div></form>`);
}

/* ---------- events ---------- */
document.addEventListener('submit', e => {
  e.preventDefault(); const f = e.target;
  if (f.id === 'loginForm') return doLogin();
  if (f.id === 'uform') return act(async () => {
    const er = document.getElementById('uerr'); er.textContent = '';
    try {
      const r = await api('POST', '/api/users', { name: document.getElementById('un').value.trim(), username: document.getElementById('uu').value.trim(), role: document.getElementById('ur').value, password: document.getElementById('upw').value });
      USERS = r.users; const pw = document.getElementById('upw').value; if (UI.view === 'users') render(); credModal(r.user, pw, 'Login created');
    } catch (x) { er.textContent = x.message; }
  });
  if (f.id === 'pwform') return act(async () => {
    const er = document.getElementById('pwerr');
    try { await api('POST', '/api/me/password', { current: document.getElementById('pc').value, password: document.getElementById('pn').value }); closeModal(); toast('Password changed'); } catch (x) { er.textContent = x.message; }
  });
  if (f.id === 'payadd') return act(async () => {
    const r = await api('POST', '/api/payroll/lines', { name: document.getElementById('pa-n').value.trim(), position: document.getElementById('pa-p').value.trim(), monthly: Number(document.getElementById('pa-m').value) });
    PAY = r.payroll; render(); toast('Added to payroll');
  });
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act, v = b.dataset.v, d = NIGHTS[UI.date];
  if (a === 'mclose') { if (e.target === b || b.tagName === 'BUTTON') closeModal(); return; }
  switch (a) {
    case 'showpw': { const p = document.getElementById('lp'); p.type = p.type === 'password' ? 'text' : 'password'; b.textContent = p.type === 'password' ? 'Show' : 'Hide'; return; }
    case 'logout': return act(async () => { await saveNow(); const r = await api('POST', '/logout'); setCsrf(r.csrf); ME = null; render(); });
    case 'mypw': return myPwModal();
    case 'sysupdate': return act(async () => { b.disabled = true; b.textContent = 'Applying…'; await api('POST', '/api/system/update'); await reload(); toast('Update applied'); });
    case 'lang': UI.lang = v; try { localStorage.setItem('mfd-lang', v); } catch (x) {} break;
    case 'go': UI.view = v; if (v === 'night') UI.date = TODAY; window.scrollTo(0, 0); break;
    case 'month': UI.month = v; break;
    case 'open': if (SAVE.dirty) { saveNow(); } UI.date = v; UI.view = (ME.role === 'staff' && v === TODAY && NIGHTS[v]?.status === 'draft') ? 'night' : 'entry'; window.scrollTo(0, 0); break;
    case 'startday': NIGHTS[v] = newDay(v); UI.date = v; UI.view = 'entry'; break;
    case 'closeday': return act(async () => { const r = await api('POST', `/api/nights/${v}/close`); NIGHTS[v] = r.night; toast('Marked as closed'); await reload(); });
    case 'unclose': return act(async () => { await api('DELETE', `/api/nights/${UI.date}`); delete NIGHTS[UI.date]; UI.view = 'entries'; await reload(); });
    case 'addline': d.exp.push({ id: uid(), cat: 'othercost', amt: null, note: '', paid: 'till', receipt: false }); queueSave(); break;
    case 'delline': d.exp = d.exp.filter(l => l.id !== b.dataset.id); queueSave(); break;
    case 'submit': return act(async () => {
      const c = dayCalc(d);
      if (c.sales <= 0) return toast(th() ? 'ขั้นตอนที่ 1: ใส่ยอดขายอย่างน้อยหนึ่งรายการ' : 'Step 1: enter at least one sale.');
      if (d.float == null) { document.getElementById('f-float')?.focus(); return toast(th() ? 'ขั้นตอนที่ 4: ใส่เงินทอนตั้งต้น' : 'Step 4: enter the opening float.'); }
      if (d.counted == null || d.counted === '') { document.getElementById('f-counted')?.focus(); return toast(th() ? 'ขั้นตอนที่ 4: นับเงินสดก่อนส่ง' : 'Step 4: count the cash before sending.'); }
      b.disabled = true; await saveNow(); const r = await api('POST', `/api/nights/${UI.date}/submit`); NIGHTS[UI.date] = r.night; toast(th() ? `ส่งให้ ${MGR()} แล้ว` : `Sent to ${MGR()}`); window.scrollTo(0, 0); render();
    });
    case 'sendback': return act(async () => { await saveNow(); await api('POST', `/api/nights/${UI.date}/send-back`); toast('Sent back'); await reload(); });
    case 'approve': return act(async () => { await saveNow(); await api('POST', `/api/nights/${UI.date}/approve`); toast('Approved and locked'); await reload(); });
    case 'reopen': return confirmModal('Reopen this night?', 'It goes back to “Waiting for approval” so it can be changed.', 'Reopen', async () => { await api('POST', `/api/nights/${UI.date}/reopen`); await reload(); });
    case 'payapprove': return confirmModal('Approve payroll?', `Net pay for ${PAY.period} comes to ${fmt(PAY.rows.reduce((s, r) => s + payCalc(r).pay, 0))}.`, 'Approve', async () => { await api('POST', '/api/payroll/approve'); await reload(); toast('Payroll approved'); });
    case 'paystart': return confirmModal('Start the next pay period?', 'Everyone on payroll is copied in with days off, fines and deductions set to zero.', 'Start', async () => { const r = await api('POST', '/api/payroll/start'); PAY = r.payroll; render(); });
    case 'payrm': { const r = PAY.rows.find(x => String(x.id) === b.dataset.id); return confirmModal(`Remove ${esc(r.n)} from payroll?`, 'They won’t be included in this or future pay periods.', 'Remove', async () => { const x = await api('DELETE', `/api/payroll/lines/${r.id}`); PAY = x.payroll; render(); }); }
    case 'slip': return slip(b.dataset.id);
    case 'reptype': UI.rep.type = v; UI.preview = null; break;
    case 'repq': UI.rep.from = b.dataset.f; UI.rep.to = b.dataset.t; UI.preview = null; break;
    case 'adduser': if (ME.role !== 'owner') return; return addUserModal();
    case 'genpw': document.getElementById('upw').value = genPw(); return;
    case 'resetpw': { const u = USERS.find(x => String(x.id) === b.dataset.id); return confirmModal(`Reset ${esc(u.name)}’s password?`, 'Their old password stops working straight away.', 'Reset', async () => { const r = await api('POST', `/api/users/${u.id}/reset`); credModal(r.user, r.password, 'New password'); }); }
    case 'toggleuser': return act(async () => { const r = await api('POST', `/api/users/${b.dataset.id}/toggle`); USERS = r.users; render(); });
    case 'deluser': { const u = USERS.find(x => String(x.id) === b.dataset.id); return confirmModal(`Remove ${esc(u.name)}?`, 'Their login is deleted. The nights they entered stay in the books.', 'Remove', async () => { const r = await api('DELETE', `/api/users/${u.id}`); USERS = r.users; render(); }); }
    default: return;
  }
  render();
});
document.addEventListener('input', e => {
  const el = e.target, d = NIGHTS[UI.date];
  if (el.dataset.f && d && canEdit(d)) {
    const f = el.dataset.f, val = el.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value;
    if (f === 'inc') { d.inc[el.dataset.k] = val; if (el.dataset.k === 'staff') { const al = d.exp.find(l => l.auto); if (al) { al.amt = Math.round(n0(val) * CFG.commRate); const ai = document.getElementById('amt-' + al.id); if (ai) ai.value = al.amt || ''; } } }
    else d[f] = val;
    upd(); queueSave(); return;
  }
  if (el.dataset.lf && d && canEdit(d)) { const l = d.exp.find(x => x.id === el.dataset.id); if (!l) return; if (el.dataset.lf === 'amt') { l.amt = el.value === '' ? null : Number(el.value); l.auto = false; } else if (el.dataset.lf === 'note') l.note = el.value; upd(); queueSave(); return; }
  if (el.dataset.pf && PAY) {
    const r = PAY.rows.find(x => String(x.id) === el.dataset.id), f = el.dataset.pf; r[f] = el.value === '' ? 0 : Number(el.value); const p = payCalc(r);
    document.getElementById('pg-' + r.id).textContent = fmtN(p.gross); document.getElementById('pp-' + r.id).innerHTML = `<b>${fmtN(p.pay)}</b>`; document.getElementById('pf-' + r.id).innerHTML = p.carry > 0 ? `<span class="pill p-missing">${fmt(p.carry)} to next pay</span>` : '';
    let tg = 0, tp = 0; PAY.rows.forEach(x => { const q = payCalc(x); tg += q.gross; tp += q.pay; }); document.getElementById('pg-t').textContent = fmtN(tg); document.getElementById('pp-t').textContent = fmtN(tp);
    const k = r.id + f; clearTimeout(payTimers[k]); payTimers[k] = setTimeout(() => act(() => api('PATCH', `/api/payroll/lines/${r.id}`, { field: f, value: r[f] })), 600); return;
  }
  if (el.id === 'un') { const uu = document.getElementById('uu'); if (!uu.dataset.touched) uu.value = el.value.toLowerCase().replace(/[^a-z0-9]+/g, ''); }
  if (el.id === 'uu') el.dataset.touched = '1';
});
document.addEventListener('change', e => {
  const el = e.target, d = NIGHTS[UI.date];
  if (el.dataset.lf && d && (el.dataset.lf === 'cat' || el.dataset.lf === 'paid')) { const l = d.exp.find(x => x.id === el.dataset.id); l[el.dataset.lf] = el.value; queueSave(); render(); return; }
  if (el.dataset.rcpt && d) {
    const f = el.files && el.files[0]; if (!f) return; const id = el.dataset.rcpt, date = UI.date;
    return act(async () => {
      toast(th() ? 'กำลังอัปโหลด…' : 'Uploading receipt…'); await saveNow();
      const fd = new FormData(); fd.append('photo', await shrink(f), 'receipt.jpg');
      const r = await api('POST', `/api/nights/${date}/expenses/${id}/receipt`, undefined, fd);
      const cur = NIGHTS[date]; const srv = Object.fromEntries(r.night.exp.map(l => [l.id, l.receipt])); cur.exp.forEach(l => { if (typeof srv[l.id] === 'string') l.receipt = srv[l.id]; });
      render(); toast(th() ? 'แนบใบเสร็จแล้ว' : 'Receipt added');
    });
  }
  if (el.dataset.rep) { const v = el.value; if (!v) return; UI.rep[el.dataset.rep] = v; if (UI.rep.from > UI.rep.to) { if (el.dataset.rep === 'from') UI.rep.to = v; else UI.rep.from = v; } UI.preview = null; render(); }
});
/* Phone photos are large; shrink to ~1600px JPEG before upload. */
function shrink(file) {
  return new Promise(res => {
    if (!/^image\//.test(file.type)) return res(file);
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(b => res(b || file), 'image/jpeg', 0.82); };
    img.onerror = () => { URL.revokeObjectURL(url); res(file); }; img.src = url;
  });
}
window.addEventListener('beforeunload', e => { if (SAVE.state === 'saving' || SAVE.busy) { saveNow(); e.preventDefault(); e.returnValue = ''; } });
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (UI.view === 'dash' && ME) drawCash(); }, 150); });

load().then(() => { if (ME) UI.view = ME.role === 'staff' ? 'night' : 'dash'; render(); }).catch(e => { document.getElementById('app').innerHTML = `<div class="login"><div class="banner b-crit">${esc(e.message)}</div></div>`; });
})();
