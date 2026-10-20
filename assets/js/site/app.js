/* Naqaa demo — public customer website (hash-routed pages over the shared data layer) */
(function (NQ) {
  'use strict';
  const { html, raw, money, num, fmtDate, fmtTime, qs, qsa, DAY_NAMES, parseDate, maskPhone } = NQ.u;
  const S = NQ.store, UI = NQ.ui, P = NQ.pricing, SCH = NQ.schedule, WF = NQ.workflow, FIN = NQ.finance, M = NQ.motion;
  const PREFILL_KEY = 'naqaa_prefill', IDEM_KEY = 'naqaa_checkout_key', DRAFT_KEY = 'naqaa_checkout_draft';
  const app = document.getElementById('app');
  let current = null; // { name, onData }

  const db = () => S.db;
  const sget = (k) => { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const sset = (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const activeCats = () => db().categories.filter((c) => c.active).sort((a, b) => (a.order || 0) - (b.order || 0));
  const activeServices = () => db().services.filter((s) => s.active && (S.by(db().categories, s.categoryId) || {}).active);
  const wfTag = (wf) => wf === 'pickup' ? html`<span class="wf-tag"><i class="bi bi-truck" aria-hidden="true"></i>استلام وتسليم</span>` : html`<span class="wf-tag"><i class="bi bi-house-door" aria-hidden="true"></i>في بيتك</span>`;
  const set = (h) => { app.innerHTML = String(h); };

  // ---------- Cart ----------
  const cartKey = (sid, vid, opts) => [sid, vid || '', [...(opts || [])].sort().join('+')].join('|');
  function addToCart(service, sel) {
    const items = S.cart.get();
    const key = cartKey(service.id, sel.variantId, sel.optionIds);
    const lim = P.limits(service);
    const ex = items.find((i) => i.key === key);
    if (ex) ex.qty = Math.min(lim.max, NQ.u.round2(Number(ex.qty) + Number(sel.qty)));
    else items.push({ key, serviceId: service.id, qty: sel.qty, variantId: sel.variantId || null, optionIds: sel.optionIds || [] });
    S.cart.set(items);
    return !!ex;
  }
  let lastCartCount = null;
  function updateCartBadge() {
    const n = S.cart.get().length;
    const grew = lastCartCount !== null && n > lastCartCount;
    lastCartCount = n;
    qsa('[data-cart-count]').forEach((el) => {
      el.textContent = n; el.hidden = n === 0;
      if (grew) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    });
    const fc = qs('.float-cart');
    const show = n > 0 && current && !['cart', 'checkout', 'confirmation'].includes(current.name);
    document.body.classList.toggle('has-float-cart', show);
    if (fc && show) {
      const q = P.quoteCart(db(), S.cart.get(), null);
      fc.innerHTML = String(html`<a href="#/cart"><span><i class="bi bi-bag-check me-1" aria-hidden="true"></i>${n} ${n === 1 ? 'خدمة' : 'خدمات'} في الحجز</span><span>${money(q.subtotal)}</span></a>`);
    }
  }

  // ---------- Pages ----------
  function home() {
    const d = db();
    const areas = d.areas.filter((a) => a.active);
    const featured = activeServices().filter((s) => s.featured).slice(0, 4);
    const pre = sget(PREFILL_KEY);
    const areaId = (pre && pre.areaId && areas.some((a) => a.id === pre.areaId)) ? pre.areaId : (areas[0] || {}).id;
    const st = homeStats(areas);
    set(html`
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-weave" data-parallax="0.22" aria-hidden="true">${raw(weaveSVG())}</div>
        <div class="bubbles" aria-hidden="true">${bubbles(14)}</div>
        <div class="container inner">
          <div>
            <span class="hero-tag"><span class="live-dot" aria-hidden="true"></span>مواعيد متاحة هذا الأسبوع في ${areas.length} مناطق</span>
            <h1 id="hero-title" class="split">${M.splitWords(HERO_LEAD)} <span class="scribble">${M.splitWords(HERO_MARK, HERO_LEAD.split(' ').length)}<svg viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true"><path d="M3 13C40 5 88 4 122 9s58 8 75-3" pathLength="1"/></svg></span></h1>
            <p class="sub">ننظّف الكنب والمراتب في بيتك بالبخار، ونستلم السجاد والستائر ونرجّعها نظيفة ومغلفة. تعرف السعر كاملًا قبل ما تأكد الحجز.</p>
            <div class="ctas">
              <a class="btn btn-saffron btn-lg" href="#/services"><i class="bi bi-calendar-plus" aria-hidden="true"></i>احجز خدمة</a>
              <a class="btn btn-outline btn-lg" href="#/services">الخدمات والأسعار<i class="bi bi-arrow-left" aria-hidden="true"></i></a>
            </div>
            <div class="hero-facts">
              <span><i class="bi bi-geo-alt" aria-hidden="true"></i><b>${UI.count(areas.length)}</b> مناطق في غرب القاهرة والجيزة</span>
              <span><i class="bi bi-receipt" aria-hidden="true"></i>السعر شامل الانتقال قبل التأكيد</span>
            </div>
          </div>
          <div class="avail-card" id="avail">
            <div class="top"><h2>أقرب المواعيد المتاحة</h2><span class="live"><span class="live-dot" aria-hidden="true"></span>مباشر</span></div>
            <p class="hint">اختر منطقتك لترى المواعيد الفعلية المتاحة الآن.</p>
            <label class="form-label" for="hero-area">منطقة الخدمة</label>
            <select class="form-select" id="hero-area">${areas.map((a) => html`<option value="${a.id}" ${a.id === areaId ? 'selected' : ''}>${a.name}</option>`)}</select>
            <div class="avail-list" id="avail-list" aria-live="polite"></div>
            <div class="avail-fee" id="avail-fee"></div>
          </div>
        </div>
        <button type="button" class="scroll-cue btn p-0 border-0" data-scroll-to="#svc-h"><span class="mouse" aria-hidden="true"></span>اكتشف أكثر</button>
      </section>
      <div class="container">
        <div class="promise" data-stagger>
          <div><i class="bi bi-cash-coin" aria-hidden="true"></i><div><h3>سعر واضح قبل التأكيد</h3><p>تشوف تفاصيل كل بند ورسوم الانتقال والإجمالي قبل إرسال الحجز.</p></div></div>
          <div><i class="bi bi-person-check" aria-hidden="true"></i><div><h3>فريق واحد لموعد واحد</h3><p>كل فترة زمنية تُحجز لعميل واحد فقط، فلا استعجال ولا تأخير بسبب زيارة أخرى.</p></div></div>
          <div><i class="bi bi-truck" aria-hidden="true"></i><div><h3>استلام وتسليم للسجاد</h3><p>نستلم السجاد من بيتك ونتابعك بحالة الطلب حتى يرجع إليك.</p></div></div>
        </div>
      </div>
      <div class="ticker" aria-hidden="true"><div class="ticker-track">${tickerItems()}</div></div>
      <section class="section" aria-labelledby="svc-h">
        <div class="container">
          <div class="d-flex justify-content-between align-items-end flex-wrap gap-3 mb-5">
            <div class="sec-head" data-reveal><span class="eyebrow"><b>01</b>الخدمات</span><h2 id="svc-h">الخدمات الأكثر طلبًا</h2><p class="lead-muted mb-0">الأسعار تقديرية للعرض التجريبي وتُحسب تلقائيًا حسب الكمية.</p></div>
            <a class="btn btn-outline" href="#/services" data-reveal="fade">كل الخدمات<i class="bi bi-arrow-left" aria-hidden="true"></i></a>
          </div>
          <div class="svc-grid" data-stagger>${featured.map(svcCard)}</div>
        </div>
      </section>
      <div class="container"><div class="stats" data-reveal="scale" aria-label="نقاء بالأرقام">
        <div><span class="n">${UI.count(st.services)}</span><span class="l">خدمة تنظيف للكنب والسجاد والمراتب والستائر</span></div>
        <div><span class="n">${UI.count(areas.length)}</span><span class="l">مناطق بأيام وفترات ثابتة كل أسبوع</span></div>
        <div><span class="n">${UI.count(st.weeklySlots)}</span><span class="l">موعد متاح للحجز أسبوعيًا</span></div>
        <div><span class="n">${UI.count(st.fromPrice)}<small>ج.م</small></span><span class="l">يبدأ السعر من، قبل رسوم الانتقال</span></div>
      </div></div>
      <section class="section" aria-labelledby="cmp-h">
        <div class="container compare-wrap">
          <div data-reveal="start">
            <span class="eyebrow"><b>02</b>الفرق</span>
            <h2 id="cmp-h">اسحب وشوف الفرق بنفسك</h2>
            <p class="lead-muted">تنظيف عميق بالبخار وشفط قوي للمياه، يرجّع لون القماش ويزيل البقع والروائح بدون ما يأذي النسيج.</p>
            <ul class="check-list">
              <li><i class="bi bi-check2" aria-hidden="true"></i>اختبار المنظف على جزء غير ظاهر قبل البدء</li>
              <li><i class="bi bi-check2" aria-hidden="true"></i>إزالة البقع القديمة والأتربة المتراكمة داخل الألياف</li>
              <li><i class="bi bi-check2" aria-hidden="true"></i>تجفيف أسرع ورطوبة أقل بعد التنظيف</li>
            </ul>
            <a class="btn btn-brand btn-lg" href="#/services">اختر خدمتك<i class="bi bi-arrow-left" aria-hidden="true"></i></a>
          </div>
          <div data-reveal="scale">${compareWidget()}<p class="small text-muted mt-2 mb-0">رسم توضيحي للعرض التجريبي.</p></div>
        </div>
      </section>
      <section class="section-tight" aria-labelledby="how-h" style="background:var(--surface);border-block:1px solid var(--line)">
        <div class="container">
          <div class="sec-head mb-5" data-reveal><span class="eyebrow"><b>03</b>خطوات الحجز</span><h2 id="how-h">كيف يتم الحجز</h2></div>
          <ol class="steps" data-stagger>
            <li><h3>اختر الخدمة والكمية</h3><p>عدد المقاعد، أو مساحة السجاد بالمتر، أو عدد القطع. السعر يتحدث فورًا.</p></li>
            <li><h3>حدد المنطقة والموعد</h3><p>تظهر لك فقط المواعيد المتاحة فعليًا في منطقتك.</p></li>
            <li><h3>نتصل بك للتأكيد</h3><p>يراجع فريقنا الطلب ويتواصل معك لتأكيد الموعد والعنوان.</p></li>
            <li><h3>ننفذ ونتابع</h3><p>تابع حالة طلبك من رابط التتبع حتى الاكتمال.</p></li>
          </ol>
        </div>
      </section>
      <section class="section" aria-labelledby="areas-h">
        <div class="container">
          <div class="row g-4 g-lg-5">
            <div class="col-lg-5" data-reveal="start"><span class="eyebrow"><b>04</b>التغطية</span><h2 id="areas-h">المناطق والأيام</h2><p class="lead-muted">لكل منطقة أيام وفترات ثابتة كل أسبوع. رسوم الانتقال تُضاف مرة واحدة على الحجز مهما كان عدد الخدمات.</p><a class="btn btn-brand" href="#/services">ابدأ الحجز<i class="bi bi-arrow-left" aria-hidden="true"></i></a></div>
            <div class="col-lg-7"><div class="panel panel-pad" data-stagger="fade">${areas.map(areaRow)}</div></div>
          </div>
        </div>
      </section>
      <section class="section-tight" aria-labelledby="why-h">
        <div class="container">
          <div class="sec-head mb-5" data-reveal><span class="eyebrow"><b>05</b>لماذا نحن</span><h2 id="why-h">لماذا نقاء</h2></div>
          <div class="reasons" data-stagger>
            <div data-spot><i class="bi bi-droplet-half" aria-hidden="true"></i><div><h3>منظفات حسب نوع القماش</h3><p>نختبر المنظف على جزء غير ظاهر قبل البدء، خصوصًا مع الأقمشة الفاتحة والقطيفة.</p></div></div>
            <div data-spot><i class="bi bi-wind" aria-hidden="true"></i><div><h3>شفط قوي للمياه</h3><p>نقلل الرطوبة المتبقية حتى يجف الكنب أسرع ولا تظهر روائح.</p></div></div>
            <div data-spot><i class="bi bi-clipboard-check" aria-hidden="true"></i><div><h3>متابعة حالة الطلب</h3><p>رابط تتبع خاص بكل حجز يوضح المرحلة الحالية بدون كشف بياناتك الشخصية.</p></div></div>
            <div data-spot><i class="bi bi-wallet2" aria-hidden="true"></i><div><h3>دفع مرن</h3><p>نقدي أو تحويل بنكي أو إنستاباي، ويمكن الدفع على دفعات.</p></div></div>
          </div>
        </div>
      </section>
      <section class="section-tight" aria-labelledby="q-h">
        <div class="container">
          <div class="d-flex align-items-end justify-content-between gap-3 flex-wrap mb-5" data-reveal><div class="sec-head"><span class="eyebrow"><b>06</b>تجارب</span><h2 id="q-h" class="mb-0">آراء العملاء</h2></div><span class="demo-flag"><i class="bi bi-info-circle" aria-hidden="true"></i>نماذج توضيحية للعرض التجريبي</span></div>
          <div class="quotes" data-stagger>
            <figure class="quote"><blockquote><p>الكنب كان عليه بقع عصير من سنين، معظمها اختفى، والفريق كان ملتزم بالموعد.</p></blockquote><footer><span class="av" aria-hidden="true">ح</span>نموذج رأي — حدائق أكتوبر</footer></figure>
            <figure class="quote"><blockquote><p>استلموا السجاد يوم الأحد ورجع يوم الخميس متغلف ومفيهوش ريحة.</p></blockquote><footer><span class="av" aria-hidden="true">ز</span>نموذج رأي — الشيخ زايد</footer></figure>
            <figure class="quote"><blockquote><p>عرفت السعر بالظبط قبل ما أأكد، ومفيش أي زيادة يوم الزيارة.</p></blockquote><footer><span class="av" aria-hidden="true">أ</span>نموذج رأي — 6 أكتوبر</footer></figure>
          </div>
        </div>
      </section>
      <section class="section-tight" aria-labelledby="faq-h">
        <div class="container" style="max-width:860px">
          <div class="sec-head mb-4" data-reveal><span class="eyebrow"><b>07</b>أسئلة</span><h2 id="faq-h">أسئلة سريعة</h2></div>
          <div data-reveal>${faqAccordion(FAQ.slice(0, 4), 'hf')}</div>
          <a class="btn btn-ghost mt-3" href="#/faq">كل الأسئلة الشائعة<i class="bi bi-arrow-left" aria-hidden="true"></i></a>
        </div>
      </section>
      <section class="section-tight"><div class="container"><div class="cta-band" data-reveal="scale"><div><h2>جاهز تحدد موعدك؟</h2><p>اختر الخدمة، وحدد المنطقة، وشوف المواعيد المتاحة فورًا.</p></div><a class="btn btn-lg" href="#/services">احجز خدمة<i class="bi bi-arrow-left" aria-hidden="true"></i></a></div></div></section>
    `);
    const renderAvail = () => {
      const aId = qs('#hero-area').value;
      const area = S.by(db().areas, aId);
      const list = SCH.nextAvailable(db(), aId, 4);
      qs('#avail-list').innerHTML = String(list.length ? html`${list.map((x, i) => html`<button type="button" class="avail-item" style="--i:${i}" data-date="${x.date}" data-slot="${x.slot.id}"><span><span class="d">${fmtDate(x.date, { weekday: 'long', day: 'numeric', month: 'long' })}</span><br><span class="t">${fmtTime(x.slot.start)} – ${fmtTime(x.slot.end)}</span></span><i class="bi bi-chevron-left" aria-hidden="true"></i></button>`)}` : UI.empty('bi-calendar-x', 'لا توجد مواعيد متاحة حاليًا', 'جرّب منطقة أخرى أو تواصل معنا.'));
      qs('#avail-fee').innerHTML = String(area ? html`<span>رسوم الانتقال للمنطقة</span><b>${money(area.fee)}</b>` : '');
    };
    qs('#hero-area').addEventListener('change', renderAvail);
    qs('#avail-list').addEventListener('click', (e) => {
      const b = e.target.closest('[data-date]'); if (!b) return;
      sset(PREFILL_KEY, { areaId: qs('#hero-area').value, date: b.dataset.date, slotId: b.dataset.slot });
      UI.toast('حفظنا الموعد المختار. اختر الخدمة الآن وسيظهر الموعد في صفحة الحجز.', 'info');
      location.hash = '#/services';
    });
    qs('[data-scroll-to]').addEventListener('click', (e) => {
      const target = qs(e.currentTarget.dataset.scrollTo);
      if (target) target.scrollIntoView({ behavior: M.reduced() ? 'auto' : 'smooth', block: 'start' });
    });
    bindCompare(app);
    renderAvail();
    return { onData: renderAvail };
  }

  const HERO_LEAD = 'تنظيف الكنب والسجاد والمراتب بمواعيد محددة';
  const HERO_MARK = 'في منطقتك';

  /** Figures shown in the stats band — all derived from live data, nothing invented. */
  function homeStats(areas) {
    const d = db();
    const services = activeServices();
    const activeSlot = (id) => { const s = S.by(d.slots, id); return s && s.active; };
    const weeklySlots = areas.reduce((sum, a) => sum + Object.keys(a.coverage || {}).filter((k) => d.workdays[k]).reduce((n, k) => n + (a.coverage[k] || []).filter(activeSlot).length, 0), 0);
    const prices = services.map((s) => (s.variants && s.variants.length ? Math.min(...s.variants.map((v) => v.price)) : s.price)).filter((p) => p > 0);
    return { services: services.length, weeklySlots, fromPrice: prices.length ? Math.min(...prices) : 0 };
  }

  /** Deterministic pseudo-random bubbles (same layout on every visit). */
  const bubbles = (n) => raw(Array.from({ length: n }, (_, i) => {
    const x = (i * 37 + 11) % 100, s = 8 + ((i * 13) % 34), d = 14 + ((i * 7) % 12), delay = -((i * 2.3) % 20);
    return `<span style="--x:${x}%;--s:${s}px;--d:${d}s;--delay:${delay.toFixed(1)}s"></span>`;
  }).join(''));

  function tickerItems() {
    const names = activeServices().map((s) => s.name);
    const areas = db().areas.filter((a) => a.active).map((a) => a.name);
    let base = [...names, ...areas];
    if (!base.length) return '';
    while (base.length < 10) base = base.concat(base);
    // two identical halves so the loop is seamless
    return html`${[...base, ...base].map((t) => html`<span>${t}</span>`)}`;
  }

  /** Before/after slider over the sofa illustration; the range input keeps it keyboard-accessible. */
  function compareWidget() {
    const sofa = { categoryId: 'cat_sofa', name: '' };
    const stains = '<filter id="stainBlur"><feGaussianBlur stdDeviation="1.8"/></filter><g filter="url(#stainBlur)"><ellipse cx="72" cy="62" rx="11" ry="6"/><ellipse cx="122" cy="94" rx="15" ry="7"/><ellipse cx="94" cy="102" rx="7" ry="4"/><ellipse cx="141" cy="60" rx="8" ry="5"/><ellipse cx="56" cy="96" rx="10" ry="5"/><ellipse cx="34" cy="84" rx="5" ry="9"/></g>' +
      Array.from({ length: 26 }, (_, i) => `<circle class="dust" cx="${30 + ((i * 47) % 140)}" cy="${50 + ((i * 29) % 62)}" r="${0.8 + (i % 3) * 0.5}"/>`).join('');
    return html`<div class="compare" data-compare>
      <div class="layer after" aria-hidden="true">${UI.serviceArt(sofa)}</div>
      <div class="layer before" aria-hidden="true">${UI.serviceArt(sofa)}<svg class="stains" viewBox="0 0 200 150">${raw(stains)}</svg></div>
      <span class="tag b" aria-hidden="true">قبل</span><span class="tag a" aria-hidden="true">بعد</span>
      <div class="handle" aria-hidden="true"><span class="knob"><i class="bi bi-chevron-right"></i><i class="bi bi-chevron-left"></i></span></div>
      <input type="range" min="0" max="100" value="50" aria-label="اسحب للمقارنة بين الكنب قبل التنظيف وبعده">
    </div>`;
  }
  function bindCompare(root) {
    const c = qs('[data-compare]', root);
    if (!c) return;
    const input = qs('input', c);
    const setPos = (v) => c.style.setProperty('--pos', `${v}%`);
    input.addEventListener('input', () => { c.classList.remove('hint'); setPos(input.value); });
    if (M.reduced() || !('IntersectionObserver' in window)) return;
    // One-time "wiggle" so visitors discover the slider.
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      c.classList.add('hint');
      [30, 70, 50].forEach((v, i) => setTimeout(() => { if (c.classList.contains('hint')) { setPos(v); input.value = v; } }, 500 + i * 1150));
      setTimeout(() => c.classList.remove('hint'), 500 + 3 * 1150);
    }, { threshold: 0.55 });
    io.observe(c);
  }

  function weaveSVG() {
    let warp = '', weft = '';
    for (let i = 0; i < 90; i++) warp += `<path class="warp" d="M${i * 18} 0V900"/>`;
    for (let i = 0; i < 50; i++) weft += `<path class="weft" d="M0 ${i * 18}H1800"/>`;
    return `<svg viewBox="0 0 1600 700" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="cleanGrad" x1="0" x2="1"><stop offset="0" stop-color="#3FB3A8" stop-opacity="0"/><stop offset=".55" stop-color="#3FB3A8" stop-opacity=".16"/><stop offset="1" stop-color="#3FB3A8" stop-opacity=".02"/></linearGradient></defs>${warp}${weft}<g class="hero-sweep"><path class="clean" d="M-200 700 L520 0 L860 0 L140 700 Z"/></g></svg>`;
  }

  function areaRow(a) {
    const days = Object.keys(a.coverage).filter((k) => (a.coverage[k] || []).length && db().workdays[k]).sort();
    const slotsLbl = (k) => {
      const sl = a.coverage[k].map((id) => S.by(db().slots, id)).filter((s) => s && s.active).sort((x, y) => x.start.localeCompare(y.start));
      if (!sl.length) return '';
      const allAM = sl.every((s) => s.start < '12:00'), allPM = sl.every((s) => s.start >= '12:00');
      return `${DAY_NAMES[k]} ${allAM ? 'صباحًا' : allPM ? 'مساءً' : ''}`.trim();
    };
    const labels = days.map(slotsLbl).filter(Boolean);
    return html`<div class="area-row"><span class="n">${a.name}</span><span class="days">${labels.length ? labels.map((l) => html`<span>${l}</span>`) : html`<span>لا توجد أيام حاليًا</span>`}</span><span class="fee">${money(a.fee)}</span></div>`;
  }

  function svcCard(s) {
    return html`<article class="svc-card" data-spot>
      <div class="art">${UI.serviceArt(s)}${wfTag(s.workflow)}</div>
      <div class="body">
        <h3><a href="#/service/${s.id}">${s.name}</a></h3>
        <p>${s.short}</p>
        <div class="foot"><span class="price">${P.priceText(s)}</span><a class="more" href="#/service/${s.id}">التفاصيل<span class="go" aria-hidden="true"><i class="bi bi-arrow-left"></i></span></a></div>
      </div></article>`;
  }

  function services(params) {
    const cats = activeCats();
    let cat = params.get('cat') || 'all';
    if (cat !== 'all' && !cats.some((c) => c.id === cat)) cat = 'all';
    set(html`<div class="container page">
      <header class="page-head"><h1>الخدمات والأسعار</h1><p>اختر الخدمة لتحديد الكمية والإضافات، ثم أضفها إلى الحجز.</p></header>
      <div class="d-flex flex-wrap gap-3 justify-content-between align-items-center mb-4">
        <div class="chips" role="group" aria-label="تصفية حسب الفئة">
          <button type="button" class="chip" data-cat="all" aria-pressed="${cat === 'all'}">الكل</button>
          ${cats.map((c) => html`<button type="button" class="chip" data-cat="${c.id}" aria-pressed="${cat === c.id}">${c.name}</button>`)}
        </div>
        <div style="min-width:240px;flex:0 1 320px"><label class="visually-hidden" for="svc-q">ابحث عن خدمة</label><input id="svc-q" type="search" class="form-control" placeholder="ابحث عن خدمة…" value="${params.get('q') || ''}"></div>
      </div>
      <div id="svc-cat-desc" class="mb-3 text-muted"></div>
      <div id="svc-list"></div>
    </div>`);
    const draw = () => {
      const q = qs('#svc-q').value.trim();
      const list = activeServices().filter((s) => (cat === 'all' || s.categoryId === cat) && (!q || (s.name + s.short + s.desc).includes(q)));
      const c = S.by(db().categories, cat);
      qs('#svc-cat-desc').textContent = c ? c.desc : '';
      qs('#svc-list').innerHTML = String(list.length ? html`<div class="svc-grid" data-stagger="scale">${list.map(svcCard)}</div>` : UI.empty('bi-search', 'لا توجد خدمات مطابقة', 'جرّب كلمة أخرى أو اعرض كل الفئات.', html`<button class="btn btn-outline" data-clear>عرض كل الخدمات</button>`));
    };
    const redraw = () => { draw(); M.scan(qs('#svc-list')); };
    app.onclick = (e) => {
      const chip = e.target.closest('[data-cat]');
      if (chip) { cat = chip.dataset.cat; qsa('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', b === chip)); redraw(); history.replaceState(null, '', cat === 'all' ? '#/services' : `#/services?cat=${cat}`); }
      if (e.target.closest('[data-clear]')) { cat = 'all'; qs('#svc-q').value = ''; qsa('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.cat === 'all')); redraw(); }
    };
    qs('#svc-q').addEventListener('input', NQ.u.debounce(redraw, 150));
    draw();
    return { onData: draw };
  }

  function serviceDetail(params, id) {
    const s = S.by(db().services, id);
    const cat = s && S.by(db().categories, s.categoryId);
    if (!s || !s.active || !cat || !cat.active) {
      set(html`<div class="container page">${UI.empty('bi-exclamation-circle', 'هذه الخدمة غير متاحة حاليًا', 'ربما تم إيقافها مؤقتًا. تصفح الخدمات المتاحة.', html`<a class="btn btn-brand" href="#/services">الخدمات والأسعار</a>`)}</div>`);
      return;
    }
    const lim = P.limits(s);
    const pr = P.PRICING[s.pricing];
    const related = activeServices().filter((x) => x.categoryId === s.categoryId && x.id !== s.id).slice(0, 3);
    set(html`<div class="container page">
      <nav class="crumbs" aria-label="مسار الصفحة"><a href="#/">الرئيسية</a><span>/</span><a href="#/services?cat=${cat.id}">${cat.name}</a><span>/</span><span aria-current="page">${s.name}</span></nav>
      <div class="detail">
        <div class="art-lg">${UI.serviceArt(s)}</div>
        <div>
          ${wfTag(s.workflow)}
          <h1 class="mt-1">${s.name}</h1>
          <p class="desc">${s.desc}</p>
          <ul class="meta-list">
            <li><i class="bi bi-tag" aria-hidden="true"></i>طريقة التسعير: ${pr.name} — ${P.priceText(s)}</li>
            <li><i class="bi bi-rulers" aria-hidden="true"></i>الحد الأدنى: ${num(lim.min)} ${pr.qtyUnit}${s.pricing === 'per_sqm' ? ' — تُقرّب المساحة لأقرب نصف متر' : ''}</li>
            ${s.duration ? html`<li><i class="bi bi-clock" aria-hidden="true"></i>${s.duration}</li>` : ''}
            <li><i class="bi ${s.workflow === 'pickup' ? 'bi-truck' : 'bi-house-door'}" aria-hidden="true"></i>${s.workflow === 'pickup' ? 'نستلم القطع في موعد الزيارة ونعيدها بعد التنظيف' : 'تتم الخدمة في بيتك خلال الزيارة'}</li>
          </ul>
          <form class="configurator panel panel-pad" id="cfg" novalidate>
            ${s.variants && s.variants.length ? html`<fieldset class="opt-group"><legend class="form-label">النوع</legend>${s.variants.map((v, i) => html`<label class="opt"><input class="form-check-input" type="radio" name="variant" value="${v.id}" ${i === 0 ? 'checked' : ''}><span>${v.name}</span><span class="p">${money(v.price)} ${pr.unit}</span></label>`)}</fieldset>` : ''}
            ${s.options && s.options.length ? html`<fieldset class="opt-group"><legend class="form-label">إضافات اختيارية</legend>${s.options.map((o) => html`<label class="opt"><input class="form-check-input" type="checkbox" name="opt" value="${o.id}"><span>${o.name}</span><span class="p">+${money(o.price)} ${pr.unit}</span></label>`)}</fieldset>` : ''}
            <div class="opt-group"><label class="form-label" for="qty">${pr.qtyLabel}</label><div>${stepper('qty', lim.min, lim)}</div><div class="invalid-feedback" data-for="qty"></div><div class="form-text">من ${num(lim.min)} إلى ${num(lim.max)} ${pr.qtyUnit}</div></div>
            <div class="price-box"><div><div class="lbl">سعر هذا البند</div><div class="calc" id="calc"></div></div><div class="val" id="line-total" aria-live="polite"></div></div>
            <div class="d-flex gap-2 flex-wrap"><button type="submit" class="btn btn-brand btn-lg flex-grow-1" data-go="cart"><i class="bi bi-bag-plus" aria-hidden="true"></i>أضف إلى الحجز</button><button type="button" class="btn btn-outline btn-lg" data-go="checkout">احجز الآن</button></div>
          </form>
        </div>
      </div>
      ${related.length ? html`<section class="mt-5 pt-4" aria-labelledby="rel-h"><h2 id="rel-h" class="h4 mb-3" data-reveal>خدمات من نفس الفئة</h2><div class="svc-grid" data-stagger>${related.map(svcCard)}</div></section>` : ''}
    </div>`);
    const form = qs('#cfg');
    const sel = () => ({ qty: Number(qs('#qty').value), variantId: (qs('[name=variant]:checked', form) || {}).value || null, optionIds: qsa('[name=opt]:checked', form).map((i) => i.value) });
    const update = () => {
      const q = P.quoteLine(S.by(db().services, id), sel());
      const totalEl = qs('#line-total');
      const next = money(q.lineTotal || 0);
      if (totalEl.textContent && totalEl.textContent !== next) { totalEl.classList.remove('tick'); void totalEl.offsetWidth; totalEl.classList.add('tick'); }
      totalEl.textContent = next;
      qs('#calc').textContent = `(${money(q.unitPrice)}${q.optionsUnit ? ' + ' + money(q.optionsUnit) + ' إضافات' : ''}) × ${num(q.qty || 0)} ${pr.qtyUnit}`;
      UI.showFieldErrors(form, q.errors.length ? { qty: q.errors[0] } : {});
      stepperState(form);
      return q;
    };
    bindStepper(form, update);
    form.addEventListener('change', update);
    const add = (go) => {
      const q = update();
      if (!q.ok) return;
      const merged = addToCart(s, sel());
      UI.toast(merged ? 'تم تحديث الكمية في الحجز' : 'تمت إضافة الخدمة إلى الحجز');
      location.hash = go === 'checkout' ? '#/checkout' : '#/cart';
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); add('cart'); });
    qs('[data-go="checkout"]', form).addEventListener('click', () => add('checkout'));
    update();
  }

  function stepper(name, value, lim, extra) {
    return html`<div class="stepper ${extra || ''}"><button type="button" data-step="-1" aria-label="إنقاص">−</button><input id="${name}" name="${name}" type="number" inputmode="decimal" min="${lim.min}" max="${lim.max}" step="${lim.step}" value="${value}" aria-label="الكمية"><button type="button" data-step="1" aria-label="زيادة">+</button></div>`;
  }
  function bindStepper(root, onChange) {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-step]'); if (!b) return;
      const input = b.parentElement.querySelector('input');
      const step = Number(input.step) || 1;
      const v = NQ.u.clamp(NQ.u.round2((Number(input.value) || 0) + step * Number(b.dataset.step)), Number(input.min), Number(input.max));
      input.value = v;
      onChange(input);
    });
    root.addEventListener('input', (e) => { if (e.target.matches('.stepper input')) onChange(e.target); });
  }
  function stepperState(root) {
    qsa('.stepper', root).forEach((st) => {
      const i = st.querySelector('input'); const v = Number(i.value);
      st.querySelector('[data-step="-1"]').disabled = v <= Number(i.min);
      st.querySelector('[data-step="1"]').disabled = v >= Number(i.max);
    });
  }

  // ---------- Cart page ----------
  function cart() {
    const draw = () => {
      const items = S.cart.get();
      const q = P.quoteCart(db(), items, null);
      const fees = db().areas.filter((a) => a.active).map((a) => a.fee);
      if (!items.length) {
        set(html`<div class="container page"><header class="page-head"><h1>الحجز</h1></header><div class="panel">${UI.empty('bi-bag', 'لم تضف أي خدمة بعد', 'اختر خدمة وحدد الكمية لتظهر هنا مع السعر.', html`<a class="btn btn-brand" href="#/services">تصفح الخدمات</a>`)}</div></div>`);
        return;
      }
      const invalid = q.lines.some((l) => !l.ok);
      set(html`<div class="container page">
        <header class="page-head d-flex justify-content-between align-items-end flex-wrap gap-2"><div><h1>الحجز</h1><p>راجع الخدمات والكميات. الأسعار محسوبة من قائمة الأسعار الحالية.</p></div><button type="button" class="btn btn-ghost" data-clear-cart><i class="bi bi-trash3" aria-hidden="true"></i>تفريغ الحجز</button></header>
        <div class="layout-2">
          <div class="panel" id="lines" data-stagger="fade">${q.lines.map((l, idx) => cartLine(l, items[idx]))}</div>
          <aside class="sticky-side"><div class="panel panel-pad">
            <h2 class="h5 mb-3">ملخص الحجز</h2>
            <dl class="sum-rows">
              <div><dt>إجمالي الخدمات</dt><dd>${money(q.subtotal)}</dd></div>
              <div><dt>رسوم الانتقال</dt><dd class="text-muted fw-normal small">${fees.length ? `من ${money(Math.min(...fees))} إلى ${money(Math.max(...fees))} حسب المنطقة` : '—'}</dd></div>
            </dl>
            ${invalid ? html`<div class="note-box err mt-3"><i class="bi bi-exclamation-octagon" aria-hidden="true"></i><span>بعض البنود تحتاج تعديل قبل المتابعة.</span></div>` : ''}
            <a class="btn btn-brand btn-lg w-100 mt-3 ${invalid ? 'disabled' : ''}" href="#/checkout" ${invalid ? raw('aria-disabled="true" tabindex="-1"') : ''}>اختيار الموعد والعنوان</a>
            <a class="btn btn-ghost w-100 mt-2" href="#/services">إضافة خدمة أخرى</a>
          </div></aside>
        </div></div>`);
    };
    app.onclick = async (e) => {
      if (current.name !== 'cart') return;
      const rm = e.target.closest('[data-remove]');
      if (rm) {
        const key = rm.dataset.remove;
        const line = rm.closest('.cart-line');
        const commit = () => { S.cart.set(S.cart.get().filter((i) => i.key !== key)); UI.toast('تم حذف البند من الحجز', 'info'); };
        if (line && !M.reduced()) { line.classList.add('is-leaving'); setTimeout(commit, 280); } else commit();
        return;
      }
      if (e.target.closest('[data-clear-cart]')) {
        if (await UI.confirm({ title: 'تفريغ الحجز', message: 'سيتم حذف كل الخدمات المضافة.', okText: 'تفريغ الحجز', danger: true })) { S.cart.clear(); UI.toast('تم تفريغ الحجز', 'info'); }
        return;
      }
      const b = e.target.closest('[data-step]');
      if (b) {
        const input = b.parentElement.querySelector('input');
        const v = NQ.u.clamp(NQ.u.round2((Number(input.value) || 0) + (Number(input.step) || 1) * Number(b.dataset.step)), Number(input.min), Number(input.max));
        setQty(input.dataset.key, v);
      }
    };
    app.onchange = (e) => { if (current.name === 'cart' && e.target.matches('.stepper input')) setQty(e.target.dataset.key, Number(e.target.value)); };
    draw();
    return { onData: draw };
  }
  function setQty(key, v) {
    const items = S.cart.get(); const it = items.find((i) => i.key === key); if (!it || !isFinite(v)) return;
    it.qty = v; S.cart.set(items);
  }
  function cartLine(l, ci) {
    const s = l.service;
    const lim = s ? P.limits(s) : { min: 1, max: 1, step: 1 };
    const pr = s ? P.PRICING[s.pricing] : P.PRICING.fixed;
    return html`<div class="cart-line ${l.ok ? '' : 'invalid'}">
      <div class="thumb">${UI.serviceArt(s)}</div>
      <div>
        <h3>${s ? s.name : 'خدمة محذوفة'}</h3>
        <div class="sub">${l.variant ? l.variant.name + ' — ' : ''}${money(l.unitPrice || 0)} ${pr.unit}${l.options && l.options.length ? ' — ' + l.options.map((o) => o.name).join('، ') : ''}</div>
        ${l.ok ? '' : html`<div class="small text-danger mt-1">${l.errors.join(' — ')}</div>`}
        <div class="ctrl">
          ${s ? html`<div class="stepper sm"><button type="button" data-step="-1" aria-label="إنقاص" ${ci.qty <= lim.min ? 'disabled' : ''}>−</button><input type="number" data-key="${ci.key}" min="${lim.min}" max="${lim.max}" step="${lim.step}" value="${ci.qty}" aria-label="${pr.qtyLabel}"><button type="button" data-step="1" aria-label="زيادة" ${ci.qty >= lim.max ? 'disabled' : ''}>+</button></div><span class="small text-muted">${pr.qtyUnit}</span>` : ''}
          <button type="button" class="btn btn-sm btn-ghost" data-remove="${ci.key}"><i class="bi bi-x-lg" aria-hidden="true"></i>حذف</button>
        </div>
      </div>
      <div class="lt">${money(l.lineTotal || 0)}</div>
    </div>`;
  }

  // ---------- Checkout ----------
  function checkout() {
    const items = S.cart.get();
    if (!items.length) {
      set(html`<div class="container page"><div class="panel">${UI.empty('bi-bag', 'الحجز فارغ', 'أضف خدمة واحدة على الأقل قبل اختيار الموعد.', html`<a class="btn btn-brand" href="#/services">تصفح الخدمات</a>`)}</div></div>`);
      return;
    }
    if (!sget(IDEM_KEY)) sset(IDEM_KEY, NQ.u.randomHex(12));
    const draft = Object.assign({ name: '', phone: '', areaId: '', address: '', landmark: '', mapLink: '', notes: '', date: '', slotId: '' }, sget(DRAFT_KEY) || {});
    const pre = sget(PREFILL_KEY);
    if (pre) { Object.assign(draft, pre); sset(PREFILL_KEY, null); }
    const areas = db().areas.filter((a) => a.active);
    set(html`<div class="container page">
      <nav class="crumbs" aria-label="مسار الصفحة"><a href="#/cart">الحجز</a><span>/</span><span aria-current="page">الموعد والعنوان</span></nav>
      <header class="page-head"><h1>الموعد والعنوان</h1><p>الحقول المعلّمة بـ <span class="text-danger">*</span> مطلوبة.</p></header>
      <form id="co" class="layout-2" novalidate>
        <div class="panel">
          <section class="form-section"><h2><span class="n">1</span>بيانات التواصل</h2>
            <div class="row g-3">
              <div class="col-md-6"><label class="form-label" for="f-name">الاسم بالكامل<span class="req">*</span></label><input class="form-control" id="f-name" name="name" autocomplete="name" value="${draft.name}" required><div class="invalid-feedback" data-for="name"></div></div>
              <div class="col-md-6"><label class="form-label" for="f-phone">رقم الموبايل<span class="req">*</span></label><input class="form-control" id="f-phone" name="phone" type="tel" inputmode="tel" dir="ltr" autocomplete="tel" placeholder="01012345678" value="${draft.phone}" required><div class="invalid-feedback" data-for="phone"></div></div>
            </div>
          </section>
          <section class="form-section"><h2><span class="n">2</span>العنوان</h2>
            <div class="row g-3">
              <div class="col-md-6"><label class="form-label" for="f-area">منطقة الخدمة<span class="req">*</span></label><select class="form-select" id="f-area" name="areaId" required><option value="">اختر المنطقة</option>${areas.map((a) => html`<option value="${a.id}" ${a.id === draft.areaId ? 'selected' : ''}>${a.name} — انتقال ${money(a.fee)}</option>`)}</select><div class="invalid-feedback" data-for="areaId"></div></div>
              <div class="col-md-6"><label class="form-label" for="f-landmark">علامة مميزة قريبة</label><input class="form-control" id="f-landmark" name="landmark" placeholder="مثال: بجوار صيدلية…" value="${draft.landmark}"></div>
              <div class="col-12"><label class="form-label" for="f-address">العنوان بالتفصيل<span class="req">*</span></label><input class="form-control" id="f-address" name="address" autocomplete="street-address" placeholder="الشارع، رقم العمارة، الدور، الشقة" value="${draft.address}" required><div class="invalid-feedback" data-for="address"></div></div>
              <div class="col-12"><label class="form-label" for="f-map">رابط الموقع على خرائط جوجل (اختياري)</label><input class="form-control" id="f-map" name="mapLink" dir="ltr" placeholder="https://maps.google.com/… أو 30.0444, 31.2357" value="${draft.mapLink}"><div class="invalid-feedback" data-for="mapLink"></div></div>
            </div>
          </section>
          <section class="form-section"><h2><span class="n">3</span>موعد الزيارة</h2>
            <input type="hidden" name="date" value="${draft.date}"><input type="hidden" name="slotId" value="${draft.slotId}">
            <div id="when"></div>
            <div class="invalid-feedback" data-for="date"></div><div class="invalid-feedback" data-for="slotId"></div>
          </section>
          <section class="form-section"><h2><span class="n">4</span>ملاحظات</h2>
            <label class="form-label" for="f-notes">أي تفاصيل تساعد الفريق (اختياري)</label><textarea class="form-control" id="f-notes" name="notes" maxlength="500" placeholder="نوع القماش، بقع معينة، مواعيد الاتصال المناسبة…">${draft.notes}</textarea><div class="invalid-feedback" data-for="notes"></div>
          </section>
        </div>
        <aside class="sticky-side"><div class="panel panel-pad" id="co-sum"></div></aside>
      </form></div>`);
    const form = qs('#co');
    const val = () => NQ.u.formData(form);
    const saveDraft = () => sset(DRAFT_KEY, val());

    const drawWhen = () => {
      const v = val();
      const box = qs('#when');
      if (!v.areaId) { box.innerHTML = String(html`<div class="note-box"><i class="bi bi-info-circle" aria-hidden="true"></i><span>اختر منطقة الخدمة أولًا لتظهر الأيام والمواعيد المتاحة لها.</span></div>`); return; }
      const dates = SCH.availableDates(db(), v.areaId);
      if (!dates.length) { box.innerHTML = String(UI.empty('bi-calendar-x', 'لا توجد مواعيد متاحة لهذه المنطقة حاليًا', 'جرّب منطقة قريبة أو تواصل معنا لترتيب موعد.')); form.date.value = ''; form.slotId.value = ''; return; }
      if (!dates.some((d) => d.date === v.date)) { form.date.value = dates[0].date; form.slotId.value = ''; }
      const date = form.date.value;
      const slots = SCH.slotsForDate(db(), date, v.areaId).filter((s) => s.code !== 'not_covered');
      if (form.slotId.value && !slots.some((s) => s.available && s.slot.id === form.slotId.value)) form.slotId.value = '';
      box.innerHTML = String(html`
        <p class="form-label mb-2" id="lbl-date">اليوم</p>
        <div class="date-strip" role="group" aria-labelledby="lbl-date">${dates.map((d) => { const dt = parseDate(d.date); return html`<button type="button" class="date-chip" data-date="${d.date}" aria-pressed="${d.date === date}"><span class="wd">${DAY_NAMES[dt.getDay()]}</span><span class="dd">${dt.getDate()}</span><span class="mm">${fmtDate(d.date, { month: 'short' })}</span></button>`; })}</div>
        <p class="form-label mt-3 mb-2" id="lbl-slot">الفترة — ${fmtDate(date)}</p>
        <div class="slot-grid" role="group" aria-labelledby="lbl-slot">${slots.map((s) => html`<button type="button" class="slot-chip" data-slot="${s.slot.id}" ${s.available ? '' : 'disabled'} aria-pressed="${form.slotId.value === s.slot.id}">${fmtTime(s.slot.start)} – ${fmtTime(s.slot.end)}<span class="r">${s.available ? 'متاح' : s.reason}</span></button>`)}</div>
        <p class="form-text mt-2 mb-0">كل فترة تُحجز لعميل واحد فقط. المواعيد المشطوبة محجوزة أو غير متاحة.</p>`);
    };
    const drawSum = () => {
      const v = val();
      const q = P.quoteCart(db(), S.cart.get(), v.areaId || null);
      const slot = S.by(db().slots, v.slotId);
      qs('#co-sum').innerHTML = String(html`<h2 class="h5 mb-3">ملخص الحجز</h2>
        <ul class="list-unstyled mb-3">${q.lines.map((l) => html`<li class="d-flex justify-content-between gap-2 py-1 small"><span>${l.service ? l.service.name : 'خدمة غير متاحة'}${l.variant ? ' (' + l.variant.name + ')' : ''} × ${num(l.qty)} ${l.snapshot ? l.snapshot.unit : ''}</span><b class="text-nowrap">${money(l.lineTotal || 0)}</b></li>`)}</ul>
        <dl class="sum-rows">
          <div><dt>إجمالي الخدمات</dt><dd>${money(q.subtotal)}</dd></div>
          <div><dt>رسوم الانتقال${q.area ? ' — ' + q.area.name : ''}</dt><dd>${q.area ? money(q.fee) : html`<span class="text-muted fw-normal small">اختر المنطقة</span>`}</dd></div>
          <div class="total"><dt>الإجمالي المستحق</dt><dd>${money(q.total)}</dd></div>
        </dl>
        <div class="divider"></div>
        <div class="small text-muted mb-3"><i class="bi bi-calendar3 me-1" aria-hidden="true"></i>${v.date && slot ? html`${fmtDate(v.date)} — ${fmtTime(slot.start)} – ${fmtTime(slot.end)}` : 'لم يتم اختيار الموعد بعد'}</div>
        ${q.lines.some((l) => !l.ok) ? html`<div class="note-box err mb-3"><i class="bi bi-exclamation-octagon" aria-hidden="true"></i><span>${q.errors[0]} — <a href="#/cart">تعديل الحجز</a></span></div>` : ''}
        <button type="submit" class="btn btn-brand btn-lg w-100">مراجعة وتأكيد الحجز</button>
        <p class="small text-muted mt-2 mb-0">الدفع عند الزيارة أو بالتحويل بعد تأكيد الموعد. لا يتم خصم أي مبلغ الآن.</p>`);
    };
    form.addEventListener('click', (e) => {
      const d = e.target.closest('[data-date]');
      if (d) { form.date.value = d.dataset.date; form.slotId.value = ''; drawWhen(); drawSum(); saveDraft(); return; }
      const s = e.target.closest('[data-slot]');
      if (s && !s.disabled) { form.slotId.value = s.dataset.slot; qsa('[data-slot]', form).forEach((b) => b.setAttribute('aria-pressed', b === s)); drawSum(); saveDraft(); UI.showFieldErrors(form, {}); }
    });
    form.addEventListener('change', (e) => { if (e.target.name === 'areaId') { drawWhen(); } drawSum(); saveDraft(); });
    form.addEventListener('input', NQ.u.debounce(saveDraft, 300));
    form.addEventListener('submit', (e) => { e.preventDefault(); review(form); });
    drawWhen(); drawSum();
    return { onData: () => { drawWhen(); drawSum(); } };
  }

  function review(form) {
    const v = NQ.u.formData(form);
    const fields = NQ.bookings.validateContact(v);
    const q = P.quoteCart(db(), S.cart.get(), v.areaId || null);
    if (!q.ok) fields.items = q.errors[0];
    if (v.date && v.slotId) { const st = SCH.slotStatus(db(), v.date, v.slotId, v.areaId); if (!st.available) fields.slotId = `الموعد المختار لم يعد متاحًا (${st.reason}) — اختر موعدًا آخر`; }
    if (Object.keys(fields).length) { UI.showFieldErrors(form, fields); if (fields.items) UI.toast(fields.items, 'danger'); return; }
    UI.showFieldErrors(form, {});
    const slot = S.by(db().slots, v.slotId);
    let busy = false;
    UI.modal({
      title: 'مراجعة الحجز قبل التأكيد', size: 'lg',
      body: html`<div class="row g-4"><div class="col-md-6">
          <h3 class="h6 text-muted">الموعد</h3><p class="fw-semibold mb-3">${fmtDate(v.date)}<br>${fmtTime(slot.start)} – ${fmtTime(slot.end)}</p>
          <h3 class="h6 text-muted">العنوان</h3><p class="mb-3">${q.area.name} — ${v.address}${v.landmark ? html`<br><span class="text-muted small">${v.landmark}</span>` : ''}</p>
          <h3 class="h6 text-muted">التواصل</h3><p class="mb-0">${v.name}<br><span class="ltr">${NQ.u.normPhone(v.phone)}</span></p>
        </div><div class="col-md-6">
          <h3 class="h6 text-muted">الخدمات</h3>
          <ul class="list-unstyled small mb-3">${q.lines.map((l) => html`<li class="d-flex justify-content-between gap-2 py-1 border-bottom"><span>${l.service.name}${l.variant ? ' (' + l.variant.name + ')' : ''}<br><span class="text-muted">${num(l.qty)} ${l.snapshot.unit} × ${money(l.unitPrice + l.optionsUnit)}${l.options.length ? ' (شامل: ' + l.options.map((o) => o.name).join('، ') + ')' : ''}</span></span><b class="text-nowrap">${money(l.lineTotal)}</b></li>`)}</ul>
          <dl class="sum-rows"><div><dt>إجمالي الخدمات</dt><dd>${money(q.subtotal)}</dd></div><div><dt>رسوم الانتقال</dt><dd>${money(q.fee)}</dd></div><div class="total"><dt>الإجمالي المستحق</dt><dd>${money(q.total)}</dd></div></dl>
        </div></div>
        <div class="note-box mt-3"><i class="bi bi-telephone" aria-hidden="true"></i><span>بعد الإرسال يكون الحجز "في انتظار التأكيد" والموعد محجوز لك، وسيتواصل معك الفريق لتأكيده.</span></div>`,
      footer: html`<button type="button" class="btn btn-ghost" data-bs-dismiss="modal">تعديل البيانات</button><button type="button" class="btn btn-brand" data-place>تأكيد الحجز</button>`,
      onMount(root) {
        const btn = root.querySelector('[data-place]');
        btn.addEventListener('click', () => {
          if (busy) return; busy = true; btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> جارٍ إرسال الحجز…';
          try {
            const b = S.tx((d) => NQ.bookings.createBooking(d, { ...v, items: S.cart.get(), idemKey: sget(IDEM_KEY) }, { source: 'website' }));
            sset(IDEM_KEY, null); sset(DRAFT_KEY, null); sset('naqaa_last_token', b.token);
            S.cart.clear();
            UI.closeModal();
            location.replace(`#/confirmation/${b.token}`);
          } catch (err) {
            busy = false; btn.disabled = false; btn.textContent = 'تأكيد الحجز';
            UI.closeModal();
            if (err.fields) { UI.showFieldErrors(form, err.fields); UI.toast(Object.values(err.fields)[0], 'danger'); }
            else { console.error(err); UI.toast('تعذّر حفظ الحجز. حاول مرة أخرى.', 'danger'); }
            if (current && current.onData) current.onData();
          }
        });
      },
    });
  }

  // ---------- Confirmation ----------
  function confirmation(params, token) {
    const b = NQ.bookings.findByToken(db(), token);
    if (!b) { set(html`<div class="container page">${UI.empty('bi-question-circle', 'لم نجد هذا الحجز', 'تأكد من الرابط، أو ابحث برقم الحجز من صفحة التتبع.', html`<a class="btn btn-brand" href="#/track">تتبع حجز</a>`)}</div>`); return; }
    const link = trackUrl(b);
    set(html`<div class="container page" style="max-width:820px">
      <div class="done-head"><div class="done-icon" aria-hidden="true"><svg viewBox="0 0 96 96"><circle class="c" cx="48" cy="48" r="44" pathLength="1"/><path class="k" d="M30 50l12 12 24-26" pathLength="1"/></svg><span class="burst">${Array.from({ length: 12 }, (_, i) => html`<i style="--a:${i * 30}deg;--c:${['var(--saffron)', 'var(--brand)', 'var(--success)'][i % 3]}"></i>`)}</span></div><h1 class="h2">تم استلام حجزك</h1><p class="text-muted mx-auto">رقم الحجز</p><div class="ref-big">${b.ref}</div></div>
      <div class="panel panel-pad mb-4">
        <div class="row g-4">
          <div class="col-sm-6"><h2 class="h6 text-muted">الموعد</h2><p class="fw-semibold mb-0">${fmtDate(b.date)}<br>${b.slotLabel}</p></div>
          <div class="col-sm-6"><h2 class="h6 text-muted">الحالة</h2><p class="mb-0">${UI.statusBadge(b.status)}</p></div>
        </div>
        <div class="divider"></div>
        <ul class="list-unstyled small mb-3">${b.items.map((i) => html`<li class="d-flex justify-content-between py-1"><span>${i.name}${i.variantName ? ' (' + i.variantName + ')' : ''} × ${num(i.qty)} ${i.unit}</span><b>${money(i.lineTotal)}</b></li>`)}</ul>
        <dl class="sum-rows"><div><dt>رسوم الانتقال — ${b.areaName}</dt><dd>${money(b.fee)}</dd></div><div class="total"><dt>الإجمالي</dt><dd>${money(b.total)}</dd></div></dl>
      </div>
      <div class="panel panel-pad mb-4">
        <h2 class="h5">الخطوات التالية</h2>
        <ol class="mb-0 ps-3"><li>سيتصل بك فريق نقاء على رقمك لتأكيد الموعد والعنوان.</li><li>الموعد محجوز لك حتى يتم التأكيد أو الإلغاء.</li><li>تابع حالة الحجز في أي وقت من رابط التتبع الخاص بك.</li></ol>
      </div>
      <div class="panel panel-pad mb-4">
        <label class="form-label" for="trk-link">رابط تتبع الحجز (احتفظ به)</label>
        <div class="copy-field"><input id="trk-link" class="form-control" readonly value="${link}"><button type="button" class="btn btn-outline" data-copy><i class="bi bi-clipboard" aria-hidden="true"></i>نسخ</button></div>
        <p class="form-text mb-0">الرابط يعمل في هذا المتصفح لأن بيانات العرض التجريبي محفوظة محليًا.</p>
      </div>
      <div class="d-flex gap-2 flex-wrap"><a class="btn btn-brand btn-lg" href="#/track/${b.token}"><i class="bi bi-geo" aria-hidden="true"></i>تتبع الحجز</a><a class="btn btn-outline btn-lg" href="#/">العودة للرئيسية</a></div>
    </div>`);
    qs('[data-copy]').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(link); UI.toast('تم نسخ الرابط'); } catch (e) { qs('#trk-link').select(); UI.toast('حدد الرابط وانسخه يدويًا', 'info'); }
    });
  }
  const trackUrl = (b) => `${location.href.split('#')[0]}#/track/${b.token}`;

  // ---------- Tracking ----------
  function track(params, token) {
    const d = db();
    if (!token) {
      const last = sget('naqaa_last_token');
      set(html`<div class="container page" style="max-width:640px">
        <header class="page-head"><h1>تتبع الحجز</h1><p>افتح رابط التتبع المرسل لك، أو أدخل رقم الحجز وآخر 4 أرقام من الموبايل.</p></header>
        <form class="panel panel-pad" id="trk" novalidate>
          <div class="row g-3">
            <div class="col-sm-7"><label class="form-label" for="t-ref">رقم الحجز<span class="req">*</span></label><input class="form-control" id="t-ref" name="ref" dir="ltr" placeholder="NQ-1012" required><div class="invalid-feedback" data-for="ref"></div></div>
            <div class="col-sm-5"><label class="form-label" for="t-l4">آخر 4 أرقام<span class="req">*</span></label><input class="form-control" id="t-l4" name="last4" dir="ltr" inputmode="numeric" maxlength="4" placeholder="5678" required><div class="invalid-feedback" data-for="last4"></div></div>
          </div>
          <button class="btn btn-brand btn-lg w-100 mt-3" type="submit">عرض حالة الحجز</button>
          ${last && NQ.bookings.findByToken(d, last) ? html`<a class="btn btn-ghost w-100 mt-2" href="#/track/${last}">عرض آخر حجز من هذا المتصفح</a>` : ''}
        </form></div>`);
      qs('#trk').addEventListener('submit', (e) => {
        e.preventDefault();
        const v = NQ.u.formData(e.target); const f = {};
        if (!v.ref.trim()) f.ref = 'أدخل رقم الحجز';
        if (!/^\d{4}$/.test(v.last4.trim())) f.last4 = 'أدخل آخر 4 أرقام من رقم الموبايل';
        if (Object.keys(f).length) return UI.showFieldErrors(e.target, f);
        const b = NQ.bookings.findByRefPhone(db(), v.ref, v.last4);
        if (!b) return UI.showFieldErrors(e.target, { ref: 'لم نجد حجزًا بهذه البيانات. تأكد من رقم الحجز وآخر 4 أرقام.' });
        location.hash = `#/track/${b.token}`;
      });
      return;
    }
    const draw = () => {
      const b = NQ.bookings.findByToken(db(), token);
      if (!b) { set(html`<div class="container page">${UI.empty('bi-search', 'رابط التتبع غير صحيح أو الحجز غير موجود', 'تأكد من نسخ الرابط كاملًا، أو ابحث برقم الحجز.', html`<a class="btn btn-brand" href="#/track">البحث برقم الحجز</a>`)}</div>`); return; }
      const fin = FIN.bookingFinance(db(), b);
      const flow = WF.FLOW[b.workflow];
      const reached = (st) => b.history.find((h) => h.status === st);
      const curIdx = flow.indexOf(b.status);
      const firstName = b.customer.name.split(' ')[0];
      set(html`<div class="container page" style="max-width:880px">
        <header class="page-head d-flex justify-content-between align-items-start flex-wrap gap-3"><div><h1>حجز <span class="ltr">${b.ref}</span></h1><p>أهلًا ${firstName}، هذه آخر حالة لحجزك.</p></div>${UI.statusBadge(b.status)}</header>
        <div class="layout-2">
          <div class="panel panel-pad">
            <h2 class="h5 mb-4">مراحل الحجز — ${WF.WORKFLOW_LABEL[b.workflow]}</h2>
            <ol class="timeline" data-stagger="start">${b.status === 'canceled'
              ? html`<li class="done"><span class="dot"><i class="bi bi-check" aria-hidden="true"></i></span><div><h3>تم استلام الطلب</h3><small>${NQ.u.fmtDateTime(b.createdAt)}</small></div></li><li class="cancel current"><span class="dot"><i class="bi bi-x" aria-hidden="true"></i></span><div><h3>تم إلغاء الحجز</h3><small>${NQ.u.fmtDateTime((reached('canceled') || {}).at)}</small></div></li>`
              : flow.map((st, i) => { const h = reached(st); const done = i <= curIdx; return html`<li class="${done ? 'done' : ''} ${i === curIdx ? 'current' : ''}"><span class="dot"><i class="bi ${done ? 'bi-check' : WF.STATUS[st].icon}" aria-hidden="true"></i></span><div><h3>${trackLabel(st, b.workflow)}</h3><small>${h ? NQ.u.fmtDateTime(h.at) : 'لم تتم بعد'}</small></div></li>`; })}</ol>
          </div>
          <aside class="panel panel-pad">
            <h2 class="h6 text-muted">الموعد</h2><p class="fw-semibold">${fmtDate(b.date)}<br>${b.slotLabel}</p>
            <h2 class="h6 text-muted">المنطقة</h2><p>${b.areaName}</p>
            <h2 class="h6 text-muted">الخدمات</h2>
            <ul class="list-unstyled small">${b.items.map((i) => html`<li class="d-flex justify-content-between gap-2 py-1"><span>${i.name} × ${num(i.qty)} ${i.unit}</span><b>${money(i.lineTotal)}</b></li>`)}</ul>
            <dl class="sum-rows"><div><dt>رسوم الانتقال</dt><dd>${money(b.fee)}</dd></div><div class="total"><dt>الإجمالي</dt><dd>${money(b.total)}</dd></div>${b.status !== 'canceled' ? html`<div><dt>المدفوع</dt><dd>${money(fin.paid)}</dd></div><div><dt>المتبقي</dt><dd>${money(fin.outstanding)}</dd></div>` : ''}</dl>
            <div class="mt-3">${UI.payBadge(fin.status)}</div>
            <p class="small text-muted mt-3 mb-0">لأي تعديل في الموعد تواصل معنا على <a href="https://wa.me/${db().settings.whatsapp}" target="_blank" rel="noopener">واتساب</a> واذكر رقم الحجز.</p>
          </aside>
        </div></div>`);
    };
    draw();
    return { onData: draw };
  }
  const trackLabel = (st, wf) => ({ pending: 'تم استلام الطلب — في انتظار التأكيد', confirmed: 'تم تأكيد الموعد', received: 'تم استلام القطع وجارٍ تنظيفها', completed: wf === 'pickup' ? 'تم التسليم والطلب مكتمل' : 'تمت الخدمة والطلب مكتمل' }[st]);

  // ---------- Static pages ----------
  const FAQ = [
    ['هل السعر المعروض نهائي؟', 'السعر محسوب حسب الكمية التي تختارها ورسوم الانتقال لمنطقتك. إذا اختلفت الكمية الفعلية يوم الزيارة (مثل مساحة السجاد) يُراجع الفريق السعر معك قبل البدء.'],
    ['كم يستغرق جفاف الكنب بعد التنظيف؟', 'عادةً من 4 إلى 6 ساعات حسب نوع القماش والتهوية. ننصح بفتح النوافذ وتشغيل المروحة.'],
    ['كيف يتم غسيل السجاد؟', 'نستلم السجاد في موعد الزيارة، ونغسله في المغسلة، ثم نعيده بعد التجفيف والتغليف. تظهر حالة "تم الاستلام" في صفحة التتبع.'],
    ['هل يمكن حجز أكثر من خدمة في زيارة واحدة؟', 'نعم، أضف كل الخدمات إلى الحجز. رسوم الانتقال تُضاف مرة واحدة فقط.'],
    ['كيف أدفع؟', 'نقدًا عند الزيارة، أو بالتحويل البنكي، أو إنستاباي. يمكن دفع عربون والباقي عند التسليم.'],
    ['هل يمكن إلغاء الحجز أو تغيير موعده؟', 'تواصل معنا قبل الموعد بـ 24 ساعة على الأقل. عند الإلغاء يصبح الموعد متاحًا لعميل آخر، ويُرد أي مبلغ مدفوع وفق سياسة الإلغاء.'],
    ['لماذا لا أجد موعدًا في يوم معين؟', 'لكل منطقة أيام وفترات ثابتة، وكل فترة تُحجز لعميل واحد فقط. إذا لم يظهر اليوم فهو خارج جدول منطقتك أو محجوز بالكامل.'],
  ];
  function faqAccordion(list, id) {
    return html`<div class="accordion" id="${id}">${list.map(([q, a], i) => html`<div class="accordion-item"><h3 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${id}-${i}" aria-expanded="false" aria-controls="${id}-${i}">${q}</button></h3><div id="${id}-${i}" class="accordion-collapse collapse" data-bs-parent="#${id}"><div class="accordion-body">${a}</div></div></div>`)}</div>`;
  }
  const faq = () => set(html`<div class="container page" style="max-width:860px"><header class="page-head"><h1>الأسئلة الشائعة</h1><p>إجابات مختصرة عن الحجز والتنظيف والدفع.</p></header>${faqAccordion(FAQ, 'faq')}<div class="cta-band mt-5"><div><h2>عندك سؤال تاني؟</h2><p>كلمنا وهنرد عليك في مواعيد العمل.</p></div><a class="btn btn-lg" href="#/contact">تواصل معنا</a></div></div>`);

  const about = () => set(html`<div class="container page" style="max-width:860px">
    <header class="page-head"><h1>عن نقاء</h1><p>خدمة تنظيف مفروشات منزلية في غرب القاهرة والجيزة.</p></header>
    <div class="prose panel panel-pad">
      <p>نقاء خدمة تنظيف للكنب والسجاد والمراتب والستائر، مبنية على فكرة بسيطة: موعد محدد، وسعر واضح، وفريق متفرغ لبيتك خلال الفترة التي تحجزها.</p>
      <h2>كيف نعمل</h2>
      <ul><li>نقسم الأسبوع على المناطق، فيكون لكل منطقة أيام وفترات ثابتة.</li><li>كل فترة زمنية تُحجز لعميل واحد فقط، حتى لا يتأخر الفريق بسبب زيارة سابقة.</li><li>الكنب والمراتب تُنظف في بيتك، والسجاد والستائر تُغسل في المغسلة وتعود إليك.</li></ul>
      <h2>ما نلتزم به</h2>
      <ul><li>عرض السعر الكامل قبل تأكيد الحجز.</li><li>التواصل معك قبل أي تغيير في الموعد.</li><li>عدم مشاركة بياناتك مع أي جهة خارجية.</li></ul>
      <div class="note-box warn mt-4"><i class="bi bi-info-circle" aria-hidden="true"></i><span>هذا موقع عرض تجريبي: الاسم والأسعار والمناطق وبيانات التواصل توضيحية وليست بيانات شركة حقيقية.</span></div>
    </div></div>`);

  function contact() {
    const st = db().settings;
    set(html`<div class="container page">
      <header class="page-head"><h1>تواصل معنا</h1><p>مواعيد العمل من السبت إلى الخميس، 9 صباحًا حتى 8 مساءً. <span class="demo-flag ms-1">بيانات تواصل تجريبية</span></p></header>
      <div class="contact-cards mb-5">
        <a href="tel:${st.phone}"><i class="bi bi-telephone" aria-hidden="true"></i><span>اتصال<small class="ltr">${st.phone}</small></span></a>
        <a href="https://wa.me/${st.whatsapp}" target="_blank" rel="noopener"><i class="bi bi-whatsapp" aria-hidden="true"></i><span>واتساب<small>رد خلال مواعيد العمل</small></span></a>
        <a href="${st.mapUrl}" target="_blank" rel="noopener"><i class="bi bi-geo-alt" aria-hidden="true"></i><span>الموقع<small>${st.address}</small></span></a>
      </div>
      <div class="row g-4"><div class="col-lg-7"><form class="panel panel-pad" id="msg" novalidate>
        <h2 class="h5 mb-3">أرسل رسالة على واتساب</h2>
        <div class="row g-3">
          <div class="col-sm-6"><label class="form-label" for="m-name">الاسم<span class="req">*</span></label><input class="form-control" id="m-name" name="name" required><div class="invalid-feedback" data-for="name"></div></div>
          <div class="col-sm-6"><label class="form-label" for="m-ref">رقم الحجز (إن وجد)</label><input class="form-control" id="m-ref" name="ref" dir="ltr"></div>
          <div class="col-12"><label class="form-label" for="m-text">رسالتك<span class="req">*</span></label><textarea class="form-control" id="m-text" name="text" required></textarea><div class="invalid-feedback" data-for="text"></div></div>
        </div>
        <button class="btn btn-brand mt-3" type="submit"><i class="bi bi-whatsapp" aria-hidden="true"></i>فتح واتساب بالرسالة</button>
        <p class="form-text mb-0 mt-2">سيُفتح واتساب برسالة جاهزة إلى الرقم التجريبي؛ لا يتم إرسال أي شيء تلقائيًا.</p>
      </form></div>
      <div class="col-lg-5"><div class="panel panel-pad h-100"><h2 class="h5">قبل ما تراسلنا</h2><p class="text-muted">لمعرفة حالة حجزك استخدم <a href="#/track">صفحة التتبع</a>. ولأسئلة الأسعار والمواعيد راجع <a href="#/faq">الأسئلة الشائعة</a>.</p></div></div></div>
    </div>`);
    qs('#msg').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = NQ.u.formData(e.target); const f = {};
      if (v.name.trim().length < 2) f.name = 'اكتب اسمك';
      if (v.text.trim().length < 5) f.text = 'اكتب رسالتك';
      if (Object.keys(f).length) return UI.showFieldErrors(e.target, f);
      UI.showFieldErrors(e.target, {});
      const text = `مرحبًا نقاء، أنا ${v.name.trim()}${v.ref.trim() ? ' — رقم الحجز ' + v.ref.trim() : ''}\n${v.text.trim()}`;
      window.open(`https://wa.me/${st.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    });
  }

  const policies = () => set(html`<div class="container page" style="max-width:860px">
    <header class="page-head"><h1>سياسات الخدمة</h1><p>آخر تحديث: نسخة العرض التجريبي.</p></header>
    <div class="prose panel panel-pad">
      <h2>الحجز والتأكيد</h2><ul><li>يُحفظ الحجز بحالة "في انتظار التأكيد" ويُحجز الموعد للعميل فورًا.</li><li>يتواصل الفريق مع العميل لتأكيد العنوان والموعد قبل الزيارة.</li><li>كل فترة زمنية مخصصة لعميل واحد فقط.</li></ul>
      <h2>التسعير</h2><ul><li>يُحسب السعر حسب نوع الخدمة: بالمقعد أو بالمتر المربع أو بالقطعة أو سعر ثابت.</li><li>رسوم الانتقال تُضاف مرة واحدة لكل حجز حسب المنطقة.</li><li>إذا اختلفت الكمية الفعلية عن المسجلة يُراجع السعر مع العميل قبل البدء.</li></ul>
      <h2>الإلغاء وتغيير الموعد</h2><ul><li>يمكن الإلغاء أو تغيير الموعد بالتواصل معنا قبل 24 ساعة على الأقل.</li><li>عند الإلغاء يُرد أي مبلغ مدفوع بنفس وسيلة الدفع ويُسجل كاسترداد.</li><li>إذا احتجنا لتغيير موعد مؤكد نتصل بالعميل أولًا ولا يتغير الموعد بدون موافقته.</li></ul>
      <h2>السجاد والقطع المستلمة</h2><ul><li>تُسجل القطع المستلمة وعددها وقت الاستلام.</li><li>بعض البقع القديمة أو بقع الصبغة قد لا تزول بالكامل، ونوضح ذلك قبل الغسيل.</li></ul>
      <h2>الدفع</h2><ul><li>نقدي أو تحويل بنكي أو إنستاباي، ويمكن الدفع على دفعات.</li></ul>
    </div></div>`);

  const privacy = () => set(html`<div class="container page" style="max-width:860px">
    <header class="page-head"><h1>إشعار الخصوصية</h1></header>
    <div class="prose panel panel-pad">
      <p>نجمع فقط البيانات اللازمة لتنفيذ الحجز: الاسم، رقم الموبايل، المنطقة والعنوان، والملاحظات التي تكتبها.</p>
      <h2>كيف نستخدمها</h2><ul><li>للتواصل معك لتأكيد الموعد وتنفيذ الخدمة.</li><li>لإصدار سجل المدفوعات الخاص بحجزك.</li></ul>
      <h2>صفحة التتبع</h2><ul><li>رابط التتبع يحتوي على رمز عشوائي طويل خاص بحجزك.</li><li>لا تعرض صفحة التتبع رقم الموبايل أو العنوان التفصيلي أو ملاحظات الفريق الداخلية.</li></ul>
      <h2>في هذا العرض التجريبي</h2><ul><li>كل البيانات محفوظة داخل متصفحك فقط (LocalStorage) ولا تُرسل إلى أي خادم.</li><li>يمكن مسح البيانات من إعدادات لوحة التحكم أو بمسح بيانات الموقع من المتصفح.</li></ul>
    </div></div>`);

  const notFound = () => set(html`<div class="container page">${UI.empty('bi-signpost-split', 'الصفحة غير موجودة', 'ربما تغير الرابط. ابدأ من الصفحة الرئيسية.', html`<a class="btn btn-brand" href="#/">الصفحة الرئيسية</a>`)}</div>`);

  // ---------- Router ----------
  const ROUTES = [
    [/^\/?$/, 'home', home, 'تنظيف كنب وسجاد ومراتب'],
    [/^\/services$/, 'services', services, 'الخدمات والأسعار'],
    [/^\/service\/([\w-]+)$/, 'service', serviceDetail, 'تفاصيل الخدمة'],
    [/^\/cart$/, 'cart', cart, 'الحجز'],
    [/^\/checkout$/, 'checkout', checkout, 'الموعد والعنوان'],
    [/^\/confirmation\/([a-f0-9]+)$/, 'confirmation', confirmation, 'تم استلام الحجز'],
    [/^\/track$/, 'track', track, 'تتبع الحجز'],
    [/^\/track\/([a-zA-Z0-9]+)$/, 'track', track, 'تتبع الحجز'],
    [/^\/about$/, 'about', about, 'عن نقاء'],
    [/^\/contact$/, 'contact', contact, 'تواصل معنا'],
    [/^\/faq$/, 'faq', faq, 'الأسئلة الشائعة'],
    [/^\/policies$/, 'policies', policies, 'سياسات الخدمة'],
    [/^\/privacy$/, 'privacy', privacy, 'إشعار الخصوصية'],
  ];
  function route(keepScroll) {
    const h = location.hash.replace(/^#/, '') || '/';
    const [path, qstr] = h.split('?');
    const params = new URLSearchParams(qstr || '');
    let found = null, m = null;
    for (const r of ROUTES) { m = path.match(r[0]); if (m) { found = r; break; } }
    app.onclick = null; app.onchange = null;
    const name = found ? found[1] : '404';
    current = { name, onData: null };
    document.body.dataset.page = name;
    document.title = `${found ? found[3] : 'غير موجود'} | نقاء — عرض تجريبي`;
    try {
      const res = found ? found[2](params, m[1]) : notFound();
      current.onData = res && res.onData;
    } catch (err) {
      console.error(err);
      set(html`<div class="container page">${UI.empty('bi-bug', 'حدث خطأ أثناء عرض الصفحة', 'أعد تحميل الصفحة. إذا تكرر الخطأ استعد البيانات التجريبية من لوحة التحكم.', html`<a class="btn btn-brand" href="#/">الصفحة الرئيسية</a>`)}</div>`);
    }
    qsa('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === name || (a.dataset.nav === 'services' && name === 'service')));
    qsa('[data-nav]').forEach((a) => (a.classList.contains('active') ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    const oc = document.getElementById('mnav'); if (oc && window.bootstrap) { const inst = bootstrap.Offcanvas.getInstance(oc); if (inst) inst.hide(); }
    if (!keepScroll) window.scrollTo(0, 0);
    updateCartBadge();
    M.scan(app);
    syncNavInk();
  }
  const syncNavInk = () => M.ink(qs('.site-nav'));

  /** Data changed (this tab or another): re-render in place without replaying entrance motion. */
  function refresh() {
    if (current && current.onData) { const y = scrollY; current.onData(); scrollTo(0, y); M.scan(app, { instant: true }); }
    updateCartBadge();
  }

  function boot() {
    UI.theme.init();
    M.init();
    S.load();
    if (S.corrupt) return UI.recovery(app);
    window.addEventListener('hashchange', () => M.navigate(() => route(), app));
    S.subscribe(() => { if (S.db) refresh(); });
    window.addEventListener('storage', (e) => { if (e.key === 'naqaa_demo_cart') refresh(); });
    window.addEventListener('resize', NQ.u.debounce(syncNavInk, 120));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncNavInk);
    qs('#year').textContent = new Date().getFullYear();
    route();
    if (current && current.name !== 'home') M.enter(app);
  }
  document.addEventListener('DOMContentLoaded', boot);
})(window.NQ = window.NQ || {});
