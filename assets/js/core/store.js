/* Naqaa demo — central data layer (LocalStorage)
 * One versioned JSON document under KEY holds every business entity.
 * The public site and the admin dashboard both read/write it through this module only.
 */
(function (NQ) {
  'use strict';
  const KEY = 'naqaa_demo_db';
  const CART_KEY = 'naqaa_demo_cart';
  const SCHEMA_VERSION = 1;

  const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
  const isStr = (s) => typeof s === 'string' && s.length > 0;
  const isNum = (n) => typeof n === 'number' && isFinite(n);

  // Record validators: malformed records are dropped (and reported) instead of crashing pages.
  const V = {
    categories: (c) => isObj(c) && isStr(c.id) && isStr(c.name),
    services: (s) => isObj(s) && isStr(s.id) && isStr(s.name) && isNum(s.price) && ['fixed', 'per_seat', 'per_sqm', 'per_item'].includes(s.pricing),
    slots: (s) => isObj(s) && isStr(s.id) && /^\d{2}:\d{2}$/.test(s.start) && /^\d{2}:\d{2}$/.test(s.end),
    areas: (a) => isObj(a) && isStr(a.id) && isStr(a.name) && isNum(a.fee) && isObj(a.coverage),
    blocks: (b) => isObj(b) && isStr(b.id) && NQ.u.isValidDate(b.date),
    customers: (c) => isObj(c) && isStr(c.id) && isStr(c.phone),
    bookings: (b) => isObj(b) && isStr(b.id) && isStr(b.ref) && isStr(b.token) && NQ.u.isValidDate(b.date) && Array.isArray(b.items) && isNum(b.total) && isStr(b.status),
    payments: (p) => isObj(p) && isStr(p.id) && isStr(p.bookingId) && isNum(p.amount) && p.amount > 0 && ['payment', 'refund'].includes(p.kind),
    expenses: (e) => isObj(e) && isStr(e.id) && isNum(e.amount) && e.amount > 0 && NQ.u.isValidDate(e.date),
    activity: (a) => isObj(a) && isStr(a.at),
  };

  const state = { db: null, corrupt: false, issues: [], listeners: new Set() };

  function sanitize(db) {
    const issues = [];
    if (!isObj(db.settings)) { issues.push('الإعدادات العامة مفقودة وتمت استعادتها من القيم الافتراضية'); db.settings = NQ.seed.defaultSettings(); }
    if (!isObj(db.workdays)) { issues.push('أيام العمل مفقودة وتمت استعادتها'); db.workdays = NQ.seed.defaultWorkdays(); }
    Object.keys(V).forEach((k) => {
      if (!Array.isArray(db[k])) { issues.push(`مجموعة "${k}" غير صالحة وتمت تهيئتها فارغة`); db[k] = []; return; }
      const before = db[k].length;
      db[k] = db[k].filter((r) => { try { return V[k](r); } catch (e) { return false; } });
      if (db[k].length !== before) issues.push(`تم تجاهل ${before - db[k].length} سجل تالف في "${k}"`);
    });
    return issues;
  }

  function migrate(db) {
    // Placeholder for future schema upgrades; v1 is current.
    db.version = SCHEMA_VERSION;
    return db;
  }

  function load() {
    let text = null;
    try { text = localStorage.getItem(KEY); } catch (e) { text = null; }
    if (!text) {
      state.db = NQ.seed.build();
      state.corrupt = false;
      persist();
      return state.db;
    }
    try {
      const parsed = JSON.parse(text);
      if (!isObj(parsed)) throw new Error('root');
      migrate(parsed);
      state.issues = sanitize(parsed);
      state.db = parsed;
      state.corrupt = false;
      if (state.issues.length) persist();
    } catch (e) {
      // Do not overwrite: let the user choose to restore (see recovery screen).
      state.corrupt = true;
      state.db = null;
    }
    return state.db;
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state.db)); return true; }
    catch (e) { NQ.ui && NQ.ui.toast('تعذّر حفظ البيانات في المتصفح (قد تكون المساحة ممتلئة).', 'danger'); return false; }
  }

  /** Run a mutation against a fresh copy of the DB; commit only if fn does not throw. */
  function tx(fn) {
    let fresh = state.db;
    try { fresh = JSON.parse(localStorage.getItem(KEY) || 'null') || state.db; } catch (e) {} // re-read: another tab may have written
    const draft = JSON.parse(JSON.stringify(fresh));
    const result = fn(draft);
    state.db = draft;
    persist();
    emit();
    return result;
  }

  function log(db, text, meta) {
    db.activity.unshift({ at: new Date().toISOString(), text, ...(meta || {}) });
    if (db.activity.length > 200) db.activity.length = 200;
  }

  function reset() {
    state.db = NQ.seed.build();
    state.corrupt = false;
    state.issues = [];
    persist();
    try { localStorage.removeItem(CART_KEY); } catch (e) {}
    emit();
  }

  const subscribe = (fn) => { state.listeners.add(fn); return () => state.listeners.delete(fn); };
  const emit = () => state.listeners.forEach((fn) => { try { fn(state.db); } catch (e) { console.error(e); } });

  // Other tabs (same origin) changed the data → reload and re-render.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) { load(); emit(); }
  });

  // ---------- Cart (separate small key) ----------
  const cart = {
    get() { try { const c = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); return Array.isArray(c) ? c.filter((i) => i && i.serviceId && i.key) : []; } catch (e) { return []; } },
    set(items) { localStorage.setItem(CART_KEY, JSON.stringify(items)); emit(); },
    clear() { localStorage.removeItem(CART_KEY); emit(); },
  };

  // ---------- Lookup helpers ----------
  const by = (arr, id) => (arr || []).find((x) => x.id === id);

  NQ.store = {
    KEY, SCHEMA_VERSION, load, tx, reset, subscribe, log, cart, by,
    get db() { return state.db; },
    get corrupt() { return state.corrupt; },
    get issues() { return state.issues; },
  };
})(window.NQ = window.NQ || {});
