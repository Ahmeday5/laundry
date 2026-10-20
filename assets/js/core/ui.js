/* Naqaa demo — shared UI helpers: theme, toasts, dialogs, badges, illustrations, charts. */
(function (NQ) {
  'use strict';
  const { html, raw, esc, money, num } = NQ.u;
  const THEME_KEY = 'naqaa_theme';
  const THEME_COLOR = { light: '#102421', dark: '#0A0C0B' };
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Theme ----------
  const theme = {
    get() { try { return localStorage.getItem(THEME_KEY) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch (e) { return 'light'; } },
    apply(t) {
      const root = document.documentElement;
      root.setAttribute('data-theme', t);
      root.setAttribute('data-bs-theme', t);
      NQ.u.qsa('[data-action="theme"]').forEach((b) => b.setAttribute('aria-pressed', String(t === 'dark')));
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', THEME_COLOR[t] || THEME_COLOR.light);
    },
    /** origin = {x, y} viewport point the reveal grows from (the toggle button). */
    toggle(origin) {
      const t = theme.get() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
      const apply = () => theme.apply(t);
      if (NQ.motion) NQ.motion.themeSwitch(apply, origin); else apply();
      document.dispatchEvent(new CustomEvent('nq:theme', { detail: t }));
    },
    init() {
      theme.apply(theme.get());
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="theme"]');
        if (!btn) return;
        const r = btn.getBoundingClientRect();
        const fromPointer = e.clientX || e.clientY;
        theme.toggle(fromPointer ? { x: e.clientX, y: e.clientY } : { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      });
    },
  };
  window.addEventListener('storage', (e) => { if (e.key === THEME_KEY) theme.apply(theme.get()); });
  const themeIcon = () => html`<span class="theme-ico" aria-hidden="true"><i class="bi bi-moon-stars"></i><i class="bi bi-sun"></i></span>`;

  // ---------- Toasts ----------
  const TOAST_ICON = { success: 'bi-check-lg', danger: 'bi-exclamation-octagon', warning: 'bi-exclamation-triangle', info: 'bi-info-lg' };
  function toast(message, tone, opts) {
    tone = tone || 'success';
    let host = document.getElementById('nq-toasts');
    if (!host) { host = document.createElement('div'); host.id = 'nq-toasts'; host.className = 'nq-toasts'; host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
    while (host.children.length >= 4) host.firstElementChild.remove();
    const life = (opts && opts.life) || (tone === 'danger' ? 6500 : 4200);
    const el = document.createElement('div');
    el.className = `nq-toast nq-toast-${tone}`;
    el.setAttribute('role', tone === 'danger' ? 'alert' : 'status');
    el.style.setProperty('--life', `${life}ms`);
    el.innerHTML = `<span class="ico"><i class="bi ${TOAST_ICON[tone] || TOAST_ICON.info}" aria-hidden="true"></i></span><span class="msg"></span><button type="button" class="x" aria-label="إغلاق التنبيه"><i class="bi bi-x-lg" aria-hidden="true"></i></button><span class="bar" aria-hidden="true"></span>`;
    el.querySelector('.msg').textContent = message;
    let gone = false;
    const close = () => { if (gone) return; gone = true; el.classList.add('out'); setTimeout(() => el.remove(), 300); };
    el.querySelector('.x').addEventListener('click', close);
    // The progress bar drives the lifetime, so hovering (which pauses it) keeps the toast open.
    if (reducedMotion()) setTimeout(close, life);
    else el.querySelector('.bar').addEventListener('animationend', close);
    host.appendChild(el);
  }

  // ---------- Modal (Bootstrap) ----------
  let modalEl, modalObj;
  function ensureModal() {
    if (modalEl) return;
    modalEl = document.createElement('div');
    modalEl.className = 'modal fade';
    modalEl.tabIndex = -1;
    modalEl.setAttribute('aria-hidden', 'true');
    modalEl.innerHTML = `<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable"><div class="modal-content"><div class="modal-header"><h2 class="modal-title h5" id="nq-modal-title"></h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="إغلاق"></button></div><div class="modal-body"></div><div class="modal-footer"></div></div></div>`;
    modalEl.setAttribute('aria-labelledby', 'nq-modal-title');
    document.body.appendChild(modalEl);
    modalObj = new bootstrap.Modal(modalEl);
  }
  /** opts: {title, body: SafeHTML, footer: SafeHTML, size: 'lg'|'sm', onMount(root)} */
  function modal(opts) {
    ensureModal();
    const dlg = modalEl.querySelector('.modal-dialog');
    dlg.classList.remove('modal-lg', 'modal-sm', 'modal-xl');
    if (opts.size) dlg.classList.add('modal-' + opts.size);
    modalEl.querySelector('.modal-title').textContent = opts.title || '';
    modalEl.querySelector('.modal-body').innerHTML = String(opts.body || '');
    const f = modalEl.querySelector('.modal-footer');
    f.innerHTML = String(opts.footer || '');
    f.hidden = !opts.footer;
    if (opts.onMount) opts.onMount(modalEl);
    modalObj.show();
    return { el: modalEl, close: () => modalObj.hide() };
  }
  const closeModal = () => modalObj && modalObj.hide();
  const modalOpen = () => !!(modalEl && modalEl.classList.contains('show'));

  /** Promise-based confirmation. Resolves true/false. */
  function confirm(opts) {
    return new Promise((resolve) => {
      let done = false;
      modal({
        title: opts.title || 'تأكيد',
        size: 'sm',
        body: html`<p class="mb-0">${opts.message}</p>${opts.detail ? html`<p class="small text-muted mt-2 mb-0">${opts.detail}</p>` : ''}`,
        footer: html`<button type="button" class="btn btn-ghost" data-bs-dismiss="modal">${opts.cancelText || 'تراجع'}</button><button type="button" class="btn ${opts.danger ? 'btn-danger' : 'btn-brand'}" data-ok>${opts.okText || 'تأكيد'}</button>`,
        onMount(root) {
          root.querySelector('[data-ok]').addEventListener('click', () => { done = true; resolve(true); closeModal(); }, { once: true });
          root.addEventListener('hidden.bs.modal', () => { if (!done) resolve(false); }, { once: true });
        },
      });
    });
  }

  // ---------- Badges ----------
  const statusBadge = (s) => { const st = NQ.workflow.STATUS[s] || { label: s, tone: 'secondary', icon: 'bi-circle' }; return html`<span class="nq-badge tone-${st.tone}"><i class="bi ${st.icon}" aria-hidden="true"></i>${st.label}</span>`; };
  const payBadge = (s) => { const st = NQ.finance.PAY_STATUS[s]; return html`<span class="nq-badge soft tone-${st.tone}">${st.label}</span>`; };

  // ---------- Numbers ----------
  /** A number that counts up when it scrolls into view (see NQ.motion.scan). */
  const count = (value, fmt) => html`<span class="tnum" data-count="${value}" data-fmt="${fmt || 'num'}">${fmt === 'money' ? money(value) : num(value)}</span>`;
  const RTF = (() => { try { return new Intl.RelativeTimeFormat('ar-EG-u-nu-latn', { numeric: 'auto' }); } catch (e) { return null; } })();
  /** "منذ 5 دقائق" style relative time; falls back to the absolute date. */
  function ago(iso) {
    const t = new Date(iso).getTime();
    if (!RTF || !isFinite(t)) return NQ.u.fmtDateTime(iso);
    const s = Math.round((t - Date.now()) / 1000);
    const a = Math.abs(s);
    if (a < 45) return 'الآن';
    if (a < 3600) return RTF.format(Math.round(s / 60), 'minute');
    if (a < 86400) return RTF.format(Math.round(s / 3600), 'hour');
    if (a < 86400 * 7) return RTF.format(Math.round(s / 86400), 'day');
    return NQ.u.fmtDateTime(iso);
  }

  // ---------- Brand mark ----------
  const logo = (sub) => html`<span class="nq-logo"><svg viewBox="0 0 40 40" aria-hidden="true" class="nq-logo-mark"><path d="M20 3c6 8 12 14 12 21a12 12 0 0 1-24 0C8 17 14 11 20 3Z" fill="currentColor"/><path d="M13 25c3 3 11 3 14 0" stroke="var(--logo-cut)" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M14 20c3 2.4 9 2.4 12 0" stroke="var(--logo-cut)" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".55"/></svg><span class="nq-logo-text">نقاء${sub ? html`<small>${sub}</small>` : ''}</span></span>`;

  // ---------- Service illustrations (inline SVG; never a broken image) ----------
  const ART = {
    cat_sofa: '<rect x="30" y="70" width="140" height="44" rx="10" class="a2"/><rect x="40" y="48" width="120" height="36" rx="10" class="a1"/><rect x="22" y="64" width="22" height="52" rx="8" class="a3"/><rect x="156" y="64" width="22" height="52" rx="8" class="a3"/><rect x="36" y="114" width="8" height="12" rx="2" class="a3"/><rect x="156" y="114" width="8" height="12" rx="2" class="a3"/><path d="M60 40c6-10 14-10 20 0M100 34c6-10 14-10 20 0" class="steam"/>',
    cat_carpet: '<rect x="34" y="36" width="132" height="88" rx="4" class="a1"/><rect x="46" y="48" width="108" height="64" rx="2" class="a2"/><path d="M100 54l22 26-22 26-22-26Z" class="a3"/><path d="M100 68l10 12-10 12-10-12Z" class="a1"/>' + Array.from({ length: 12 }, (_, i) => `<path d="M${40 + i * 11} 124v8M${40 + i * 11} 28v8" class="fringe"/>`).join(''),
    cat_mattress: '<rect x="28" y="62" width="144" height="46" rx="14" class="a1"/><path d="M28 80h144" class="quilt"/><path d="M52 64v42M76 64v42M100 64v42M124 64v42M148 64v42" class="quilt"/><rect x="38" y="46" width="44" height="20" rx="8" class="a2"/><path d="M130 40l6 6m0-6l-6 6M146 30l4 4m0-4l-4 4" class="spark"/>',
    cat_home: '<rect x="40" y="30" width="120" height="8" rx="4" class="a3"/><path d="M50 38c0 30-6 60-12 88h44c-6-28-8-58-8-88Z" class="a1"/><path d="M150 38c0 30 6 60 12 88h-44c6-28 8-58 8-88Z" class="a2"/><path d="M60 50v60M140 50v60" class="quilt"/>',
  };
  function serviceArt(service, cls) {
    if (service && service.image) return html`<img class="${cls || ''} nq-art-img" src="${service.image}" alt="${service.name}" loading="lazy">`;
    const key = service && ART[service.categoryId] ? service.categoryId : 'cat_home';
    return html`<svg class="nq-art ${cls || ''} art-${key}" viewBox="0 0 200 150" role="img" aria-label="${service ? service.name : ''}"><rect width="200" height="150" class="bg"/><g class="weave">${raw(Array.from({ length: 10 }, (_, i) => `<path d="M0 ${i * 16}h200"/>`).join(''))}</g>${raw(ART[key])}</svg>`;
  }

  // ---------- Empty state ----------
  const empty = (icon, title, text, action) => html`<div class="nq-empty"><i class="bi ${icon}" aria-hidden="true"></i><h3>${title}</h3>${text ? html`<p>${text}</p>` : ''}${action || ''}</div>`;

  // ---------- Charts (SVG, drawn from data passed in; LTR time axis) ----------
  function niceMax(v) { if (v <= 0) return 10; const p = Math.pow(10, Math.floor(Math.log10(v))); return Math.ceil(v / p) * p; }
  const f1 = (n) => n.toFixed(1);
  /** Monotone cubic interpolation (Fritsch–Carlson): smooth, never overshoots below zero. */
  function smoothPath(pts) {
    const n = pts.length;
    if (!n) return '';
    if (n < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${f1(p[0])} ${f1(p[1])}`).join(' ');
    const dx = [], m = [], t = [];
    for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1); }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += ` C${f1(pts[i][0] + h)} ${f1(pts[i][1] + t[i] * h)} ${f1(pts[i + 1][0] - h)} ${f1(pts[i + 1][1] - t[i + 1] * h)} ${f1(pts[i + 1][0])} ${f1(pts[i + 1][1])}`;
    }
    return d;
  }
  let chartSeq = 0;
  function lineChart(labels, series, opts) {
    opts = opts || {};
    const id = `ch${++chartSeq}`;
    const W = 640, H = 250, L = 56, R = 14, T = 14, B = 34;
    const maxV = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
    const n = Math.max(1, labels.length - 1);
    const x = (i) => L + (i * (W - L - R)) / n;
    const y = (v) => T + (H - T - B) * (1 - v / maxV);
    const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => `<line x1="${L}" x2="${W - R}" y1="${y(maxV * f)}" y2="${y(maxV * f)}" class="grid"/><text x="${L - 10}" y="${y(maxV * f) + 4}" class="ax" text-anchor="end">${num(maxV * f)}</text>`).join('');
    const every = Math.ceil(labels.length / 8);
    const xl = labels.map((l, i) => (i % every === 0 || i === labels.length - 1 ? `<text x="${x(i)}" y="${H - 10}" class="ax" text-anchor="middle">${esc(l)}</text>` : '')).join('');
    const defs = series.slice(0, 2).map((s, si) => `<linearGradient id="${id}g${si}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" class="stop-s${si}" stop-opacity="${si ? '.14' : '.26'}"/><stop offset="1" class="stop-s${si}" stop-opacity="0"/></linearGradient>`).join('');
    const paths = series.map((s, si) => {
      const pts = s.values.map((v, i) => [x(i), y(v)]);
      const d = smoothPath(pts);
      const area = labels.length > 1 && si < 2 ? `<path d="${d} L${f1(x(labels.length - 1))} ${f1(y(0))} L${f1(x(0))} ${f1(y(0))} Z" class="area s${si}" fill="url(#${id}g${si})"/>` : '';
      const dots = s.values.length <= 16 ? s.values.map((v, i) => `<circle cx="${f1(x(i))}" cy="${f1(y(v))}" r="3" class="dot s${si}"><title>${esc(labels[i])}: ${esc(money(v))}</title></circle>`).join('') : '';
      return `${area}<path d="${d}" class="line s${si}" pathLength="1"/>${dots}`;
    }).join('');
    const hover = `<line class="guide" x1="0" x2="0" y1="${T}" y2="${H - B}"/>${series.map((_, si) => `<circle class="hdot s${si}" r="4.5" cx="-10" cy="-10"/>`).join('')}`;
    const legend = series.map((s, i) => html`<span class="lg"><i class="sw s${i}"></i>${s.name}</span>`);
    const data = JSON.stringify({ W, H, L, R, T, B, max: maxV, labels, series: series.map((s) => ({ name: s.name, values: s.values })) });
    return html`<div class="nq-chart" data-chart="${data}"><svg viewBox="0 0 ${W} ${H}" dir="ltr" role="img" aria-label="${opts.label || 'رسم بياني'}"><defs>${raw(defs)}</defs>${raw(grid + xl + paths + hover)}</svg><div class="chart-tip" aria-hidden="true"></div><div class="nq-legend">${legend}</div></div>`;
  }

  // Delegated hover: crosshair + tooltip for every chart on the page.
  let hoverChart = null;
  function chartHover(e) {
    const c = e.target.closest ? e.target.closest('.nq-chart[data-chart]') : null;
    if (hoverChart && hoverChart !== c) hoverChart.classList.remove('is-hover');
    hoverChart = c;
    if (!c) return;
    let g = c._nqChart;
    if (!g) { try { g = c._nqChart = JSON.parse(c.dataset.chart); } catch (err) { return; } }
    const svg = c.querySelector('svg');
    const r = svg.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * g.W;
    const count = g.labels.length;
    if (sx < g.L - 10 || sx > g.W - g.R + 10 || !count) { c.classList.remove('is-hover'); return; }
    const i = count < 2 ? 0 : Math.max(0, Math.min(count - 1, Math.round(((sx - g.L) / (g.W - g.L - g.R)) * (count - 1))));
    const xi = count < 2 ? g.L : g.L + (i * (g.W - g.L - g.R)) / (count - 1);
    const yOf = (v) => g.T + (g.H - g.T - g.B) * (1 - v / g.max);
    const tip = c.querySelector('.chart-tip');
    if (c._nqIdx !== i) {
      c._nqIdx = i;
      svg.querySelector('.guide').setAttribute('x1', xi);
      svg.querySelector('.guide').setAttribute('x2', xi);
      svg.querySelectorAll('.hdot').forEach((dot, si) => { dot.setAttribute('cx', xi); dot.setAttribute('cy', yOf(g.series[si].values[i] || 0)); });
      tip.innerHTML = String(html`<b>${g.labels[i]}</b>${g.series.map((s, si) => html`<div><span><i class="s${si}"></i>${s.name}</span><span class="tnum">${money(s.values[i] || 0)}</span></div>`)}`);
    }
    const cr = c.getBoundingClientRect();
    const px = r.left - cr.left + (xi / g.W) * r.width;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    const tx = px + 14 + tw > cr.width ? px - tw - 14 : px + 14;
    const ty = Math.max(0, Math.min(cr.height - th, e.clientY - cr.top - th / 2));
    tip.style.setProperty('--tx', `${Math.max(0, tx)}px`);
    tip.style.setProperty('--ty', `${ty}px`);
    c.classList.add('is-hover');
  }
  document.addEventListener('pointermove', chartHover, { passive: true });

  /** Tiny trend line for KPI tiles. */
  function sparkline(values, label) {
    if (!values || values.length < 2) return '';
    const W = 200, H = 38, P = 3;
    const max = Math.max(...values), min = Math.min(0, ...values), span = max - min || 1;
    const pts = values.map((v, i) => [P + (i * (W - 2 * P)) / (values.length - 1), P + (H - 2 * P) * (1 - (v - min) / span)]);
    const d = smoothPath(pts);
    return html`<svg class="nq-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${label || 'اتجاه'}"><path class="a" d="${d} L${f1(W - P)} ${H} L${P} ${H} Z"/><path class="l" d="${d}" pathLength="1"/></svg>`;
  }

  function barList(items, opts) {
    opts = opts || {};
    if (!items.length) return empty('bi-bar-chart', 'لا توجد بيانات في هذه الفترة', 'غيّر الفترة الزمنية لعرض النتائج.');
    const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
    return html`<ul class="nq-bars">${items.slice(0, opts.limit || 8).map((i, idx) => html`<li style="--i:${idx}"><div class="bl"><span>${i.label}</span><b>${opts.count ? num(i.value) : money(i.value)}</b></div><div class="bt"><i style="--w:${Math.max(2, (Math.abs(i.value) / max) * 100).toFixed(1)}%"></i></div></li>`)}</ul>`;
  }

  // ---------- Forms ----------
  function showFieldErrors(form, fields) {
    NQ.u.qsa('.is-invalid', form).forEach((el) => el.classList.remove('is-invalid'));
    NQ.u.qsa('.invalid-feedback[data-for]', form).forEach((el) => { el.textContent = ''; });
    let first = null;
    Object.entries(fields || {}).forEach(([k, msg]) => {
      const input = form.querySelector(`[name="${k}"]`);
      const fb = form.querySelector(`.invalid-feedback[data-for="${k}"]`);
      if (input) { input.classList.add('is-invalid'); input.setAttribute('aria-invalid', 'true'); first = first || input; }
      if (fb) { fb.textContent = msg; fb.style.display = 'block'; first = first || fb; }
    });
    if (first) { first.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' }); if (first.focus) first.focus({ preventScroll: true }); }
  }

  /** Recovery screen when stored data cannot be parsed. */
  function recovery(root) {
    root.innerHTML = String(html`<div class="nq-recovery container"><i class="bi bi-database-exclamation" aria-hidden="true"></i><h1>تعذّرت قراءة البيانات التجريبية المحفوظة</h1><p>البيانات المخزنة في هذا المتصفح تالفة أو بصيغة غير معروفة، لذلك لم يتم تحميلها حتى لا يحدث خطأ في العرض.</p><button class="btn btn-brand btn-lg" data-restore>استعادة البيانات التجريبية</button><p class="small text-muted mt-3">سيتم حذف البيانات الحالية في هذا المتصفح واستبدالها ببيانات العرض الأصلية.</p></div>`);
    root.querySelector('[data-restore]').addEventListener('click', () => { NQ.store.reset(); location.reload(); });
  }

  NQ.ui = { theme, themeIcon, toast, modal, closeModal, modalOpen, confirm, statusBadge, payBadge, count, ago, logo, serviceArt, empty, lineChart, sparkline, barList, showFieldErrors, recovery };
})(window.NQ = window.NQ || {});
