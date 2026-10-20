/* Naqaa demo — motion engine shared by the site and the dashboard.
 * Responsibilities: page transitions, theme switch transition, scroll reveals,
 * number count-ups, sticky-header state, scroll progress, parallax, cursor highlight
 * and sliding "ink" indicators for navigation.
 * Every effect is progressive: content is fully usable without it, and
 * prefers-reduced-motion turns all of it into instant state changes. */
(function (NQ) {
  'use strict';
  const doc = document.documentElement;
  const mqReduced = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => mqReduced.matches;
  const canVT = () => typeof document.startViewTransition === 'function' && !reduced();
  doc.classList.add('js-motion');

  // ---------- Page transitions ----------
  /** Swap page content with a cross-page transition. `update` must render synchronously. */
  function navigate(update, root) {
    resetObserver();
    if (!canVT()) { update(); enter(root); return; }
    doc.classList.add('vt-route');
    const t = document.startViewTransition(() => { update(); enter(root); });
    t.finished.finally(() => doc.classList.remove('vt-route'));
  }

  /** Staggered entrance of a container's direct children. */
  function enter(root) {
    if (!root || reduced()) return;
    Array.from(root.children).forEach((c, i) => c.style.setProperty('--enter-i', Math.min(i, 8)));
    root.classList.remove('is-entering');
    void root.offsetWidth; // restart the animation
    root.classList.add('is-entering');
    clearTimeout(root._nqEnter);
    root._nqEnter = setTimeout(() => root.classList.remove('is-entering'), 1100);
  }

  // ---------- Theme switch: circular reveal from the toggle ----------
  function themeSwitch(apply, origin) {
    if (reduced()) { apply(); return; }
    if (!canVT()) {
      doc.classList.add('theme-fade');
      apply();
      setTimeout(() => doc.classList.remove('theme-fade'), 500);
      return;
    }
    const x = origin ? origin.x : innerWidth / 2;
    const y = origin ? origin.y : 0;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    doc.classList.add('vt-theme');
    const t = document.startViewTransition(apply);
    t.ready.then(() => {
      doc.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 700, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' },
      );
    }).catch(() => {});
    t.finished.finally(() => doc.classList.remove('vt-theme'));
  }

  // ---------- Reveal + count-up on scroll ----------
  let io = null;
  function observer() {
    if (io) return io;
    if (!('IntersectionObserver' in window)) return null;
    io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        if (e.target.hasAttribute('data-reveal')) e.target.classList.add('is-in');
        if (e.target.hasAttribute('data-count')) countUp(e.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
    return io;
  }
  function resetObserver() { if (io) { io.disconnect(); io = null; } }

  /** Prepare reveals/counters inside root. `instant` = data re-render: show final state now. */
  function scan(root, opts) {
    root = root || document;
    const instant = !!(opts && opts.instant) || reduced();
    root.querySelectorAll('[data-stagger]').forEach((g) => {
      Array.from(g.children).forEach((c, i) => {
        c.style.setProperty('--i', Math.min(i, 10));
        if (!c.hasAttribute('data-reveal')) c.setAttribute('data-reveal', g.dataset.stagger || '');
      });
    });
    const obs = instant ? null : observer();
    root.querySelectorAll('[data-reveal]:not(.is-in), [data-count]:not(.is-counted)').forEach((el) => {
      if (el._nqWatch && io) return; // already waiting to scroll into view
      if (obs) { el._nqWatch = true; obs.observe(el); return; }
      if (el.hasAttribute('data-reveal')) el.classList.add('is-in', 'no-trans');
      el.classList.add('is-counted'); // final text is already rendered
    });
  }

  const FMT = {
    money: (v) => NQ.u.money(v),
    num: (v) => NQ.u.num(v),
    pct: (v) => `${NQ.u.num(v)}%`,
  };
  /** Animate a number from 0 to data-count; the server-rendered text is restored at the end. */
  function countUp(el) {
    if (el.classList.contains('is-counted')) return;
    el.classList.add('is-counted');
    const target = Number(el.dataset.count);
    if (!isFinite(target) || target === 0 || reduced()) return;
    const final = el.textContent;
    const fmt = FMT[el.dataset.fmt] || FMT.num;
    const dur = Math.min(1700, 750 + Math.log10(Math.abs(target) + 1) * 220);
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = p < 1 ? fmt(Math.round(target * eased)) : final;
      if (p < 1 && el.isConnected) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ---------- Scroll-driven chrome ----------
  function scrollChrome() {
    let lastY = scrollY, ticking = false;
    const update = () => {
      ticking = false;
      const y = Math.max(0, scrollY);
      const header = document.querySelector('[data-scroll-header]');
      if (header) {
        header.classList.toggle('is-scrolled', y > 8);
        // hide on fast downward scroll past the fold, show again on any upward scroll
        const goingDown = y > lastY + 4, goingUp = y < lastY - 4;
        if (goingDown && y > 520 && !header.contains(document.activeElement)) header.classList.add('is-hidden');
        else if (goingUp || y < 520) header.classList.remove('is-hidden');
      }
      const bar = document.querySelector('[data-scroll-progress]');
      if (bar) { const max = doc.scrollHeight - innerHeight; bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`; }
      if (!reduced() && y < innerHeight * 1.4) {
        document.querySelectorAll('[data-parallax]').forEach((el) => {
          el.style.transform = `translate3d(0, ${(y * Number(el.dataset.parallax || 0.2)).toFixed(1)}px, 0)`;
        });
      }
      lastY = y;
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener('resize', () => requestAnimationFrame(update), { passive: true });
    update();
    return update;
  }

  // ---------- Cursor highlight for [data-spot] cards ----------
  function pointerFx() {
    if (matchMedia('(hover: none)').matches) return;
    document.addEventListener('pointermove', (e) => {
      const el = e.target.closest && e.target.closest('[data-spot]');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    }, { passive: true });
  }

  // ---------- Sliding "ink" indicator behind the active nav item ----------
  /** container must be position:relative and draw the ink from --ink-* custom properties. */
  function ink(container, selector) {
    if (!container) return;
    const active = container.querySelector(selector || '.active');
    if (!active || !active.offsetParent) { container.style.setProperty('--ink-o', '0'); return; }
    container.style.setProperty('--ink-x', `${active.offsetLeft}px`);
    container.style.setProperty('--ink-y', `${active.offsetTop}px`);
    container.style.setProperty('--ink-w', `${active.offsetWidth}px`);
    container.style.setProperty('--ink-h', `${active.offsetHeight}px`);
    container.style.setProperty('--ink-o', '1');
    if (!container.classList.contains('ink-ready')) requestAnimationFrame(() => container.classList.add('ink-ready'));
  }

  /** Wrap each word of plain text for the masked word-rise headline effect. */
  const splitWords = (text, offset) => NQ.u.html`${String(text).split(/\s+/).filter(Boolean).map((w, i) => NQ.u.html`<span class="w"><span style="--i:${i + (offset || 0)}">${w}</span></span> `)}`;

  function init() {
    scrollChrome();
    pointerFx();
    mqReduced.addEventListener && mqReduced.addEventListener('change', () => scan(document, { instant: true }));
  }

  NQ.motion = { reduced, navigate, enter, themeSwitch, scan, countUp, ink, splitWords, init };
})(window.NQ = window.NQ || {});
