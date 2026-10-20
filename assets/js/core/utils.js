/* Naqaa demo — shared utilities (no dependencies) */
(function (NQ) {
  'use strict';

  // ---------- Safe HTML templating ----------
  // Every interpolated value is escaped unless it is a SafeHTML instance
  // (produced by html`` or raw()). Arrays are joined. This keeps user input
  // (names, notes, addresses) from ever being parsed as markup.
  class SafeHTML { constructor(s) { this.s = s; } toString() { return this.s; } }
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"'`]/g, (c) => ESC[c]);
  const toStr = (v) => {
    if (v == null || v === false) return '';
    if (v instanceof SafeHTML) return v.s;
    if (Array.isArray(v)) return v.map(toStr).join('');
    return esc(v);
  };
  function html(strings, ...vals) {
    let out = strings[0];
    for (let i = 0; i < vals.length; i++) out += toStr(vals[i]) + strings[i + 1];
    return new SafeHTML(out);
  }
  const raw = (s) => new SafeHTML(String(s));

  // ---------- IDs and tokens ----------
  function randomHex(bytes) {
    const arr = new Uint8Array(bytes);
    if (globalThis.crypto && crypto.getRandomValues) crypto.getRandomValues(arr);
    else for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${randomHex(4)}`;
  const trackingToken = () => randomHex(16); // 128-bit, unguessable

  // ---------- Numbers & money ----------
  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const num = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const money = (n) => `${num(round2(n))} ج.م`;
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

  // ---------- Dates (local calendar, YYYY-MM-DD strings) ----------
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDate = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const todayStr = () => dateStr(new Date());
  const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return dateStr(d); };
  const weekday = (s) => parseDate(s).getDay(); // 0 = Sunday
  const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseDate(s).getTime());
  const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const fmtDate = (s, opts) => {
    if (!s) return '—';
    try {
      return new Intl.DateTimeFormat('ar-EG-u-nu-latn', opts || { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseDate(s));
    } catch (e) { return s; }
  };
  const fmtShortDate = (s) => fmtDate(s, { day: 'numeric', month: 'short' });
  const fmtDateTime = (iso) => {
    if (!iso) return '—';
    try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)); }
    catch (e) { return iso; }
  };
  const fmtTime = (hhmm) => {
    const [h, m] = String(hhmm).split(':').map(Number);
    const suffix = h < 12 ? 'ص' : 'م';
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${pad(m)} ${suffix}`;
  };
  const nowHHMM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const inRange = (s, from, to) => (!from || s >= from) && (!to || s <= to);

  // ---------- Egyptian phone ----------
  // Accepts 01xxxxxxxxx, +201xxxxxxxxx, 00201xxxxxxxxx, with spaces/dashes,
  // and Arabic-Indic digits. Normalises to 01xxxxxxxxx.
  function normPhone(input) {
    let s = String(input || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d+]/g, '');
    if (s.startsWith('+20')) s = '0' + s.slice(3);
    else if (s.startsWith('0020')) s = '0' + s.slice(4);
    else if (s.startsWith('20') && s.length === 12) s = '0' + s.slice(2);
    return s;
  }
  const validPhone = (input) => /^01[0125]\d{8}$/.test(normPhone(input));
  const maskPhone = (p) => (p && p.length > 4 ? '•••••••' + p.slice(-4) : '••••');

  // ---------- DOM helpers ----------
  const qs = (sel, root) => (root || document).querySelector(sel);
  const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const formData = (form) => Object.fromEntries(new FormData(form).entries());

  NQ.u = {
    SafeHTML, html, raw, esc, uid, trackingToken, randomHex,
    round2, num, money, clamp,
    dateStr, parseDate, todayStr, addDays, weekday, isValidDate, DAY_NAMES, fmtDate, fmtShortDate, fmtDateTime, fmtTime, nowHHMM, inRange,
    normPhone, validPhone, maskPhone,
    qs, qsa, debounce, formData,
  };
})(window.NQ = window.NQ || {});
