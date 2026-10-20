/* Naqaa demo — admin: dashboard, orders, order details, manual booking, customers */
(function (NQ) {
  'use strict';
  const A = NQ.admin;
  const { html, raw, money, num, qs, qsa, fmtDate, fmtShortDate, fmtDateTime, fmtTime, todayStr, addDays, DAY_NAMES, parseDate } = NQ.u;
  const S = NQ.store, UI = NQ.ui, FIN = NQ.finance, WF = NQ.workflow, SCH = NQ.schedule, P = NQ.pricing;

  // ---------- Dashboard ----------
  /** The equivalent period immediately before r (previous calendar month for "this month"). */
  function previousRange(r) {
    if (!r.from || !r.to) return null;
    if (r.preset === 'month') { const f = parseDate(r.from); return { from: NQ.u.dateStr(new Date(f.getFullYear(), f.getMonth() - 1, 1)), to: NQ.u.dateStr(new Date(f.getFullYear(), f.getMonth(), 0)) }; }
    const days = Math.round((parseDate(r.to) - parseDate(r.from)) / 864e5) + 1;
    return { from: addDays(r.from, -days), to: addDays(r.from, -1) };
  }
  /** Change badge vs previous period. `lowerIsBetter` flips the colour (e.g. expenses). */
  function delta(cur, prev, lowerIsBetter) {
    if (prev == null || !prev) return '';
    const pct = ((cur - prev) / Math.abs(prev)) * 100;
    if (Math.abs(pct) < 0.5) return html`<span class="delta flat" title="مقارنة بالفترة السابقة">بدون تغيير</span>`;
    const good = lowerIsBetter ? pct < 0 : pct > 0;
    return html`<span class="delta ${good ? 'up' : 'down'}" title="مقارنة بالفترة السابقة (${money(prev)})"><i class="bi ${pct > 0 ? 'bi-arrow-up-short' : 'bi-arrow-down-short'}" aria-hidden="true"></i>${num(Math.abs(Math.round(pct)))}%<span class="visually-hidden"> مقارنة بالفترة السابقة</span></span>`;
  }
  const kpiIcon = (i) => html`<span class="ic"><i class="bi ${i}" aria-hidden="true"></i></span>`;
  const ACTIVITY_ICON = [[/استرداد/, 'pay', 'bi-arrow-counterclockwise'], [/دفعة|تحصيل/, 'pay', 'bi-cash'], [/إلغاء|ملغ/, 'cancel', 'bi-x-lg'], [/مصروف/, 'exp', 'bi-receipt'], [/حجز جديد|إنشاء|حجز من/, 'new', 'bi-plus-lg'], [/تأكيد/, 'new', 'bi-check2']];
  const activityIcon = (text) => { const m = ACTIVITY_ICON.find(([re]) => re.test(text)); return m ? html`<span class="fi ${m[1]}"><i class="bi ${m[2]}" aria-hidden="true"></i></span>` : html`<span class="fi"><i class="bi bi-dot" aria-hidden="true"></i></span>`; };
  const dayLabel = (date, t) => (date === t ? 'اليوم' : date === addDays(t, 1) ? 'غدًا' : fmtDate(date, { weekday: 'long', day: 'numeric', month: 'short' }));

  function dashboard() {
    const d = A.db();
    const r = A.getRange('dash', 'month');
    const s = FIN.summary(d, r);
    const pr = previousRange(r);
    const p = pr ? FIN.summary(d, pr) : null;
    const br = FIN.breakdowns(d, r);
    const ser = FIN.series(d, r);
    const t = todayStr();
    const upcoming = d.bookings.filter((b) => b.date >= t && ['pending', 'confirmed'].includes(b.status)).sort((a, b) => (a.date + a.slotLabel).localeCompare(b.date + b.slotLabel)).slice(0, 7);
    const pending = d.bookings.filter((b) => b.status === 'pending').sort((a, b) => a.date.localeCompare(b.date));
    const todayCount = d.bookings.filter((b) => b.date === t && b.status !== 'canceled').length;
    const outOf = SCH.outOfScheduleBookings(d);
    const refundDue = d.bookings.filter((b) => FIN.bookingFinance(d, b).status === 'refund_due');
    const user = (A.user() || {}).user || '';
    const hello = new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير';
    const STATUSES = ['pending', 'confirmed', 'received', 'completed', 'canceled'];
    const collectedPct = s.orderValue > 0 ? Math.min(100, Math.round(((s.orderValue - s.outstanding) / s.orderValue) * 100)) : 0;
    const agendaDays = [];
    upcoming.forEach((b) => { const g = agendaDays.find((x) => x.date === b.date); g ? g.items.push(b) : agendaDays.push({ date: b.date, items: [b] }); });

    A.set(html`
      <div class="ph greet">
        <div><span class="today"><i class="bi bi-calendar3" aria-hidden="true"></i>${fmtDate(t)}</span><h1>${hello}، ${user}</h1>
          <p>${pending.length ? html`لديك <a href="#/orders" data-status-link="pending"><b>${pending.length}</b> حجز ينتظر التأكيد</a>` : 'لا توجد حجوزات تنتظر التأكيد'} و<b>${todayCount}</b> ${todayCount === 1 ? 'موعد' : 'مواعيد'} اليوم.</p></div>
        <div class="acts">${A.rangeBar('dash', 'month')}</div>
      </div>
      ${outOf.length ? html`<div class="alert-soft warn mb-3"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i><span>${outOf.length} حجز قادم أصبح خارج الجدول الحالي: ${outOf.map((x) => html`<a href="#/orders/${x.booking.id}">${x.booking.ref}</a> `)} — تواصل مع العملاء.</span></div>` : ''}
      ${refundDue.length ? html`<div class="alert-soft err mb-3"><i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i><span>حجوزات ملغاة عليها مبالغ مستحقة للعملاء: ${refundDue.map((b) => html`<a href="#/orders/${b.id}">${b.ref}</a> `)}</span></div>` : ''}
      <div class="kpi-grid">
        <div class="kpi hero"><div class="k">${kpiIcon('bi-receipt')}قيمة الحجوزات</div><div class="v">${UI.count(s.orderValue, 'money')}</div>
          <div class="row-b"><span class="s">${s.eligible.length} حجز غير ملغي — منها انتقالات ${money(s.transportFees)}</span>${p ? delta(s.orderValue, p.orderValue) : ''}</div>
          <div class="spark">${UI.sparkline(ser.map((x) => x.orderValue), 'اتجاه قيمة الحجوزات')}</div></div>
        <div class="kpi"><div class="k">${kpiIcon('bi-cash-coin')}المُحصّل</div><div class="v">${UI.count(s.collections, 'money')}</div>
          <div class="row-b"><span class="s">${s.refunds ? `بعد خصم استردادات ${money(s.refunds)}` : 'صافي المدفوعات في الفترة'}</span>${p ? delta(s.collections, p.collections) : ''}</div>
          <div class="spark">${UI.sparkline(ser.map((x) => x.collections), 'اتجاه التحصيل')}</div></div>
        <div class="kpi tone-saffron"><div class="k">${kpiIcon('bi-hourglass-split')}مستحقات على العملاء</div><div class="v">${UI.count(s.outstanding, 'money')}</div>
          <div class="row-b"><span class="s">تم تحصيل ${collectedPct}% من قيمة حجوزات الفترة</span></div>
          <div class="meter" role="img" aria-label="نسبة التحصيل ${collectedPct}%"><i style="--w:${collectedPct}%"></i></div></div>
        <div class="kpi tone-danger"><div class="k">${kpiIcon('bi-bag-dash')}المصروفات</div><div class="v">${UI.count(s.expenses, 'money')}</div>
          <div class="row-b"><span class="s">مسجلة في الفترة</span>${p ? delta(s.expenses, p.expenses, true) : ''}</div>
          <div class="spark">${UI.sparkline(ser.map((x) => x.expenses), 'اتجاه المصروفات')}</div></div>
        <div class="kpi ${s.surplus < 0 ? 'neg' : ''}"><div class="k">${kpiIcon('bi-calculator')}صافي الفائض النقدي التقديري</div><div class="v">${UI.count(s.surplus, 'money')}</div>
          <div class="row-b"><span class="s">المحصّل − المصروفات (تقديري)</span>${p ? delta(s.surplus, p.surplus) : ''}</div>
          <div class="spark">${UI.sparkline(ser.map((x) => x.collections - x.expenses), 'اتجاه الفائض')}</div></div>
      </div>
      <section class="panel status-dist" aria-labelledby="sd-h">
        <div class="head"><h2 id="sd-h">الحجوزات حسب الحالة</h2><span class="small text-muted">الإجمالي <b class="text-body">${s.counts.total}</b> حجز في الفترة</span></div>
        ${s.counts.total ? html`<div class="seg" role="img" aria-label="${STATUSES.map((k) => `${WF.STATUS[k].label}: ${s.counts[k] || 0}`).join('، ')}">${STATUSES.filter((k) => s.counts[k]).map((k, i) => html`<i class="tone-${WF.STATUS[k].tone}" style="--f:${s.counts[k]};--i:${i}" title="${WF.STATUS[k].label}: ${s.counts[k]}"></i>`)}</div>` : ''}
        <div class="counts" aria-label="عدد الحجوزات حسب الحالة">
          ${STATUSES.map((k) => html`<a href="#/orders" data-status-link="${k}">${UI.statusBadge(k)}<b>${s.counts[k] || 0}</b></a>`)}
        </div>
      </section>
      <div class="grid-2 mb-3">
        <section class="panel"><div class="card-h"><h2><span class="ic"><i class="bi bi-graph-up" aria-hidden="true"></i></span>الحجوزات والتحصيل عبر الفترة</h2></div><div class="card-b">${ser.length ? UI.lineChart(ser.map((x) => x.label), [{ name: 'قيمة الحجوزات', values: ser.map((x) => x.orderValue) }, { name: 'المُحصّل', values: ser.map((x) => x.collections) }, { name: 'المصروفات', values: ser.map((x) => x.expenses) }], { label: 'قيمة الحجوزات والتحصيل والمصروفات' }) : UI.empty('bi-graph-up', 'لا توجد بيانات', '')}</div></section>
        <section class="panel"><div class="card-h"><h2><span class="ic"><i class="bi bi-trophy" aria-hidden="true"></i></span>الخدمات الأكثر مبيعًا</h2><a class="btn btn-sm btn-ghost" href="#/reports">التقارير<i class="bi bi-arrow-left" aria-hidden="true"></i></a></div><div class="card-b">${UI.barList(br.byService, { limit: 6 })}</div></section>
      </div>
      <div class="grid-2e mb-3">
        <section class="panel"><div class="card-h"><h2><span class="ic"><i class="bi bi-hourglass-split" aria-hidden="true"></i></span>في انتظار التأكيد</h2><span class="nq-badge tone-warning">${pending.length}</span></div>
          ${pending.length ? html`<ul class="mini-list" data-pending-list>${pending.slice(0, 6).map((b) => html`<li><a href="#/orders/${b.id}" class="lead"><span class="when"><b>${parseDate(b.date).getDate()}</b><small>${fmtDate(b.date, { month: 'short' })}</small></span><span><b class="ltr">${b.ref}</b> — ${b.customer.name}<span class="sub">${fmtDate(b.date, { weekday: 'short' })} ${b.slotLabel} — ${b.areaName}</span></span></a><button class="btn btn-sm btn-brand" data-confirm="${b.id}"><i class="bi bi-check2" aria-hidden="true"></i>تأكيد</button></li>`)}</ul>${pending.length > 6 ? html`<div class="p-2 text-center border-top"><a class="btn btn-sm btn-ghost" href="#/orders" data-status-link="pending">عرض الكل (${pending.length})</a></div>` : ''}` : UI.empty('bi-check2-all', 'لا توجد حجوزات تنتظر التأكيد', 'كل الحجوزات الجديدة تمت مراجعتها.')}
        </section>
        <section class="panel"><div class="card-h"><h2><span class="ic"><i class="bi bi-calendar-week" aria-hidden="true"></i></span>المواعيد القادمة</h2><a class="btn btn-sm btn-ghost" href="#/schedule">جدول اليوم<i class="bi bi-arrow-left" aria-hidden="true"></i></a></div>
          ${upcoming.length ? html`<div class="agenda">${agendaDays.map((g) => html`<div class="day ${g.date === t ? 'is-today' : ''}">${dayLabel(g.date, t)}</div>${g.items.map((b) => html`<a class="ev st-${b.status}" href="#/orders/${b.id}"><span class="tm">${String(b.slotLabel).split('–')[0].trim()}</span><span class="who"><b>${b.customer.name}</b><span>${b.areaName} — ${money(b.total)}</span></span>${UI.statusBadge(b.status)}</a>`)}`)}</div>` : UI.empty('bi-calendar', 'لا توجد مواعيد قادمة', '')}
        </section>
      </div>
      <div class="grid-2e">
        <section class="panel"><div class="card-h"><h2><span class="ic"><i class="bi bi-pie-chart" aria-hidden="true"></i></span>المصروفات حسب الفئة</h2></div><div class="card-b">${UI.barList(br.byExpense, { limit: 6 })}</div></section>
        <section class="panel"><div class="card-h"><h2><span class="ic"><i class="bi bi-activity" aria-hidden="true"></i></span>آخر النشاطات</h2></div>
          ${d.activity.length ? html`<ul class="feed">${d.activity.slice(0, 7).map((a) => html`<li>${activityIcon(a.text)}<span>${a.bookingId && S.by(d.bookings, a.bookingId) ? html`<a href="#/orders/${a.bookingId}">${a.text}</a>` : a.text}<small title="${fmtDateTime(a.at)}">${UI.ago(a.at)}</small></span></li>`)}</ul>` : UI.empty('bi-activity', 'لا توجد نشاطات بعد', '')}
        </section>
      </div>`);
    const main = A.main();
    A.bindRange(main, A.rerender);
    main.onclick = (e) => {
      const c = e.target.closest('[data-confirm]');
      if (c) {
        const commit = () => { try { S.tx((d2) => WF.transition(d2, c.dataset.confirm, 'confirmed', '', 'الإدارة')); UI.toast('تم تأكيد الحجز'); } catch (err) { UI.toast(err.message, 'danger'); } };
        const row = c.closest('li');
        c.disabled = true;
        if (row && !NQ.motion.reduced()) { row.classList.add('is-leaving'); setTimeout(commit, 300); } else commit();
      }
      const sl = e.target.closest('[data-status-link]');
      if (sl) { ordersState().status = sl.dataset.statusLink; }
    };
  }

  // ---------- Orders list ----------
  const ordersState = () => A.state.orders || (A.state.orders = { q: '', status: '', service: '', area: '', date: '', from: '', sort: 'date', dir: 'desc', page: 1, per: 10 });
  function orders() {
    const d = A.db();
    const st = ordersState();
    const draw = () => {
      const q = st.q.trim().toLowerCase();
      const qPhone = NQ.u.normPhone(q);
      let rows = d.bookings.filter((b) => {
        if (st.status && b.status !== st.status) return false;
        if (st.area && b.areaId !== st.area) return false;
        if (st.service && !b.items.some((i) => i.serviceId === st.service)) return false;
        if (st.date === 'upcoming' && b.date < todayStr()) return false;
        if (st.date === 'past' && b.date >= todayStr()) return false;
        if (st.date === 'today' && b.date !== todayStr()) return false;
        if (st.date === 'on' && st.from && b.date !== st.from) return false;
        if (q && !(b.ref.toLowerCase().includes(q) || b.customer.name.toLowerCase().includes(q) || (qPhone.length >= 3 && b.customer.phone.includes(qPhone)))) return false;
        return true;
      });
      rows = A.sortBy(rows, st, { date: (b) => b.date + b.slotLabel, total: (b) => b.total, status: (b) => WF.FLOW.pickup.indexOf(b.status) + (b.status === 'canceled' ? 10 : 0), ref: (b) => b.ref });
      const total = rows.length;
      const pg = A.pager(total, st);
      const pageRows = rows.slice((st.page - 1) * st.per, st.page * st.per);
      qs('#o-body').innerHTML = String(html`${pageRows.length ? html`<div class="table-responsive"><table class="tbl stack">
        <thead><tr>${A.sortTh('الحجز', 'ref', st)}<th>العميل</th>${A.sortTh('الموعد', 'date', st)}<th>المنطقة</th>${A.sortTh('الحالة', 'status', st)}<th>الدفع</th>${A.sortTh('الإجمالي', 'total', st, 'r')}<th class="acts"><span class="visually-hidden">إجراءات</span></th></tr></thead>
        <tbody>${pageRows.map((b, i) => { const f = FIN.bookingFinance(d, b); return html`<tr class="row-link" style="--i:${i}" data-href="#/orders/${b.id}">
          <td data-label="الحجز">${A.bookingLink(b)}<span class="sub">${WF.WORKFLOW_LABEL[b.workflow]}</span></td>
          <td data-label="العميل">${b.customer.name}<span class="sub ltr">${b.customer.phone}</span></td>
          <td data-label="الموعد">${fmtDate(b.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}<span class="sub">${b.slotLabel}</span></td>
          <td data-label="المنطقة">${b.areaName}</td>
          <td data-label="الحالة">${UI.statusBadge(b.status)}</td>
          <td data-label="الدفع">${UI.payBadge(f.status)}</td>
          <td data-label="الإجمالي" class="r">${money(b.total)}${f.outstanding ? html`<span class="sub">متبقي ${money(f.outstanding)}</span>` : ''}</td>
          <td data-label="" class="acts"><a class="btn btn-sm btn-outline" href="#/orders/${b.id}">التفاصيل</a></td></tr>`; })}</tbody></table></div>` : UI.empty('bi-search', 'لا توجد حجوزات مطابقة', 'غيّر البحث أو امسح عوامل التصفية.', html`<button class="btn btn-outline" data-reset>مسح التصفية</button>`)}${pg}`);
    };
    A.set(html`${A.ph('الحجوزات', 'ابحث وصفِّ الحجوزات، وافتح أي حجز لتغيير حالته وتسجيل المدفوعات.', html`<a class="btn btn-brand" href="#/orders/new"><i class="bi bi-plus-lg" aria-hidden="true"></i>حجز جديد</a>`)}
      <section class="panel">
        <div class="filters">
          <div class="search"><i class="bi bi-search" aria-hidden="true"></i><label class="visually-hidden" for="o-q">بحث</label><input class="form-control" id="o-q" type="search" placeholder="رقم الحجز أو اسم العميل أو الموبايل" value="${st.q}" data-f="q"></div>
          <div><label class="visually-hidden" for="o-st">الحالة</label><select class="form-select" id="o-st" data-f="status"><option value="">كل الحالات</option>${Object.entries(WF.STATUS).map(([k, v]) => html`<option value="${k}" ${st.status === k ? 'selected' : ''}>${v.label}</option>`)}</select></div>
          <div><label class="visually-hidden" for="o-sv">الخدمة</label><select class="form-select" id="o-sv" data-f="service"><option value="">كل الخدمات</option>${d.services.map((s) => html`<option value="${s.id}" ${st.service === s.id ? 'selected' : ''}>${s.name}</option>`)}</select></div>
          <div><label class="visually-hidden" for="o-ar">المنطقة</label><select class="form-select" id="o-ar" data-f="area"><option value="">كل المناطق</option>${d.areas.map((a) => html`<option value="${a.id}" ${st.area === a.id ? 'selected' : ''}>${a.name}</option>`)}</select></div>
          <div class="d-flex gap-1"><label class="visually-hidden" for="o-dt">التاريخ</label><select class="form-select" id="o-dt" data-f="date"><option value="">كل التواريخ</option><option value="today" ${st.date === 'today' ? 'selected' : ''}>اليوم</option><option value="upcoming" ${st.date === 'upcoming' ? 'selected' : ''}>القادمة</option><option value="past" ${st.date === 'past' ? 'selected' : ''}>السابقة</option><option value="on" ${st.date === 'on' ? 'selected' : ''}>تاريخ محدد</option></select>${st.date === 'on' ? html`<label class="visually-hidden" for="o-on">اختر التاريخ</label><input type="date" class="form-control" id="o-on" data-f="from" value="${st.from}">` : ''}</div>
        </div>
        <div id="o-body"></div>
      </section>`);
    const main = A.main();
    main.oninput = NQ.u.debounce((e) => { if (e.target.dataset.f === 'q') { st.q = e.target.value; st.page = 1; draw(); } }, 200);
    main.onchange = (e) => { const f = e.target.dataset.f; if (f && f !== 'q') { st[f] = e.target.value; st.page = 1; if (f === 'date') return A.rerender(); draw(); } };
    main.onclick = (e) => {
      const so = e.target.closest('[data-sort]'); if (so) { st.dir = st.sort === so.dataset.sort && st.dir === 'desc' ? 'asc' : 'desc'; st.sort = so.dataset.sort; return draw(); }
      const p = e.target.closest('[data-page]'); if (p) { st.page = Number(p.dataset.page); return draw(); }
      if (e.target.closest('[data-reset]')) { Object.assign(st, { q: '', status: '', service: '', area: '', date: '', from: '', page: 1 }); return A.rerender(); }
      const tr = e.target.closest('tr[data-href]'); if (tr && !e.target.closest('a,button')) location.hash = tr.dataset.href;
    };
    draw();
    return { onData: draw };
  }

  // ---------- Order details ----------
  function orderDetail(id) {
    const d = A.db();
    const b = S.by(d.bookings, id);
    if (!b) { A.set(UI.empty('bi-question-circle', 'الحجز غير موجود', 'ربما تمت إعادة تعيين البيانات التجريبية.', html`<a class="btn btn-brand" href="#/orders">كل الحجوزات</a>`)); return; }
    const f = FIN.bookingFinance(d, b);
    const pays = FIN.paymentsOf(d, b.id);
    const allowed = WF.allowed(b);
    const out = SCH.outOfScheduleBookings(d).find((x) => x.booking.id === b.id);
    const cust = S.by(d.customers, b.customerId);
    const flow = WF.FLOW[b.workflow];
    const phone = b.customer.phone;
    A.set(html`
      <nav class="crumbs small mb-2"><a href="#/orders">الحجوزات</a> / <span class="ltr">${b.ref}</span></nav>
      <div class="ph"><div class="od-head"><span class="ref">${b.ref}</span>${UI.statusBadge(b.status)}${UI.payBadge(f.status)}</div>
        <div class="od-actions">${allowed.filter((s) => s !== 'canceled').map((s) => html`<button class="btn btn-brand" data-to="${s}"><i class="bi ${WF.STATUS[s].icon}" aria-hidden="true"></i>${WF.ACTION_LABEL[s]}</button>`)}${allowed.includes('canceled') ? html`<button class="btn btn-soft-danger" data-to="canceled"><i class="bi bi-x-circle" aria-hidden="true"></i>إلغاء الحجز</button>` : ''}<a class="btn btn-outline" href="${A.trackUrl(b)}" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-left" aria-hidden="true"></i>صفحة التتبع</a></div></div>
      ${out ? html`<div class="alert-soft warn mb-3"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i><span>موعد هذا الحجز أصبح خارج الجدول الحالي (${out.reason}). الحجز لم يتغير. تواصل مع العميل، ثم عدّل الموعد عند الاتفاق.</span></div>` : ''}
      ${f.status === 'refund_due' ? html`<div class="alert-soft err mb-3"><i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i><span>الحجز ملغي وعليه ${money(f.refundDue)} مدفوعة. بعد ردّ المبلغ للعميل سجّل "استرداد".</span></div>` : ''}
      <div class="grid-2">
        <div class="d-grid gap-3">
          <section class="panel"><div class="card-h"><h2>الخدمات والسعر</h2><span class="small text-muted">الأسعار محفوظة كما كانت وقت الحجز</span></div>
            <div class="table-responsive"><table class="tbl stack"><thead><tr><th>الخدمة</th><th>الكمية</th><th class="r">سعر الوحدة</th><th class="r">الإجمالي</th></tr></thead><tbody>
              ${b.items.map((i) => html`<tr><td data-label="الخدمة">${i.name}${i.variantName ? html`<span class="sub">${i.variantName}</span>` : ''}${i.options.length ? html`<span class="sub">إضافات: ${i.options.map((o) => `${o.name} (+${money(o.price)})`).join('، ')}</span>` : ''}</td><td data-label="الكمية">${num(i.qty)} ${i.unit}</td><td data-label="سعر الوحدة" class="r">${money(i.unitPrice + i.options.reduce((s, o) => s + o.price, 0))}</td><td data-label="الإجمالي" class="r">${money(i.lineTotal)}</td></tr>`)}
            </tbody></table></div>
            <div class="card-b"><dl class="sum-rows" style="max-width:360px;margin-inline-start:auto"><div><dt>إجمالي الخدمات</dt><dd>${money(b.subtotal)}</dd></div><div><dt>رسوم الانتقال (${b.areaName})</dt><dd>${money(b.fee)}</dd></div><div class="total"><dt>الإجمالي</dt><dd>${money(b.total)}</dd></div></dl></div>
          </section>
          <section class="panel"><div class="card-h"><h2>المدفوعات</h2><div class="d-flex gap-1">${b.status !== 'canceled' && f.outstanding > 0 ? html`<button class="btn btn-sm btn-brand" data-pay="payment"><i class="bi bi-plus-lg" aria-hidden="true"></i>تسجيل دفعة</button>` : ''}${f.paid > 0 ? html`<button class="btn btn-sm btn-outline" data-pay="refund">تسجيل استرداد</button>` : ''}</div></div>
            <div class="card-b pb-0"><div class="kpis mb-3"><div class="kpi"><div class="k">الإجمالي</div><div class="v">${money(b.total)}</div></div><div class="kpi"><div class="k">صافي المدفوع</div><div class="v">${money(f.paid)}</div></div><div class="kpi ${f.outstanding ? 'neg' : ''}"><div class="k">${b.status === 'canceled' ? 'مستحق للعميل' : 'المتبقي'}</div><div class="v">${money(b.status === 'canceled' ? f.refundDue : f.outstanding)}</div></div></div></div>
            ${pays.length ? html`<div class="table-responsive"><table class="tbl stack"><thead><tr><th>التاريخ</th><th>النوع</th><th>الطريقة</th><th>ملاحظات</th><th class="r">المبلغ</th><th class="acts"><span class="visually-hidden">إجراءات</span></th></tr></thead><tbody>
              ${pays.map((p) => html`<tr><td data-label="التاريخ">${fmtDate(p.date, { day: 'numeric', month: 'short', year: 'numeric' })}<span class="sub">بواسطة ${p.by}</span></td><td data-label="النوع">${p.kind === 'refund' ? html`<span class="nq-badge tone-danger">استرداد</span>` : html`<span class="nq-badge tone-success">دفعة</span>`}</td><td data-label="الطريقة">${FIN.METHODS[p.method] || p.method}</td><td data-label="ملاحظات">${p.notes || '—'}</td><td data-label="المبلغ" class="r">${p.kind === 'refund' ? '−' : ''}${money(p.amount)}</td><td data-label="" class="acts"><button class="btn btn-sm btn-ghost" data-edit-pay="${p.id}" aria-label="تعديل"><i class="bi bi-pencil" aria-hidden="true"></i></button><button class="btn btn-sm btn-ghost text-danger" data-del-pay="${p.id}" aria-label="حذف"><i class="bi bi-trash3" aria-hidden="true"></i></button></td></tr>`)}
            </tbody></table></div>` : html`<p class="text-muted px-3 pb-3 mb-0">لم تُسجل أي مدفوعات بعد.</p>`}
          </section>
          <section class="panel"><div class="card-h"><h2>ملاحظات داخلية</h2><span class="small text-muted">لا تظهر للعميل</span></div><div class="card-b">
            ${b.internalNotes.length ? b.internalNotes.map((n) => html`<div class="note-item"><div class="d-flex justify-content-between gap-2"><span>${n.text}</span><span class="text-nowrap"><button class="btn btn-sm btn-ghost" data-edit-note="${n.id}" aria-label="تعديل الملاحظة"><i class="bi bi-pencil" aria-hidden="true"></i></button><button class="btn btn-sm btn-ghost text-danger" data-del-note="${n.id}" aria-label="حذف الملاحظة"><i class="bi bi-trash3" aria-hidden="true"></i></button></span></div><small>${n.by} — ${fmtDateTime(n.at)}</small></div>`) : ''}
            <form id="note-f" class="d-flex gap-2 mt-2" novalidate><label class="visually-hidden" for="note-t">ملاحظة جديدة</label><input class="form-control" id="note-t" name="text" maxlength="500" placeholder="أضف ملاحظة للفريق…"><button class="btn btn-outline" type="submit">إضافة</button></form>
          </div></section>
        </div>
        <div class="d-grid gap-3 align-content-start">
          <section class="panel"><div class="card-h"><h2>العميل والعنوان</h2>${cust ? html`<a class="btn btn-sm btn-ghost" href="#/customers/${cust.id}">ملف العميل</a>` : ''}</div><div class="card-b">
            <dl class="kv"><dt>الاسم</dt><dd>${b.customer.name}</dd><dt>الموبايل</dt><dd><a class="ltr" href="tel:${phone}">${phone}</a> — <a href="https://wa.me/2${phone}" target="_blank" rel="noopener">واتساب</a></dd><dt>المنطقة</dt><dd>${b.areaName}</dd><dt>العنوان</dt><dd>${b.address}</dd><dt>علامة مميزة</dt><dd>${b.landmark || '—'}</dd><dt>الموقع</dt><dd>${b.mapLink ? html`<a href="${/^https?:/i.test(b.mapLink) ? b.mapLink : 'https://maps.google.com/?q=' + encodeURIComponent(b.mapLink)}" target="_blank" rel="noopener">فتح على الخريطة <i class="bi bi-box-arrow-up-left" aria-hidden="true"></i></a>` : '—'}</dd><dt>ملاحظات العميل</dt><dd>${b.notes || '—'}</dd></dl>
          </div></section>
          <section class="panel"><div class="card-h"><h2>الموعد</h2>${['pending', 'confirmed'].includes(b.status) ? html`<button class="btn btn-sm btn-outline" data-resched>تغيير الموعد</button>` : ''}</div><div class="card-b">
            <p class="fw-semibold mb-1">${fmtDate(b.date)}</p><p class="mb-3">${b.slotLabel}</p>
            <div class="flow mb-1" aria-label="مراحل هذا الحجز">${b.status === 'canceled' ? html`<span class="on" style="background:var(--danger)">ملغي</span>` : flow.map((s, i) => html`${i ? html`<i class="bi bi-chevron-left" aria-hidden="true"></i>` : ''}<span class="${flow.indexOf(b.status) >= i ? 'on' : ''}">${WF.STATUS[s].label}</span>`)}</div>
            <p class="small text-muted mb-0">${WF.WORKFLOW_LABEL[b.workflow]}${b.workflow === 'pickup' ? ' — يتضمن قطعًا تُستلم وتُعاد، لذلك يمر بمرحلة "تم الاستلام".' : ' — تُنفذ في موقع العميل بدون مرحلة استلام.'}</p>
          </div></section>
          <section class="panel"><div class="card-h"><h2>سجل الحالة</h2></div><div class="card-b"><ul class="hist">${[...b.history].reverse().map((h) => html`<li><b>${WF.STATUS[h.status] ? WF.STATUS[h.status].label : h.status}</b>${h.note ? html` — ${h.note}` : ''}<small>${h.by} — ${fmtDateTime(h.at)}</small></li>`)}</ul>
            <p class="small text-muted mb-0">مصدر الحجز: ${b.source === 'admin' ? 'لوحة التحكم' : 'الموقع'} — أُنشئ ${fmtDateTime(b.createdAt)}</p></div></section>
        </div>
      </div>`);

    const main = A.main();
    main.onclick = async (e) => {
      const to = e.target.closest('[data-to]');
      if (to) return changeStatus(b.id, to.dataset.to);
      const pay = e.target.closest('[data-pay]'); if (pay) return A.paymentModal(b.id, null, pay.dataset.pay);
      const ep = e.target.closest('[data-edit-pay]'); if (ep) return A.paymentModal(b.id, S.by(A.db().payments, ep.dataset.editPay));
      const dp = e.target.closest('[data-del-pay]'); if (dp) return A.deletePayment(S.by(A.db().payments, dp.dataset.delPay));
      if (e.target.closest('[data-resched]')) return reschedModal(b.id);
      const en = e.target.closest('[data-edit-note]');
      if (en) {
        const n = b.internalNotes.find((x) => x.id === en.dataset.editNote);
        return A.formModal({ title: 'تعديل الملاحظة', body: html`<label class="form-label" for="n-t">الملاحظة</label><textarea class="form-control" id="n-t" name="text" maxlength="500">${n.text}</textarea><div class="invalid-feedback" data-for="text"></div>`, onSave(v) { if (!v.text.trim()) throw A.fieldErr({ text: 'اكتب الملاحظة' }); S.tx((d2) => { const bb = S.by(d2.bookings, b.id); const nn = bb.internalNotes.find((x) => x.id === n.id); nn.text = v.text.trim(); nn.at = new Date().toISOString(); }); UI.toast('تم حفظ الملاحظة'); } });
      }
      const dn = e.target.closest('[data-del-note]');
      if (dn && await UI.confirm({ title: 'حذف الملاحظة', message: 'هل تريد حذف هذه الملاحظة الداخلية؟', okText: 'حذف', danger: true })) { S.tx((d2) => { const bb = S.by(d2.bookings, b.id); bb.internalNotes = bb.internalNotes.filter((x) => x.id !== dn.dataset.delNote); }); UI.toast('تم حذف الملاحظة', 'info'); }
    };
    qs('#note-f').addEventListener('submit', (e) => {
      e.preventDefault();
      const t = e.target.text.value.trim();
      if (!t) { UI.showFieldErrors(e.target, { text: '' }); return; }
      S.tx((d2) => { S.by(d2.bookings, b.id).internalNotes.push({ id: NQ.u.uid('note'), text: t, at: new Date().toISOString(), by: (A.user() || {}).user || 'admin' }); S.log(d2, `ملاحظة داخلية على ${b.ref}`, { bookingId: b.id }); });
      UI.toast('تمت إضافة الملاحظة');
    });
  }

  async function changeStatus(id, to) {
    const d = A.db(); const b = S.by(d.bookings, id);
    const f = FIN.bookingFinance(d, b);
    const labels = { confirmed: 'تأكيد الحجز بعد التواصل مع العميل؟', received: 'تسجيل أن القطع تم استلامها من العميل؟', completed: 'تمييز الحجز كمكتمل؟', canceled: 'إلغاء هذا الحجز؟' };
    let detail = '';
    if (to === 'canceled') detail = `سيُحرر الموعد (${fmtDate(b.date, { day: 'numeric', month: 'short' })} ${b.slotLabel}) ليصبح متاحًا لعميل آخر.${f.paid > 0 ? ` العميل دفع ${money(f.paid)}؛ ستبقى المدفوعات مسجلة ويظهر المبلغ كمستحق استرداد.` : ''}`;
    if (to === 'completed' && f.outstanding > 0) detail = `تنبيه: متبقي على العميل ${money(f.outstanding)}. حالة الدفع لن تتغير تلقائيًا.`;
    UI.modal({
      title: WF.ACTION_LABEL[to], size: 'sm',
      body: html`<p>${labels[to]}</p>${detail ? html`<p class="small text-muted">${detail}</p>` : ''}<label class="form-label" for="st-note">${to === 'canceled' ? 'سبب الإلغاء' : 'ملاحظة (اختياري)'}</label><input class="form-control" id="st-note" maxlength="200">`,
      footer: html`<button class="btn btn-ghost" data-bs-dismiss="modal">تراجع</button><button class="btn ${to === 'canceled' ? 'btn-danger' : 'btn-brand'}" data-ok>${WF.ACTION_LABEL[to]}</button>`,
      onMount(el) {
        el.querySelector('[data-ok]').addEventListener('click', () => {
          try { S.tx((d2) => WF.transition(d2, id, to, el.querySelector('#st-note').value.trim(), (A.user() || {}).user || 'الإدارة')); UI.closeModal(); UI.toast(to === 'canceled' ? 'تم إلغاء الحجز وتحرير الموعد' : 'تم تحديث الحالة'); }
          catch (err) { UI.toast(err.message, 'danger'); }
        }, { once: true });
      },
    });
  }

  /** Date + slot picker that uses the shared availability rules (for reschedule & manual booking). */
  function slotPicker(container, areaId, sel, excludeId, onPick) {
    const draw = () => {
      if (!areaId()) { container.innerHTML = String(html`<p class="text-muted small mb-0">اختر المنطقة أولًا.</p>`); return; }
      const date = sel.date || todayStr();
      const slots = SCH.slotsForDate(A.db(), date, areaId(), { excludeBookingId: excludeId });
      container.innerHTML = String(html`<div class="row g-2 align-items-end mb-2"><div class="col-sm-6"><label class="form-label" for="sp-date">التاريخ</label><input type="date" class="form-control" id="sp-date" min="${todayStr()}" value="${date}"></div><div class="col-sm-6"><button type="button" class="btn btn-outline w-100" data-next>أقرب يوم متاح</button></div></div>
        <div class="slot-grid">${slots.map((s) => html`<button type="button" class="slot-chip" data-sp="${s.slot.id}" ${s.available ? '' : 'disabled'} aria-pressed="${sel.slotId === s.slot.id && sel.date === date}">${fmtTime(s.slot.start)} – ${fmtTime(s.slot.end)}<span class="r">${s.available ? 'متاح' : s.reason}${s.booking ? ' — ' + s.booking.ref : ''}</span></button>`)}</div>`);
    };
    container.addEventListener('change', (e) => { if (e.target.id === 'sp-date') { sel.date = e.target.value; sel.slotId = ''; onPick(); draw(); } });
    container.addEventListener('click', (e) => {
      if (e.target.closest('[data-next]')) { const n = SCH.nextAvailable(A.db(), areaId(), 1)[0]; if (n) { sel.date = n.date; sel.slotId = n.slot.id; onPick(); draw(); } else UI.toast('لا توجد مواعيد متاحة لهذه المنطقة', 'warning'); return; }
      const b = e.target.closest('[data-sp]'); if (b && !b.disabled) { sel.date = sel.date || todayStr(); sel.slotId = b.dataset.sp; onPick(); draw(); }
    });
    draw();
    return draw;
  }

  function reschedModal(id) {
    const b = S.by(A.db().bookings, id);
    const sel = { date: b.date >= todayStr() ? b.date : todayStr(), slotId: '' };
    A.formModal({
      title: `تغيير موعد ${b.ref}`, saveText: 'حفظ الموعد الجديد',
      body: html`<div class="alert-soft warn mb-3"><i class="bi bi-telephone" aria-hidden="true"></i><span>اتفق مع العميل على الموعد الجديد قبل الحفظ. الموعد الحالي: ${fmtDate(b.date)} ${b.slotLabel}.</span></div><div id="rs-pick"></div><div class="invalid-feedback" data-for="slot"></div><label class="form-label mt-3" for="rs-note">سبب التغيير</label><input class="form-control" id="rs-note" name="note" maxlength="200">`,
      onMount(form) { slotPicker(form.querySelector('#rs-pick'), () => b.areaId, sel, b.id, () => {}); },
      onSave(v) {
        if (!sel.slotId) throw A.fieldErr({ slot: 'اختر فترة متاحة' });
        S.tx((d) => NQ.bookings.reschedule(d, id, sel.date, sel.slotId, v.note.trim()));
        UI.toast('تم تغيير الموعد');
      },
    });
  }

  // ---------- Manual booking (same validation as the website) ----------
  function newOrder() {
    const d = A.db();
    const st = { lines: [{ key: NQ.u.randomHex(4), serviceId: '', qty: 1, variantId: null, optionIds: [] }], sel: { date: '', slotId: '' }, idem: NQ.u.randomHex(12) };
    const services = d.services.filter((s) => s.active);
    A.set(html`${A.ph('حجز جديد', 'يُطبق نفس التحقق وقواعد المواعيد المستخدمة في الموقع.')}
      <form id="nb" class="grid-2" novalidate>
        <div class="d-grid gap-3 align-content-start">
          <section class="panel"><div class="card-h"><h2>العميل</h2></div><div class="card-b row g-3">
            <div class="col-md-6"><label class="form-label" for="nb-phone">الموبايل<span class="req">*</span></label><input class="form-control" id="nb-phone" name="phone" dir="ltr" list="cust-list" inputmode="tel" required><datalist id="cust-list">${d.customers.map((c) => html`<option value="${c.phone}">${c.name}</option>`)}</datalist><div class="invalid-feedback" data-for="phone"></div><div class="form-text" id="nb-match"></div></div>
            <div class="col-md-6"><label class="form-label" for="nb-name">الاسم<span class="req">*</span></label><input class="form-control" id="nb-name" name="name" required><div class="invalid-feedback" data-for="name"></div></div>
            <div class="col-md-6"><label class="form-label" for="nb-area">المنطقة<span class="req">*</span></label><select class="form-select" id="nb-area" name="areaId"><option value="">اختر</option>${d.areas.filter((a) => a.active).map((a) => html`<option value="${a.id}">${a.name} — ${money(a.fee)}</option>`)}</select><div class="invalid-feedback" data-for="areaId"></div></div>
            <div class="col-md-6"><label class="form-label" for="nb-lm">علامة مميزة</label><input class="form-control" id="nb-lm" name="landmark"></div>
            <div class="col-12"><label class="form-label" for="nb-addr">العنوان بالتفصيل<span class="req">*</span></label><input class="form-control" id="nb-addr" name="address"><div class="invalid-feedback" data-for="address"></div></div>
            <div class="col-12"><label class="form-label" for="nb-map">رابط الموقع</label><input class="form-control" id="nb-map" name="mapLink" dir="ltr"><div class="invalid-feedback" data-for="mapLink"></div></div>
            <div class="col-12"><label class="form-label" for="nb-notes">ملاحظات العميل</label><textarea class="form-control" id="nb-notes" name="notes" maxlength="500"></textarea></div>
          </div></section>
          <section class="panel"><div class="card-h"><h2>الخدمات</h2><button type="button" class="btn btn-sm btn-outline" data-add-line><i class="bi bi-plus-lg" aria-hidden="true"></i>إضافة خدمة</button></div><div class="card-b" id="nb-lines"></div><div class="invalid-feedback px-3 pb-3" data-for="items"></div></section>
        </div>
        <div class="d-grid gap-3 align-content-start">
          <section class="panel"><div class="card-h"><h2>الموعد</h2></div><div class="card-b"><div id="nb-pick"></div><div class="invalid-feedback" data-for="slotId"></div><div class="invalid-feedback" data-for="date"></div></div></section>
          <section class="panel"><div class="card-b" id="nb-sum"></div></section>
        </div>
      </form>`);
    const form = qs('#nb');
    const areaId = () => form.areaId.value;
    const drawLines = () => {
      qs('#nb-lines').innerHTML = String(html`${st.lines.map((l, i) => {
        const s = S.by(d.services, l.serviceId);
        const lim = s ? P.limits(s) : { min: 1, max: 1, step: 1 };
        return html`<div class="border rounded-3 p-3 mb-2" data-line="${i}">
          <div class="row g-2 align-items-end">
            <div class="col-md-6"><label class="form-label" for="ln-s${i}">الخدمة</label><select class="form-select" id="ln-s${i}" data-lf="serviceId"><option value="">اختر الخدمة</option>${services.map((x) => html`<option value="${x.id}" ${x.id === l.serviceId ? 'selected' : ''}>${x.name} — ${P.priceText(x)}</option>`)}</select></div>
            <div class="col-6 col-md-3"><label class="form-label" for="ln-q${i}">${s ? P.PRICING[s.pricing].qtyLabel : 'الكمية'}</label><input class="form-control" id="ln-q${i}" type="number" data-lf="qty" min="${lim.min}" max="${lim.max}" step="${lim.step}" value="${l.qty}"></div>
            <div class="col-6 col-md-3 text-end"><button type="button" class="btn btn-ghost text-danger" data-rm-line="${i}" ${st.lines.length === 1 ? 'disabled' : ''}><i class="bi bi-trash3" aria-hidden="true"></i>حذف</button></div>
            ${s && s.variants.length ? html`<div class="col-md-6"><label class="form-label" for="ln-v${i}">النوع</label><select class="form-select" id="ln-v${i}" data-lf="variantId">${s.variants.map((v) => html`<option value="${v.id}" ${v.id === l.variantId ? 'selected' : ''}>${v.name} — ${money(v.price)}</option>`)}</select></div>` : ''}
            ${s && s.options.length ? html`<div class="col-12 d-flex flex-wrap gap-3">${s.options.map((o) => html`<div class="form-check"><input class="form-check-input" type="checkbox" id="ln-o${i}${o.id}" data-opt="${o.id}" ${l.optionIds.includes(o.id) ? 'checked' : ''}><label class="form-check-label" for="ln-o${i}${o.id}">${o.name} (+${money(o.price)})</label></div>`)}</div>` : ''}
          </div></div>`;
      })}`);
    };
    const drawSum = () => {
      const q = P.quoteCart(A.db(), st.lines.filter((l) => l.serviceId), areaId() || null);
      qs('#nb-sum').innerHTML = String(html`<h2 class="h6 mb-3">ملخص الحجز</h2><ul class="list-unstyled small">${q.lines.map((l) => html`<li class="d-flex justify-content-between gap-2 py-1"><span>${l.service.name} × ${num(l.qty)}</span><b class="${l.ok ? '' : 'text-danger'}">${l.ok ? money(l.lineTotal) : l.errors[0]}</b></li>`)}</ul>
        <dl class="sum-rows"><div><dt>الخدمات</dt><dd>${money(q.subtotal)}</dd></div><div><dt>الانتقال</dt><dd>${money(q.fee)}</dd></div><div class="total"><dt>الإجمالي</dt><dd>${money(q.total)}</dd></div></dl>
        <button type="submit" class="btn btn-brand btn-lg w-100 mt-3">حفظ الحجز</button><p class="small text-muted mt-2 mb-0">يُحفظ بحالة "في انتظار التأكيد" ويحجز الموعد فورًا.</p>`);
    };
    const redrawPick = slotPicker(qs('#nb-pick'), areaId, st.sel, null, drawSum);
    form.addEventListener('change', (e) => {
      const ln = e.target.closest('[data-line]');
      if (ln) {
        const l = st.lines[Number(ln.dataset.line)];
        if (e.target.dataset.lf === 'serviceId') { l.serviceId = e.target.value; const s = S.by(d.services, l.serviceId); l.qty = s ? P.limits(s).min : 1; l.variantId = s && s.variants.length ? s.variants[0].id : null; l.optionIds = []; drawLines(); }
        else if (e.target.dataset.lf === 'qty') l.qty = Number(e.target.value);
        else if (e.target.dataset.lf === 'variantId') l.variantId = e.target.value;
        else if (e.target.dataset.opt) l.optionIds = e.target.checked ? [...l.optionIds, e.target.dataset.opt] : l.optionIds.filter((x) => x !== e.target.dataset.opt);
      }
      if (e.target.name === 'areaId') { st.sel.slotId = ''; redrawPick(); }
      if (e.target.name === 'phone') {
        const c = A.db().customers.find((x) => x.phone === NQ.u.normPhone(e.target.value));
        qs('#nb-match').textContent = c ? `عميل حالي: ${c.name}` : '';
        if (c && !form.name.value) form.name.value = c.name;
      }
      drawSum();
    });
    form.addEventListener('click', (e) => {
      if (e.target.closest('[data-add-line]')) { st.lines.push({ key: NQ.u.randomHex(4), serviceId: '', qty: 1, variantId: null, optionIds: [] }); drawLines(); }
      const rm = e.target.closest('[data-rm-line]'); if (rm) { st.lines.splice(Number(rm.dataset.rmLine), 1); drawLines(); drawSum(); }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = NQ.u.formData(form);
      const btn = form.querySelector('[type=submit]'); if (btn.disabled) return; btn.disabled = true;
      try {
        const bk = S.tx((d2) => NQ.bookings.createBooking(d2, { ...v, date: st.sel.date, slotId: st.sel.slotId, items: st.lines.filter((l) => l.serviceId), idemKey: st.idem }, { source: 'admin', by: (A.user() || {}).user || 'الإدارة' }));
        UI.toast(`تم إنشاء الحجز ${bk.ref}`);
        location.hash = `#/orders/${bk.id}`;
      } catch (err) {
        btn.disabled = false;
        if (err.fields) { UI.showFieldErrors(form, err.fields); UI.toast(Object.values(err.fields)[0], 'danger'); } else UI.toast(err.message, 'danger');
      }
    });
    drawLines(); drawSum();
    return { onData: () => { redrawPick(); drawSum(); } };
  }

  // ---------- Customers ----------
  const custState = () => A.state.cust || (A.state.cust = { q: '', sort: 'value', dir: 'desc', page: 1, per: 12 });
  function customers() {
    const st = custState();
    const draw = () => {
      const d = A.db();
      const q = st.q.trim().toLowerCase(), qp = NQ.u.normPhone(q);
      let rows = d.customers.map((c) => ({ c, ...NQ.bookings.customerStats(d, c.id) })).filter((r) => !q || r.c.name.toLowerCase().includes(q) || (qp.length >= 3 && r.c.phone.includes(qp)));
      rows = A.sortBy(rows, st, { name: (r) => r.c.name, value: (r) => r.value, outstanding: (r) => r.outstanding, count: (r) => r.bookings.length });
      const pageRows = rows.slice((st.page - 1) * st.per, st.page * st.per);
      qs('#c-body').innerHTML = String(html`${pageRows.length ? html`<div class="table-responsive"><table class="tbl stack"><thead><tr>${A.sortTh('العميل', 'name', st)}${A.sortTh('الحجوزات', 'count', st)}${A.sortTh('قيمة الحجوزات', 'value', st, 'r')}<th class="r">المدفوع</th>${A.sortTh('المتبقي', 'outstanding', st, 'r')}<th class="acts"><span class="visually-hidden">إجراءات</span></th></tr></thead><tbody>
        ${pageRows.map((r) => html`<tr class="row-link" data-href="#/customers/${r.c.id}"><td data-label="العميل"><a href="#/customers/${r.c.id}">${r.c.name}</a><span class="sub ltr">${r.c.phone}</span></td><td data-label="الحجوزات">${r.bookings.length}</td><td data-label="قيمة الحجوزات" class="r">${money(r.value)}</td><td data-label="المدفوع" class="r">${money(r.paid)}</td><td data-label="المتبقي" class="r ${r.outstanding ? 'text-danger' : ''}">${money(r.outstanding)}</td><td data-label="" class="acts"><a class="btn btn-sm btn-outline" href="#/customers/${r.c.id}">الملف</a></td></tr>`)}
      </tbody></table></div>` : UI.empty('bi-people', 'لا يوجد عملاء مطابقون', 'جرّب اسمًا أو رقمًا آخر.')}${A.pager(rows.length, st)}`);
    };
    A.set(html`${A.ph('العملاء', 'يُنشأ ملف العميل تلقائيًا من الحجوزات ويُطابق برقم الموبايل بعد توحيد صيغته.')}
      <section class="panel"><div class="p-3 border-bottom"><label class="visually-hidden" for="c-q">بحث</label><input class="form-control" id="c-q" type="search" placeholder="ابحث بالاسم أو رقم الموبايل" value="${st.q}"></div><div id="c-body"></div></section>`);
    const main = A.main();
    main.oninput = NQ.u.debounce((e) => { if (e.target.id === 'c-q') { st.q = e.target.value; st.page = 1; draw(); } }, 200);
    main.onclick = (e) => {
      const so = e.target.closest('[data-sort]'); if (so) { st.dir = st.sort === so.dataset.sort && st.dir === 'desc' ? 'asc' : 'desc'; st.sort = so.dataset.sort; return draw(); }
      const p = e.target.closest('[data-page]'); if (p) { st.page = Number(p.dataset.page); return draw(); }
      const tr = e.target.closest('tr[data-href]'); if (tr && !e.target.closest('a,button')) location.hash = tr.dataset.href;
    };
    draw();
    return { onData: draw };
  }

  function customerDetail(id) {
    const d = A.db();
    const c = S.by(d.customers, id);
    if (!c) { A.set(UI.empty('bi-person-x', 'العميل غير موجود', '', html`<a class="btn btn-brand" href="#/customers">كل العملاء</a>`)); return; }
    const st = NQ.bookings.customerStats(d, id);
    const pays = d.payments.filter((p) => st.bookings.some((b) => b.id === p.bookingId)).sort((a, b) => b.date.localeCompare(a.date));
    A.set(html`<nav class="crumbs small mb-2"><a href="#/customers">العملاء</a> / ${c.name}</nav>
      ${A.ph(c.name, html`<a class="ltr" href="tel:${c.phone}">${c.phone}</a> — عميل منذ ${fmtDate(c.createdAt.slice(0, 10), { month: 'long', year: 'numeric' })}`, html`<a class="btn btn-outline" href="https://wa.me/2${c.phone}" target="_blank" rel="noopener"><i class="bi bi-whatsapp" aria-hidden="true"></i>واتساب</a>`)}
      <div class="kpis"><div class="kpi"><div class="k">عدد الحجوزات</div><div class="v">${st.bookings.length}</div></div><div class="kpi"><div class="k">قيمة الحجوزات (غير الملغاة)</div><div class="v">${money(st.value)}</div></div><div class="kpi"><div class="k">صافي المدفوع</div><div class="v">${money(st.paid)}</div></div><div class="kpi ${st.outstanding ? 'neg' : ''}"><div class="k">المتبقي</div><div class="v">${money(st.outstanding)}</div></div></div>
      <div class="grid-2">
        <section class="panel"><div class="card-h"><h2>سجل الحجوزات</h2></div><div class="table-responsive"><table class="tbl stack"><thead><tr><th>الحجز</th><th>الموعد</th><th>الحالة</th><th>الدفع</th><th class="r">الإجمالي</th></tr></thead><tbody>
          ${st.bookings.map((b) => html`<tr class="row-link" data-href="#/orders/${b.id}"><td data-label="الحجز">${A.bookingLink(b)}<span class="sub">${b.items.map((i) => i.name).join('، ')}</span></td><td data-label="الموعد">${fmtDate(b.date, { day: 'numeric', month: 'short', year: 'numeric' })}<span class="sub">${b.areaName}</span></td><td data-label="الحالة">${UI.statusBadge(b.status)}</td><td data-label="الدفع">${UI.payBadge(FIN.bookingFinance(d, b).status)}</td><td data-label="الإجمالي" class="r">${money(b.total)}</td></tr>`)}
        </tbody></table></div></section>
        <section class="panel"><div class="card-h"><h2>المدفوعات المسجلة</h2></div>${pays.length ? html`<ul class="mini-list">${pays.map((p) => html`<li><span>${p.kind === 'refund' ? 'استرداد' : 'دفعة'} — ${FIN.METHODS[p.method]}<span class="sub">${fmtDate(p.date, { day: 'numeric', month: 'short', year: 'numeric' })} — ${(S.by(d.bookings, p.bookingId) || {}).ref}</span></span><b class="${p.kind === 'refund' ? 'text-danger' : ''}">${p.kind === 'refund' ? '−' : ''}${money(p.amount)}</b></li>`)}</ul>` : UI.empty('bi-cash', 'لا توجد مدفوعات', '')}</section>
      </div>`);
    A.main().onclick = (e) => { const tr = e.target.closest('tr[data-href]'); if (tr && !e.target.closest('a,button')) location.hash = tr.dataset.href; };
  }

  A.route(/^\/dashboard$/, 'dashboard', dashboard, 'لوحة المتابعة');
  A.route(/^\/orders$/, 'orders', orders, 'الحجوزات');
  A.route(/^\/orders\/new$/, 'new-order', newOrder, 'حجز جديد', 'orders');
  A.route(/^\/orders\/([\w-]+)$/, 'order', orderDetail, 'تفاصيل الحجز', 'orders');
  A.route(/^\/customers$/, 'customers', customers, 'العملاء');
  A.route(/^\/customers\/([\w-]+)$/, 'customer', customerDetail, 'ملف العميل', 'customers');
  A.slotPicker = slotPicker;
})(window.NQ = window.NQ || {});
