/* Naqaa demo — admin command palette (Ctrl/⌘+K) and keyboard shortcuts.
 * One search box for pages, quick actions, bookings, customers and services.
 * Matching is Arabic-aware (alef/hamza/taa-marbuta/diacritics normalised) and
 * phone-aware (any format of an Egyptian number finds the customer). */
(function (NQ) {
  'use strict';
  const A = NQ.admin;
  const { html, qs, money, fmtDate, normPhone } = NQ.u;
  const UI = NQ.ui, WF = NQ.workflow;

  const norm = (s) => String(s || '').toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .trim();

  /** Score a candidate against query tokens: -1 = no match, higher = better. */
  function score(hay, tokens) {
    const h = norm(hay);
    let s = 0;
    for (const t of tokens) {
      const i = h.indexOf(t);
      if (i < 0) return -1;
      s += i === 0 ? 3 : h[i - 1] === ' ' ? 2 : 1;
    }
    return s;
  }
  /** Highlight the first query token in text (only when normalisation kept positions intact). */
  function mark(text, tokens) {
    const t = tokens[0];
    const n = norm(text);
    if (!t || n.length !== String(text).length) return html`${text}`;
    const i = n.indexOf(t);
    if (i < 0) return html`${text}`;
    return html`${text.slice(0, i)}<mark>${text.slice(i, i + t.length)}</mark>${text.slice(i + t.length)}`;
  }

  // ---------- Sources ----------
  const go = (hash) => () => { location.hash = hash; };
  function actions() {
    return [
      { icon: 'bi-plus-lg', title: 'حجز جديد', sub: 'إنشاء حجز يدوي لعميل', keys: ['N'], run: go('#/orders/new'), words: 'جديد اضافه حجز new' },
      { icon: 'bi-cash-coin', title: 'تسجيل دفعة', sub: 'اختر الحجز من صفحة المدفوعات', run: go('#/payments'), words: 'دفعه تحصيل' },
      { icon: 'bi-receipt', title: 'إضافة مصروف', sub: 'صفحة المصروفات', run: go('#/expenses'), words: 'مصروف' },
      { icon: 'bi-circle-half', title: 'تبديل الوضع الليلي / النهاري', keys: ['T'], run: () => toggleTheme(), words: 'dark light ليلي نهاري ثيم' },
      { icon: 'bi-layout-sidebar-inset-reverse', title: 'طي / إظهار القائمة الجانبية', keys: ['['], run: () => A.toggleSidebar(), words: 'sidebar قائمه' },
      { icon: 'bi-shop', title: 'فتح الموقع العام', sub: 'في تبويب جديد', run: () => window.open('index.html', '_blank', 'noopener'), words: 'موقع site' },
      { icon: 'bi-keyboard', title: 'اختصارات لوحة المفاتيح', keys: ['?'], run: () => shortcuts(), words: 'shortcuts اختصارات' },
    ];
  }
  function pages() {
    return A.NAV.flatMap(([group, items]) => items.map(([k, label, icon]) => ({ icon, title: label, sub: group, run: go(`#/${k}`), keys: GO_KEYS[k] ? ['G', GO_KEYS[k]] : null })));
  }
  function bookings(tokens, raw) {
    const d = A.db();
    const phone = normPhone(raw);
    return d.bookings.map((b) => {
      let sc = score(`${b.ref} ${b.customer.name} ${b.areaName}`, tokens);
      if (sc < 0 && phone.length >= 4 && b.customer.phone.includes(phone)) sc = 2;
      return { b, sc };
    }).filter((x) => x.sc >= 0)
      .sort((x, y) => y.sc - x.sc || y.b.date.localeCompare(x.b.date))
      .slice(0, 6)
      .map(({ b }) => ({
        icon: (WF.STATUS[b.status] || {}).icon || 'bi-calendar2-week',
        title: html`<span class="ltr">${mark(b.ref, tokens)}</span> — ${mark(b.customer.name, tokens)}`,
        sub: `${fmtDate(b.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${b.slotLabel} · ${(WF.STATUS[b.status] || {}).label || b.status} · ${money(b.total)}`,
        run: go(`#/orders/${b.id}`),
      }));
  }
  function customers(tokens, raw) {
    const phone = normPhone(raw);
    return A.db().customers.map((c) => {
      let sc = score(c.name || '', tokens);
      if (sc < 0 && phone.length >= 4 && c.phone.includes(phone)) sc = 2;
      return { c, sc };
    }).filter((x) => x.sc >= 0).sort((x, y) => y.sc - x.sc).slice(0, 4)
      .map(({ c }) => ({ icon: 'bi-person', title: mark(c.name || c.phone, tokens), sub: html`<span class="ltr">${c.phone}</span>`, run: go(`#/customers/${c.id}`) }));
  }
  function services(tokens) {
    return A.db().services.filter((s) => score(s.name, tokens) >= 0).slice(0, 3)
      .map((s) => ({ icon: 'bi-grid', title: mark(s.name, tokens), sub: s.active ? 'خدمة مفعّلة' : 'خدمة متوقفة', run: go('#/services') }));
  }

  function build(q) {
    const tokens = norm(q).split(/\s+/).filter(Boolean);
    if (!tokens.length) {
      const pending = A.db().bookings.filter((b) => b.status === 'pending').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4)
        .map((b) => ({ icon: 'bi-hourglass-split', title: html`<span class="ltr">${b.ref}</span> — ${b.customer.name}`, sub: `${fmtDate(b.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${b.slotLabel}`, run: go(`#/orders/${b.id}`) }));
      return [['يحتاج انتباهك', pending], ['إجراءات سريعة', actions().slice(0, 4)], ['الصفحات', pages()]];
    }
    const filt = (list) => list.map((x) => ({ x, sc: score(`${typeof x.title === 'string' ? x.title : ''} ${x.words || ''} ${typeof x.sub === 'string' ? x.sub : ''}`, tokens) })).filter((r) => r.sc >= 0).sort((a, b) => b.sc - a.sc).map((r) => r.x);
    return [['الحجوزات', bookings(tokens, q)], ['العملاء', customers(tokens, q)], ['الصفحات', filt(pages())], ['إجراءات', filt(actions())], ['الخدمات', services(tokens)]];
  }

  // ---------- View ----------
  let el = null, input = null, list = null, items = [], active = 0, lastFocus = null;
  function ensure() {
    if (el) return;
    el = document.createElement('div');
    el.className = 'cmdk';
    el.hidden = true;
    el.innerHTML = String(html`<div class="cmdk-backdrop" data-close></div>
      <div class="cmdk-panel" role="dialog" aria-modal="true" aria-label="بحث سريع">
        <div class="cmdk-input"><i class="bi bi-search" aria-hidden="true"></i><input type="text" role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-autocomplete="list" placeholder="ابحث برقم الحجز، اسم العميل، الموبايل، أو اسم صفحة…" autocomplete="off" spellcheck="false"><kbd>Esc</kbd></div>
        <div class="cmdk-list" id="cmdk-list" role="listbox" aria-label="النتائج"></div>
        <div class="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd>للتنقل</span><span><kbd>Enter</kbd>للفتح</span><span><kbd>Esc</kbd>للإغلاق</span></div>
      </div>`);
    document.body.appendChild(el);
    input = qs('input', el);
    list = qs('.cmdk-list', el);
    input.addEventListener('input', () => { active = 0; render(); });
    input.addEventListener('keydown', onKey);
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) return close();
      const it = e.target.closest('[data-idx]');
      if (it) run(Number(it.dataset.idx));
    });
    list.addEventListener('pointermove', (e) => {
      const it = e.target.closest('[data-idx]');
      if (it && Number(it.dataset.idx) !== active) { active = Number(it.dataset.idx); paintActive(false); }
    });
  }
  function render() {
    const groups = build(input.value).filter(([, g]) => g.length);
    items = groups.flatMap(([, g]) => g);
    if (!items.length) {
      list.innerHTML = String(html`<div class="cmdk-empty"><i class="bi bi-search d-block fs-3 mb-2" aria-hidden="true"></i>لا توجد نتائج لـ "${input.value}"</div>`);
      input.removeAttribute('aria-activedescendant');
      return;
    }
    let i = 0;
    list.innerHTML = String(html`${groups.map(([name, g]) => html`<div class="cmdk-group" role="presentation">${name}</div>${g.map((x) => { const idx = i++; return html`<div class="cmdk-item" role="option" id="cmdk-opt-${idx}" data-idx="${idx}" aria-selected="false"><span class="ci"><i class="bi ${x.icon}" aria-hidden="true"></i></span><span class="ct"><b>${x.title}</b>${x.sub ? html`<small>${x.sub}</small>` : ''}</span>${x.keys ? html`<span class="hint">${x.keys.map((k) => html`<kbd>${k}</kbd>`)}</span>` : ''}</div>`; })}`)}`);
    active = Math.min(active, items.length - 1);
    paintActive(true);
  }
  function paintActive(scroll) {
    list.querySelectorAll('[aria-selected="true"]').forEach((n) => n.setAttribute('aria-selected', 'false'));
    const cur = qs(`#cmdk-opt-${active}`, list);
    if (!cur) return;
    cur.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', cur.id);
    if (scroll) cur.scrollIntoView({ block: 'nearest' });
  }
  function onKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) { active = (active + 1) % items.length; paintActive(true); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) { active = (active - 1 + items.length) % items.length; paintActive(true); } }
    else if (e.key === 'Enter') { e.preventDefault(); run(active); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') e.preventDefault(); // focus stays in the dialog
  }
  function run(i) {
    const it = items[i];
    if (!it) return;
    close(true);
    it.run();
  }
  function open() {
    ensure();
    if (!el.hidden) return;
    lastFocus = document.activeElement;
    el.classList.remove('is-closing');
    el.hidden = false;
    input.value = '';
    active = 0;
    render();
    requestAnimationFrame(() => input.focus());
  }
  function close(instant) {
    if (!el || el.hidden) return;
    const done = () => { el.hidden = true; el.classList.remove('is-closing'); if (!instant && lastFocus && lastFocus.focus) lastFocus.focus(); };
    if (instant || NQ.motion.reduced()) return done();
    el.classList.add('is-closing');
    setTimeout(done, 170);
  }
  const isOpen = () => !!(el && !el.hidden);

  function toggleTheme() {
    const b = qs('.adm-top [data-action="theme"]');
    const r = b ? b.getBoundingClientRect() : null;
    UI.theme.toggle(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null);
  }

  // ---------- Shortcuts help ----------
  const GO_KEYS = { dashboard: 'D', orders: 'O', customers: 'C', payments: 'P', expenses: 'E', reports: 'R', services: 'S', schedule: 'W', areas: 'A' };
  function shortcuts() {
    const row = (keys, label) => html`<div><dt class="fw-normal">${label}</dt><dd>${keys.map((k) => html`<kbd>${k}</kbd>`)}</dd></div>`;
    const navLabel = Object.fromEntries(A.NAV.flatMap(([, items]) => items.map(([k, l]) => [k, l])));
    UI.modal({
      title: 'اختصارات لوحة المفاتيح',
      body: html`<dl class="kbd-list">
        ${row(['Ctrl', 'K'], 'بحث سريع وانتقال')}${row(['/'], 'بحث سريع')}${row(['N'], 'حجز جديد')}${row(['T'], 'تبديل الوضع الليلي')}${row(['['], 'طي القائمة الجانبية')}${row(['?'], 'عرض هذه القائمة')}
        ${Object.entries(GO_KEYS).map(([k, key]) => row(['G', key], `الانتقال إلى ${navLabel[k]}`))}
      </dl><p class="small text-muted mt-3 mb-0">تعمل الاختصارات بأي لغة لوحة مفاتيح، ولا تعمل أثناء الكتابة داخل حقل.</p>`,
    });
  }

  // ---------- Global keys ----------
  const typing = (t) => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  let gPending = 0;
  document.addEventListener('keydown', (e) => {
    if (!A.user() || !qs('#adm-main')) return;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') { e.preventDefault(); isOpen() ? close() : open(); return; }
    if (isOpen() || typing(e.target) || e.ctrlKey || e.metaKey || e.altKey || UI.modalOpen()) return;
    if (Date.now() - gPending < 1000) {
      gPending = 0;
      const k = Object.keys(GO_KEYS).find((n) => `Key${GO_KEYS[n]}` === e.code);
      if (k) { e.preventDefault(); location.hash = `#/${k}`; }
      return;
    }
    if (e.code === 'Slash' && e.shiftKey) { e.preventDefault(); shortcuts(); }
    else if (e.code === 'Slash') { e.preventDefault(); open(); }
    else if (e.code === 'KeyG') gPending = Date.now();
    else if (e.code === 'KeyN') { e.preventDefault(); location.hash = '#/orders/new'; }
    else if (e.code === 'KeyT') toggleTheme();
    else if (e.code === 'BracketLeft' || e.code === 'BracketRight') A.toggleSidebar();
  });

  A.palette = { open, close, shortcuts };
})(window.NQ = window.NQ || {});
