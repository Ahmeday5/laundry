/* Naqaa demo — admin core: demo login, shell, router and shared admin widgets.
 * The login is a DEMONSTRATION ONLY (credentials stored in the demo data, session in
 * sessionStorage). It is not security; a real backend is required for production. */
(function (NQ) {
  'use strict';
  const { html, raw, money, num, qs, qsa, fmtDate, todayStr } = NQ.u;
  const S = NQ.store, UI = NQ.ui, FIN = NQ.finance, M = NQ.motion;
  const SESSION_KEY = 'naqaa_admin_session';
  const root = document.getElementById('admin-root');

  const A = NQ.admin = {
    pages: {}, routes: [], state: { ranges: {} }, current: null,
    db: () => S.db,
    main: () => document.getElementById('adm-main'),
    set(h) { A.main().innerHTML = String(h); },
    go(path) { location.hash = '#' + path; },
    user() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; } },
    route(re, name, fn, title, nav) { A.routes.push({ re, name, fn, title, nav: nav || name }); },
  };

  // ---------- Shared widgets ----------
  A.ph = (title, sub, actions) => html`<div class="ph"><div><h1>${title}</h1>${sub ? html`<p>${sub}</p>` : ''}</div>${actions ? html`<div class="acts">${actions}</div>` : ''}</div>`;

  A.getRange = (key, def) => {
    if (!A.state.ranges[key]) A.state.ranges[key] = { preset: def || 'month', from: '', to: '' };
    const st = A.state.ranges[key];
    return { ...st, ...FIN.rangeFor(st.preset, st.from, st.to) };
  };
  A.rangeBar = (key, def) => {
    const st = A.getRange(key, def);
    return html`<div class="rangebar no-print" data-range="${key}">
      <label class="lbl" for="rp-${key}">الفترة</label>
      <select class="form-select" id="rp-${key}" data-r="preset">${Object.entries(FIN.PRESETS).map(([k, v]) => html`<option value="${k}" ${st.preset === k ? 'selected' : ''}>${v}</option>`)}</select>
      ${st.preset === 'custom' ? html`<label class="visually-hidden" for="rf-${key}">من</label><input type="date" class="form-control" id="rf-${key}" data-r="from" value="${st.from || ''}"><span class="lbl">إلى</span><label class="visually-hidden" for="rt-${key}">إلى</label><input type="date" class="form-control" id="rt-${key}" data-r="to" value="${st.to || ''}">` : ''}
      ${st.from || st.to ? html`<span class="lbl">${st.from ? fmtDate(st.from, { day: 'numeric', month: 'short', year: 'numeric' }) : '…'} — ${st.to ? fmtDate(st.to, { day: 'numeric', month: 'short', year: 'numeric' }) : '…'}</span>` : ''}
    </div>`;
  };
  A.bindRange = (container, onChange) => {
    container.addEventListener('change', (e) => {
      const bar = e.target.closest('[data-range]'); if (!bar) return;
      const st = A.state.ranges[bar.dataset.range];
      st[e.target.dataset.r] = e.target.value;
      if (e.target.dataset.r === 'preset' && e.target.value === 'custom' && !st.from) { st.from = NQ.u.addDays(todayStr(), -29); st.to = todayStr(); }
      if (st.from && st.to && st.from > st.to) { UI.toast('تاريخ البداية بعد تاريخ النهاية — تم تبديلهما', 'warning'); [st.from, st.to] = [st.to, st.from]; }
      onChange();
    });
  };

  A.sortTh = (label, key, st, cls) => html`<th class="${cls || ''}" ${st.sort === key ? raw(`aria-sort="${st.dir === 'asc' ? 'ascending' : 'descending'}"`) : ''}><button type="button" data-sort="${key}" ${st.sort === key ? raw('aria-sort="true"') : ''}>${label}<i class="bi ${st.sort === key ? (st.dir === 'asc' ? 'bi-sort-up' : 'bi-sort-down') : 'bi-arrow-down-up opacity-50'}" aria-hidden="true"></i></button></th>`;
  A.pager = (total, st) => {
    const pages = Math.max(1, Math.ceil(total / st.per));
    if (st.page > pages) st.page = pages;
    return html`<div class="pager"><span>${total ? `عرض ${(st.page - 1) * st.per + 1}–${Math.min(total, st.page * st.per)} من ${total}` : 'لا توجد نتائج'}</span><div class="d-flex gap-1 align-items-center"><button class="btn btn-sm btn-outline" data-page="${st.page - 1}" ${st.page <= 1 ? 'disabled' : ''} aria-label="الصفحة السابقة"><i class="bi bi-chevron-right" aria-hidden="true"></i></button><span class="px-2">${st.page} / ${pages}</span><button class="btn btn-sm btn-outline" data-page="${st.page + 1}" ${st.page >= pages ? 'disabled' : ''} aria-label="الصفحة التالية"><i class="bi bi-chevron-left" aria-hidden="true"></i></button></div></div>`;
  };
  A.sortBy = (rows, st, getters) => {
    const g = getters[st.sort]; if (!g) return rows;
    const m = st.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => { const x = g(a), y = g(b); return (x > y ? 1 : x < y ? -1 : 0) * m; });
  };

  /** Generic form-in-modal helper. fields are rendered by caller; onSave(values, form) may throw Error or return false. */
  A.formModal = (opts) => {
    UI.modal({
      title: opts.title, size: opts.size,
      body: html`<form id="mform" novalidate>${opts.body}</form>`,
      footer: html`<button type="button" class="btn btn-ghost" data-bs-dismiss="modal">إلغاء</button><button type="submit" form="mform" class="btn btn-brand">${opts.saveText || 'حفظ'}</button>`,
      onMount(el) {
        const form = el.querySelector('#mform');
        if (opts.onMount) opts.onMount(form);
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = el.querySelector('button[type=submit]'); if (btn.disabled) return;
          btn.disabled = true;
          try {
            const r = await opts.onSave(NQ.u.formData(form), form);
            if (r !== false) UI.closeModal();
          } catch (err) {
            if (err.fields) UI.showFieldErrors(form, err.fields);
            else UI.toast(err.message || 'تعذّر الحفظ', 'danger');
          } finally { btn.disabled = false; }
        });
      },
    });
  };
  A.fieldErr = (fields) => { const e = new Error('invalid'); e.fields = fields; return e; };

  /** Payment / refund add-edit dialog (all validation through NQ.finance.validatePayment). */
  A.paymentModal = (bookingId, payment, kind) => {
    const d = A.db(); const b = S.by(d.bookings, bookingId);
    kind = payment ? payment.kind : (kind || 'payment');
    const f = FIN.bookingFinance(d, b);
    const suggested = payment ? payment.amount : kind === 'refund' ? f.paid : f.outstanding;
    A.formModal({
      title: `${payment ? 'تعديل' : 'تسجيل'} ${kind === 'refund' ? 'استرداد' : 'دفعة'} — ${b.ref}`,
      saveText: payment ? 'حفظ التعديل' : kind === 'refund' ? 'تسجيل الاسترداد' : 'تسجيل الدفعة',
      body: html`
        <div class="alert-soft info mb-3"><i class="bi bi-info-circle" aria-hidden="true"></i><span>الإجمالي ${money(b.total)} — المدفوع ${money(f.paid)} — ${kind === 'refund' ? `الحد الأقصى للاسترداد ${money(f.paid + (payment ? payment.amount : 0))}` : `المتبقي ${money(f.outstanding + (payment ? payment.amount : 0))}`}</span></div>
        <div class="row g-3">
          <div class="col-sm-6"><label class="form-label" for="p-amount">المبلغ (ج.م)<span class="req">*</span></label><input class="form-control" id="p-amount" name="amount" type="number" step="0.01" min="0.01" inputmode="decimal" value="${suggested || ''}" required><div class="invalid-feedback" data-for="amount"></div></div>
          <div class="col-sm-6"><label class="form-label" for="p-method">طريقة الدفع</label><select class="form-select" id="p-method" name="method">${Object.entries(FIN.METHODS).map(([k, v]) => html`<option value="${k}" ${payment && payment.method === k ? 'selected' : ''}>${v}</option>`)}</select></div>
          <div class="col-sm-6"><label class="form-label" for="p-date">التاريخ<span class="req">*</span></label><input class="form-control" id="p-date" name="date" type="date" max="${todayStr()}" value="${payment ? payment.date : todayStr()}" required><div class="invalid-feedback" data-for="date"></div></div>
          <div class="col-12"><label class="form-label" for="p-notes">ملاحظات</label><input class="form-control" id="p-notes" name="notes" value="${payment ? payment.notes : ''}" placeholder="${kind === 'refund' ? 'سبب الاسترداد' : 'مثال: عربون، باقي الحساب…'}"></div>
        </div>`,
      onSave(v) {
        const db0 = A.db();
        const err = FIN.validatePayment(db0, { bookingId, amount: v.amount, kind, excludeId: payment && payment.id });
        if (err) throw A.fieldErr({ amount: err });
        if (!NQ.u.isValidDate(v.date) || v.date > todayStr()) throw A.fieldErr({ date: 'اختر تاريخًا صحيحًا لا يتجاوز اليوم' });
        S.tx((d2) => {
          // re-validate inside the transaction against the latest stored data
          const e2 = FIN.validatePayment(d2, { bookingId, amount: v.amount, kind, excludeId: payment && payment.id });
          if (e2) throw A.fieldErr({ amount: e2 });
          const now = new Date().toISOString();
          const amount = NQ.u.round2(Number(v.amount));
          const bk = S.by(d2.bookings, bookingId);
          if (payment) {
            const p = S.by(d2.payments, payment.id);
            Object.assign(p, { amount, method: v.method, date: v.date, notes: v.notes.trim(), updatedAt: now });
            S.log(d2, `تعديل ${kind === 'refund' ? 'استرداد' : 'دفعة'} على ${bk.ref}: ${money(amount)}`, { bookingId });
          } else {
            d2.payments.push({ id: NQ.u.uid('pay'), bookingId, kind, amount, method: v.method, date: v.date, notes: v.notes.trim(), by: (A.user() || {}).user || 'admin', createdAt: now, updatedAt: now });
            S.log(d2, `${kind === 'refund' ? 'استرداد' : 'دفعة'} ${money(amount)} على ${bk.ref}`, { bookingId });
          }
        });
        UI.toast(payment ? 'تم حفظ التعديل' : kind === 'refund' ? 'تم تسجيل الاسترداد' : 'تم تسجيل الدفعة');
      },
    });
  };
  A.deletePayment = async (p) => {
    const b = S.by(A.db().bookings, p.bookingId);
    if (!(await UI.confirm({ title: 'حذف عملية مالية', message: `حذف ${p.kind === 'refund' ? 'استرداد' : 'دفعة'} بمبلغ ${money(p.amount)} من ${b ? b.ref : 'حجز'}؟`, detail: 'استخدم الحذف لتصحيح إدخال خاطئ فقط. ستتغير الأرصدة والتقارير فورًا.', okText: 'حذف', danger: true }))) return;
    try {
      S.tx((d) => {
        const paid = FIN.netPaid(d, p.bookingId, p.id);
        if (paid < 0) throw new Error('لا يمكن حذف هذه الدفعة لأن صافي المدفوع سيصبح سالبًا. احذف الاسترداد المرتبط أولًا.');
        d.payments = d.payments.filter((x) => x.id !== p.id);
        S.log(d, `حذف ${p.kind === 'refund' ? 'استرداد' : 'دفعة'} ${money(p.amount)} من ${b ? b.ref : ''}`);
      });
      UI.toast('تم الحذف', 'info');
    } catch (e) { UI.toast(e.message, 'danger'); }
  };

  /** Every workday / slot / block / coverage edit goes through here so affected bookings are surfaced. */
  A.applySchedule = async (mutator, okMsg) => {
    const before = A.db();
    const draft = JSON.parse(JSON.stringify(before));
    try { mutator(draft); } catch (e) { UI.toast(e.message, 'danger'); return false; }
    const affected = NQ.schedule.newlyAffected(before, draft);
    if (affected.length) {
      const ok = await UI.confirm({
        title: 'هذا التغيير يؤثر على حجوزات قائمة',
        message: html`سيصبح ${affected.length} حجز قادم خارج الجدول الجديد: ${affected.map((x) => `${x.booking.ref} (${fmtDate(x.booking.date, { day: 'numeric', month: 'short' })} — ${x.booking.customer.name})`).join('، ')}.`,
        detail: 'لن يتم نقل أو حذف هذه الحجوزات تلقائيًا؛ ستبقى بموعدها الحالي مع علامة تحذير. تواصل مع كل عميل قبل تعديل موعده من صفحة الحجز.',
        okText: 'حفظ التغيير والإبقاء على الحجوزات',
      });
      if (!ok) return false;
    }
    S.tx((d) => { mutator(d); S.log(d, okMsg || 'تعديل إعدادات المواعيد'); });
    UI.toast(affected.length ? `${okMsg || 'تم الحفظ'} — راجع ${affected.length} حجز متأثر` : (okMsg || 'تم الحفظ'), affected.length ? 'warning' : 'success');
    return true;
  };

  A.bookingLink = (b) => html`<a href="#/orders/${b.id}" class="ref">${b.ref}</a>`;
  A.trackUrl = (b) => `index.html#/track/${b.token}`;

  // ---------- Auth ----------
  function loginView(err) {
    document.body.classList.remove('admin-shell');
    const d = S.db;
    const pending = d.bookings.filter((b) => b.status === 'pending').length;
    const upcoming = d.bookings.filter((b) => b.date >= todayStr() && ['pending', 'confirmed'].includes(b.status)).length;
    root.innerHTML = String(html`<div class="login-wrap">
      <div class="login-art"><svg class="bgw" aria-hidden="true" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">${raw(Array.from({ length: 40 }, (_, i) => `<path d="M${i * 16} 0V800"/><path d="M0 ${i * 20}H600"/>`).join(''))}</svg>${UI.logo('لوحة التحكم')}
        <div class="preview" aria-hidden="true">
          <div class="card"><small>حجوزات في انتظار التأكيد</small><b>${pending}</b></div>
          <div class="card"><small>مواعيد قادمة</small><b>${upcoming}</b><div class="bar"><i></i></div></div>
          <div class="card"><small>الخدمات المفعّلة</small><b>${d.services.filter((s) => s.active).length}</b></div>
        </div>
        <div><h2>كل الحجوزات والمواعيد والمدفوعات في مكان واحد</h2><p>تابع الطلبات الجديدة، وأكد المواعيد، وسجّل المدفوعات والمصروفات.</p></div></div>
      <div class="login-form"><form id="login" novalidate>
        <div class="d-lg-none mb-4">${UI.logo('لوحة التحكم')}</div>
        <h1 class="h3 mb-1">أهلًا بعودتك</h1><p class="text-muted mb-4">سجّل الدخول لمتابعة الحجوزات اليوم.</p>
        ${err ? html`<div class="alert-soft err mb-3" role="alert"><i class="bi bi-exclamation-octagon" aria-hidden="true"></i><span>${err}</span></div>` : ''}
        <div class="mb-3"><label class="form-label" for="l-user">اسم المستخدم</label><input class="form-control" id="l-user" name="user" dir="ltr" autocomplete="username" required></div>
        <div class="mb-3"><label class="form-label" for="l-pass">كلمة المرور</label><div class="pw"><input class="form-control" id="l-pass" name="pass" type="password" dir="ltr" autocomplete="current-password" required><button type="button" data-reveal-pw aria-label="إظهار كلمة المرور" aria-pressed="false"><i class="bi bi-eye" aria-hidden="true"></i></button></div></div>
        <button class="btn btn-brand btn-lg w-100" type="submit">دخول<i class="bi bi-arrow-left" aria-hidden="true"></i></button>
        <div class="demo-cred mt-4"><b>بيانات الدخول التجريبية</b><br>المستخدم: <code>${S.db.settings.adminUser}</code> — كلمة المرور: <code>${S.db.settings.adminPass}</code><br><span class="small text-muted">هذا تسجيل دخول للعرض فقط وليس حماية حقيقية.</span></div>
        <button type="button" class="btn btn-ghost btn-sm mt-2" data-fill>ملء البيانات التجريبية</button>
        <a class="btn btn-ghost btn-sm mt-2" href="index.html"><i class="bi bi-arrow-right" aria-hidden="true"></i>الموقع العام</a>
      </form></div></div>`);
    const form = qs('#login');
    qs('[data-fill]').addEventListener('click', () => { form.user.value = S.db.settings.adminUser; form.pass.value = S.db.settings.adminPass; form.pass.focus(); });
    qs('[data-reveal-pw]').addEventListener('click', (e) => {
      const show = form.pass.type === 'password';
      form.pass.type = show ? 'text' : 'password';
      e.currentTarget.setAttribute('aria-pressed', String(show));
      e.currentTarget.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
      e.currentTarget.innerHTML = `<i class="bi ${show ? 'bi-eye-slash' : 'bi-eye'}" aria-hidden="true"></i>`;
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const st = S.db.settings;
      if (form.user.value.trim() === st.adminUser && form.pass.value === st.adminPass) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user: st.adminUser, at: new Date().toISOString() }));
        if (!location.hash || location.hash === '#/login') location.hash = '#/dashboard';
        shell(); route();
      } else loginView('اسم المستخدم أو كلمة المرور غير صحيحة.');
    });
  }
  function logout() { sessionStorage.removeItem(SESSION_KEY); location.hash = '#/login'; loginView(); }

  // ---------- Shell ----------
  const NAV = [
    ['التشغيل', [['dashboard', 'لوحة المتابعة', 'bi-speedometer2'], ['orders', 'الحجوزات', 'bi-calendar2-week'], ['customers', 'العملاء', 'bi-people']]],
    ['المالية', [['payments', 'المدفوعات', 'bi-cash-stack'], ['expenses', 'المصروفات', 'bi-receipt'], ['reports', 'التقارير المالية', 'bi-graph-up']]],
    ['الإعداد', [['services', 'الخدمات', 'bi-grid'], ['categories', 'الفئات', 'bi-tags'], ['schedule', 'أيام العمل والفترات', 'bi-clock'], ['areas', 'المناطق والتغطية', 'bi-geo-alt'], ['settings', 'الإعدادات والبيانات', 'bi-gear']]],
  ];
  A.NAV = NAV;
  const COLLAPSE_KEY = 'naqaa_admin_nav_collapsed';
  const isCollapsed = () => { try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch (e) { return false; } };
  const initials = (u) => String(u || 'A').trim().slice(0, 1);

  function shell() {
    document.body.classList.add('admin-shell');
    const user = (A.user() || {}).user;
    root.innerHTML = String(html`<div class="adm ${isCollapsed() ? 'is-collapsed' : ''}">
      <aside class="adm-side"><div class="offcanvas-lg offcanvas-end" tabindex="-1" id="admnav" aria-labelledby="admnav-l"><div class="adm-side-inner">
        <div class="brand-row"><a href="#/dashboard" id="admnav-l" class="text-decoration-none">${UI.logo('لوحة التحكم')}</a>
          <button type="button" class="side-toggle" data-side-toggle aria-label="طي القائمة الجانبية" aria-expanded="${!isCollapsed()}" title="طي القائمة ([)"><i class="bi bi-chevron-double-right" aria-hidden="true"></i></button>
          <button type="button" class="btn-close btn-close-white d-lg-none" data-bs-dismiss="offcanvas" data-bs-target="#admnav" aria-label="إغلاق"></button></div>
        <nav class="adm-nav" aria-label="أقسام لوحة التحكم">${NAV.map(([g, items]) => html`<h2>${g}</h2>${items.map(([k, l, i]) => html`<a href="#/${k}" data-nav="${k}" data-tip="${l}"><i class="bi ${i}" aria-hidden="true"></i><span>${l}</span>${k === 'orders' ? html`<span class="count" data-pending hidden></span>` : ''}</a>`)}`)}</nav>
        <div class="adm-side-foot">
          <div class="side-user"><span class="avatar" aria-hidden="true">${initials(user)}</span><span class="who"><b>${user}</b>مدير النظام</span></div>
          <div class="note">بيانات تجريبية محفوظة في هذا المتصفح.<br><a href="index.html" target="_blank" rel="noopener">فتح الموقع العام <i class="bi bi-box-arrow-up-left" aria-hidden="true"></i></a></div>
        </div>
      </div></div></aside>
      <div>
        <header class="adm-top" data-scroll-header>
          <button class="btn btn-ghost btn-icon d-lg-none" data-bs-toggle="offcanvas" data-bs-target="#admnav" aria-controls="admnav" aria-label="فتح القائمة"><i class="bi bi-list fs-4" aria-hidden="true"></i></button>
          <nav class="adm-crumb" aria-label="مسار الصفحة"><span class="grp" id="adm-group"></span><i class="bi bi-chevron-left grp" aria-hidden="true"></i><span class="ttl" id="adm-title"></span></nav>
          <span class="nq-badge tone-warning demo hide-xs">عرض تجريبي</span>
          <div class="acts">
            <button type="button" class="search-trigger" data-cmdk aria-label="بحث سريع وانتقال (Ctrl+K)"><i class="bi bi-search" aria-hidden="true"></i><span>ابحث عن حجز أو عميل أو صفحة…</span><kbd>Ctrl K</kbd></button>
            <a class="btn btn-sm btn-brand hide-xs" href="#/orders/new"><i class="bi bi-plus-lg" aria-hidden="true"></i>حجز جديد</a>
            <a class="btn btn-ghost btn-icon hide-xs" href="index.html" target="_blank" rel="noopener" aria-label="فتح الموقع العام" title="الموقع العام"><i class="bi bi-shop" aria-hidden="true"></i></a>
            <button type="button" class="btn btn-ghost btn-icon" data-action="theme" aria-label="تبديل الوضع الليلي" title="تبديل الوضع (T)">${UI.themeIcon()}</button>
            <div class="dropdown"><button class="btn btn-ghost user-btn" data-bs-toggle="dropdown" aria-expanded="false" aria-label="حساب المستخدم"><span class="avatar" aria-hidden="true">${initials(user)}</span></button>
              <ul class="dropdown-menu dropdown-menu-start"><li><span class="dropdown-item-text small text-muted">مسجل الدخول: ${user}</span></li><li><a class="dropdown-item" href="#/settings"><i class="bi bi-gear me-2" aria-hidden="true"></i>الإعدادات</a></li><li><button class="dropdown-item" data-shortcuts><i class="bi bi-keyboard me-2" aria-hidden="true"></i>اختصارات لوحة المفاتيح</button></li><li><hr class="dropdown-divider"></li><li><button class="dropdown-item text-danger" data-logout><i class="bi bi-box-arrow-right me-2" aria-hidden="true"></i>تسجيل الخروج</button></li></ul></div>
          </div>
        </header>
        <main class="adm-main" id="adm-main" tabindex="-1"></main>
      </div></div>`);
    UI.theme.apply(UI.theme.get());
    qs('[data-logout]').addEventListener('click', logout);
    qs('[data-side-toggle]').addEventListener('click', A.toggleSidebar);
    qs('[data-shortcuts]').addEventListener('click', () => A.palette && A.palette.shortcuts());
    qs('[data-cmdk]').addEventListener('click', () => A.palette && A.palette.open());
    const adm = qs('.adm');
    adm.addEventListener('transitionend', (e) => { if (e.target === adm) syncNavInk(); });
  }
  A.toggleSidebar = () => {
    const adm = qs('.adm'); if (!adm) return;
    const on = !adm.classList.contains('is-collapsed');
    adm.classList.toggle('is-collapsed', on);
    try { localStorage.setItem(COLLAPSE_KEY, on ? '1' : '0'); } catch (e) {}
    const btn = qs('[data-side-toggle]'); if (btn) btn.setAttribute('aria-expanded', String(!on));
    setTimeout(syncNavInk, 480);
  };
  const syncNavInk = () => M.ink(qs('.adm-nav'));
  function updateNavCounts() {
    const n = A.db().bookings.filter((b) => b.status === 'pending').length;
    qsa('[data-pending]').forEach((el) => { el.textContent = n; el.hidden = !n; });
  }
  const groupOf = (nav) => { const g = NAV.find(([, items]) => items.some(([k]) => k === nav)); return g ? g[0] : ''; };

  // ---------- Router ----------
  function route(keepScroll) {
    if (!A.user()) return loginView();
    if (!qs('#adm-main')) shell();
    const path = (location.hash.replace(/^#/, '') || '/dashboard').split('?')[0];
    if (path === '/login' || path === '/') { location.replace('#/dashboard'); return; }
    let r = null, m = null;
    for (const x of A.routes) { m = path.match(x.re); if (m) { r = x; break; } }
    const main = A.main();
    main.onclick = null; main.onchange = null; main.oninput = null; main.onsubmit = null;
    A.current = { name: r ? r.name : '404', onData: null };
    qs('#adm-title').textContent = r ? r.title : 'غير موجود';
    qs('#adm-group').textContent = r ? groupOf(r.nav) : '';
    document.title = `${r ? r.title : 'غير موجود'} | لوحة تحكم نقاء`;
    qsa('[data-nav]').forEach((a) => { const on = r && a.dataset.nav === r.nav; a.classList.toggle('active', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
    try {
      if (!r) A.set(UI.empty('bi-signpost-split', 'الصفحة غير موجودة', '', html`<a class="btn btn-brand" href="#/dashboard">لوحة المتابعة</a>`));
      else { const res = r.fn(...m.slice(1)); A.current.onData = (res && res.onData) || (() => r.fn(...m.slice(1))); }
    } catch (e) {
      console.error(e);
      A.set(UI.empty('bi-bug', 'حدث خطأ أثناء عرض الصفحة', e.message, html`<a class="btn btn-brand" href="#/settings">فحص البيانات</a>`));
    }
    const oc = qs('#admnav'); if (oc && window.bootstrap) { const i = bootstrap.Offcanvas.getInstance(oc); if (i) i.hide(); }
    if (!keepScroll) window.scrollTo(0, 0);
    updateNavCounts();
    M.scan(main, { instant: !!keepScroll });
    syncNavInk();
  }
  /** Same-page re-render after a filter/state change: keep scroll, no entrance motion. */
  A.rerender = () => route(true);
  /** Navigate with the page transition (used for hash changes). */
  const navigate = () => {
    if (!A.user() || !qs('#adm-main')) return route();
    M.navigate(() => route(), A.main());
  };

  function boot() {
    UI.theme.init();
    M.init();
    S.load();
    if (S.corrupt) return UI.recovery(root);
    window.addEventListener('hashchange', navigate);
    window.addEventListener('resize', NQ.u.debounce(syncNavInk, 120));
    S.subscribe(() => {
      if (!S.db) return;
      if (!A.user() || !A.current) return;
      const y = scrollY;
      try { A.current.onData && A.current.onData(); } catch (e) { console.error(e); }
      scrollTo(0, y);
      M.scan(A.main(), { instant: true });
      updateNavCounts();
    });
    if (S.issues.length) setTimeout(() => UI.toast(`تمت معالجة بيانات تالفة: ${S.issues[0]}`, 'warning'), 400);
    route();
    if (qs('#adm-main')) M.enter(A.main());
  }
  document.addEventListener('DOMContentLoaded', boot);
})(window.NQ = window.NQ || {});
