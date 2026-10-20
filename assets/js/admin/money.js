/* Naqaa demo — admin: payments, expenses, financial reports */
(function (NQ) {
  'use strict';
  const A = NQ.admin;
  const { html, raw, money, num, qs, fmtDate, todayStr, inRange } = NQ.u;
  const S = NQ.store, UI = NQ.ui, FIN = NQ.finance;
  const dShort = (s) => fmtDate(s, { day: 'numeric', month: 'short', year: 'numeric' });

  // ---------- Payments ----------
  function payments() {
    const st = A.state.pay || (A.state.pay = { q: '', method: '', kind: '', sort: 'date', dir: 'desc', page: 1, per: 12 });
    const draw = () => {
      const d = A.db();
      const r = A.getRange('pay', 'all');
      const q = st.q.trim().toLowerCase();
      let rows = d.payments.map((p) => ({ p, b: S.by(d.bookings, p.bookingId) })).filter(({ p, b }) => inRange(p.date, r.from, r.to) && (!st.method || p.method === st.method) && (!st.kind || p.kind === st.kind) && (!q || (b && (b.ref.toLowerCase().includes(q) || b.customer.name.toLowerCase().includes(q)))));
      const gross = rows.filter((x) => x.p.kind === 'payment').reduce((s, x) => s + x.p.amount, 0);
      const ref = rows.filter((x) => x.p.kind === 'refund').reduce((s, x) => s + x.p.amount, 0);
      rows = A.sortBy(rows, st, { date: (x) => x.p.date + x.p.createdAt, amount: (x) => (x.p.kind === 'refund' ? -1 : 1) * x.p.amount });
      const pageRows = rows.slice((st.page - 1) * st.per, st.page * st.per);
      qs('#pay-sum').innerHTML = String(html`<div class="kpi"><div class="k">المدفوعات</div><div class="v">${money(gross)}</div></div><div class="kpi"><div class="k">الاستردادات</div><div class="v">${money(ref)}</div></div><div class="kpi hl"><div class="k">صافي التحصيل</div><div class="v">${money(gross - ref)}</div></div>`);
      qs('#pay-body').innerHTML = String(html`${pageRows.length ? html`<div class="table-responsive"><table class="tbl stack"><thead><tr>${A.sortTh('التاريخ', 'date', st)}<th>الحجز</th><th>النوع</th><th>الطريقة</th><th>ملاحظات</th>${A.sortTh('المبلغ', 'amount', st, 'r')}<th class="acts"><span class="visually-hidden">إجراءات</span></th></tr></thead><tbody>
        ${pageRows.map(({ p, b }) => html`<tr><td data-label="التاريخ">${dShort(p.date)}<span class="sub">${p.by}</span></td><td data-label="الحجز">${b ? html`${A.bookingLink(b)}<span class="sub">${b.customer.name}</span>` : html`<span class="text-danger">حجز غير موجود</span>`}</td><td data-label="النوع">${p.kind === 'refund' ? html`<span class="nq-badge tone-danger">استرداد</span>` : html`<span class="nq-badge tone-success">دفعة</span>`}</td><td data-label="الطريقة">${FIN.METHODS[p.method] || p.method}</td><td data-label="ملاحظات">${p.notes || '—'}</td><td data-label="المبلغ" class="r ${p.kind === 'refund' ? 'text-danger' : ''}">${p.kind === 'refund' ? '−' : ''}${money(p.amount)}</td><td data-label="" class="acts">${b ? html`<button class="btn btn-sm btn-ghost" data-edit="${p.id}" aria-label="تعديل"><i class="bi bi-pencil" aria-hidden="true"></i></button>` : ''}<button class="btn btn-sm btn-ghost text-danger" data-del="${p.id}" aria-label="حذف"><i class="bi bi-trash3" aria-hidden="true"></i></button></td></tr>`)}
      </tbody></table></div>` : UI.empty('bi-cash-stack', 'لا توجد عمليات في هذه الفترة', 'غيّر الفترة أو عوامل التصفية.')}${A.pager(rows.length, st)}`);
    };
    A.set(html`${A.ph('المدفوعات', 'كل دفعة أو استرداد عملية مستقلة مرتبطة بحجز. حالة الدفع تُحسب من هذه العمليات.', html`<button class="btn btn-brand" data-new><i class="bi bi-plus-lg" aria-hidden="true"></i>تسجيل دفعة</button>`)}
      <div class="mb-3">${A.rangeBar('pay', 'all')}</div>
      <div class="kpis" id="pay-sum"></div>
      <section class="panel"><div class="filters" style="grid-template-columns:2fr 1fr 1fr">
        <div><label class="visually-hidden" for="py-q">بحث</label><input class="form-control" id="py-q" type="search" placeholder="رقم الحجز أو اسم العميل" value="${st.q}"></div>
        <div><label class="visually-hidden" for="py-m">الطريقة</label><select class="form-select" id="py-m" data-f="method"><option value="">كل الطرق</option>${Object.entries(FIN.METHODS).map(([k, v]) => html`<option value="${k}" ${st.method === k ? 'selected' : ''}>${v}</option>`)}</select></div>
        <div><label class="visually-hidden" for="py-k">النوع</label><select class="form-select" id="py-k" data-f="kind"><option value="">الكل</option><option value="payment" ${st.kind === 'payment' ? 'selected' : ''}>مدفوعات</option><option value="refund" ${st.kind === 'refund' ? 'selected' : ''}>استردادات</option></select></div>
      </div><div id="pay-body"></div></section>`);
    const main = A.main();
    A.bindRange(main, A.rerender);
    main.oninput = NQ.u.debounce((e) => { if (e.target.id === 'py-q') { st.q = e.target.value; st.page = 1; draw(); } }, 200);
    main.onchange = (e) => { if (e.target.dataset.f) { st[e.target.dataset.f] = e.target.value; st.page = 1; draw(); } };
    main.onclick = (e) => {
      const so = e.target.closest('[data-sort]'); if (so) { st.dir = st.sort === so.dataset.sort && st.dir === 'desc' ? 'asc' : 'desc'; st.sort = so.dataset.sort; return draw(); }
      const pg = e.target.closest('[data-page]'); if (pg) { st.page = Number(pg.dataset.page); return draw(); }
      const ed = e.target.closest('[data-edit]'); if (ed) { const p = S.by(A.db().payments, ed.dataset.edit); return A.paymentModal(p.bookingId, p); }
      const del = e.target.closest('[data-del]'); if (del) return A.deletePayment(S.by(A.db().payments, del.dataset.del));
      if (e.target.closest('[data-new]')) return pickBooking();
    };
    draw();
    return { onData: draw };
  }

  function pickBooking() {
    const d = A.db();
    const open = d.bookings.filter((b) => b.status !== 'canceled' && FIN.bookingFinance(d, b).outstanding > 0).sort((a, b) => b.date.localeCompare(a.date));
    if (!open.length) return UI.toast('لا توجد حجوزات عليها مبالغ متبقية', 'info');
    A.formModal({
      title: 'اختر الحجز', saveText: 'متابعة',
      body: html`<label class="form-label" for="pb">الحجز</label><select class="form-select" id="pb" name="bookingId">${open.map((b) => html`<option value="${b.id}">${b.ref} — ${b.customer.name} — متبقي ${money(FIN.bookingFinance(d, b).outstanding)}</option>`)}</select>`,
      onSave(v) { document.querySelector('.modal').addEventListener('hidden.bs.modal', () => A.paymentModal(v.bookingId, null, 'payment'), { once: true }); },
    });
  }

  // ---------- Expenses ----------
  function expenses() {
    const st = A.state.exp || (A.state.exp = { cat: '', q: '', sort: 'date', dir: 'desc', page: 1, per: 12 });
    const draw = () => {
      const d = A.db();
      const r = A.getRange('exp', 'month');
      const q = st.q.trim();
      let rows = d.expenses.filter((e) => inRange(e.date, r.from, r.to) && (!st.cat || e.category === st.cat) && (!q || e.desc.includes(q) || (e.notes || '').includes(q)));
      const total = rows.reduce((s, e) => s + e.amount, 0);
      const byCat = {}; rows.forEach((e) => { const k = FIN.EXPENSE_CATS[e.category] || 'أخرى'; byCat[k] = (byCat[k] || 0) + e.amount; });
      rows = A.sortBy(rows, st, { date: (e) => e.date + e.createdAt, amount: (e) => e.amount });
      const pageRows = rows.slice((st.page - 1) * st.per, st.page * st.per);
      qs('#exp-side').innerHTML = String(html`<div class="card-h"><h2>الإجمالي</h2><b>${money(total)}</b></div><div class="card-b">${UI.barList(Object.entries(byCat).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value))}</div>`);
      qs('#exp-body').innerHTML = String(html`${pageRows.length ? html`<div class="table-responsive"><table class="tbl stack"><thead><tr>${A.sortTh('التاريخ', 'date', st)}<th>البيان</th><th>الفئة</th>${A.sortTh('المبلغ', 'amount', st, 'r')}<th class="acts"><span class="visually-hidden">إجراءات</span></th></tr></thead><tbody>
        ${pageRows.map((e) => html`<tr><td data-label="التاريخ">${dShort(e.date)}</td><td data-label="البيان">${e.desc}${e.notes ? html`<span class="sub">${e.notes}</span>` : ''}</td><td data-label="الفئة">${FIN.EXPENSE_CATS[e.category] || e.category}</td><td data-label="المبلغ" class="r">${money(e.amount)}</td><td data-label="" class="acts"><button class="btn btn-sm btn-ghost" data-edit="${e.id}" aria-label="تعديل"><i class="bi bi-pencil" aria-hidden="true"></i></button><button class="btn btn-sm btn-ghost text-danger" data-del="${e.id}" aria-label="حذف"><i class="bi bi-trash3" aria-hidden="true"></i></button></td></tr>`)}
      </tbody></table></div>` : UI.empty('bi-receipt', 'لا توجد مصروفات في هذه الفترة', 'سجّل مصروفًا أو غيّر الفترة.', html`<button class="btn btn-brand" data-new>تسجيل مصروف</button>`)}${A.pager(rows.length, st)}`);
    };
    A.set(html`${A.ph('المصروفات', 'مصروفات التشغيل الفعلية. تكلفة الانتقالات الفعلية تُسجل هنا بشكل منفصل عن رسوم الانتقال المحصلة من العملاء.', html`<button class="btn btn-brand" data-new><i class="bi bi-plus-lg" aria-hidden="true"></i>تسجيل مصروف</button>`)}
      <div class="mb-3">${A.rangeBar('exp', 'month')}</div>
      <div class="grid-2"><section class="panel"><div class="filters" style="grid-template-columns:2fr 1fr"><div><label class="visually-hidden" for="ex-q">بحث</label><input class="form-control" id="ex-q" type="search" placeholder="ابحث في البيان" value="${st.q}"></div><div><label class="visually-hidden" for="ex-c">الفئة</label><select class="form-select" id="ex-c"><option value="">كل الفئات</option>${Object.entries(FIN.EXPENSE_CATS).map(([k, v]) => html`<option value="${k}" ${st.cat === k ? 'selected' : ''}>${v}</option>`)}</select></div></div><div id="exp-body"></div></section>
      <section class="panel align-self-start" id="exp-side"></section></div>`);
    const main = A.main();
    A.bindRange(main, A.rerender);
    main.oninput = NQ.u.debounce((e) => { if (e.target.id === 'ex-q') { st.q = e.target.value; st.page = 1; draw(); } }, 200);
    main.onchange = (e) => { if (e.target.id === 'ex-c') { st.cat = e.target.value; st.page = 1; draw(); } };
    main.onclick = async (e) => {
      const so = e.target.closest('[data-sort]'); if (so) { st.dir = st.sort === so.dataset.sort && st.dir === 'desc' ? 'asc' : 'desc'; st.sort = so.dataset.sort; return draw(); }
      const pg = e.target.closest('[data-page]'); if (pg) { st.page = Number(pg.dataset.page); return draw(); }
      if (e.target.closest('[data-new]')) return expenseModal(null);
      const ed = e.target.closest('[data-edit]'); if (ed) return expenseModal(S.by(A.db().expenses, ed.dataset.edit));
      const del = e.target.closest('[data-del]');
      if (del) {
        const x = S.by(A.db().expenses, del.dataset.del);
        if (await UI.confirm({ title: 'حذف المصروف', message: `حذف "${x.desc}" بمبلغ ${money(x.amount)}؟`, detail: 'ستتحدث التقارير والفائض التقديري فورًا.', okText: 'حذف', danger: true })) { S.tx((d2) => { d2.expenses = d2.expenses.filter((y) => y.id !== x.id); S.log(d2, `حذف مصروف ${x.desc}`); }); UI.toast('تم حذف المصروف', 'info'); }
      }
    };
    draw();
    return { onData: draw };
  }

  function expenseModal(x) {
    A.formModal({
      title: x ? 'تعديل مصروف' : 'تسجيل مصروف', saveText: x ? 'حفظ التعديل' : 'تسجيل المصروف',
      body: html`<div class="row g-3">
        <div class="col-12"><label class="form-label" for="e-d">البيان<span class="req">*</span></label><input class="form-control" id="e-d" name="desc" maxlength="120" value="${x ? x.desc : ''}"><div class="invalid-feedback" data-for="desc"></div></div>
        <div class="col-sm-6"><label class="form-label" for="e-c">الفئة</label><select class="form-select" id="e-c" name="category">${Object.entries(FIN.EXPENSE_CATS).map(([k, v]) => html`<option value="${k}" ${x && x.category === k ? 'selected' : ''}>${v}</option>`)}</select></div>
        <div class="col-sm-6"><label class="form-label" for="e-a">المبلغ (ج.م)<span class="req">*</span></label><input class="form-control" id="e-a" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" value="${x ? x.amount : ''}"><div class="invalid-feedback" data-for="amount"></div></div>
        <div class="col-sm-6"><label class="form-label" for="e-dt">التاريخ<span class="req">*</span></label><input class="form-control" id="e-dt" name="date" type="date" max="${todayStr()}" value="${x ? x.date : todayStr()}"><div class="invalid-feedback" data-for="date"></div></div>
        <div class="col-12"><label class="form-label" for="e-n">ملاحظات</label><input class="form-control" id="e-n" name="notes" value="${x ? x.notes : ''}"></div>
        ${x ? html`<div class="col-12 small text-muted">أُنشئ ${NQ.u.fmtDateTime(x.createdAt)}${x.updatedAt && x.updatedAt !== x.createdAt ? ` — آخر تعديل ${NQ.u.fmtDateTime(x.updatedAt)}` : ''}</div>` : ''}
      </div>`,
      onSave(v) {
        const f = {};
        if (v.desc.trim().length < 2) f.desc = 'اكتب بيان المصروف';
        const amount = NQ.u.round2(Number(v.amount)); if (!(amount > 0)) f.amount = 'أدخل مبلغًا أكبر من صفر';
        if (!NQ.u.isValidDate(v.date) || v.date > todayStr()) f.date = 'اختر تاريخًا لا يتجاوز اليوم';
        if (Object.keys(f).length) throw A.fieldErr(f);
        const now = new Date().toISOString();
        S.tx((d2) => {
          const data = { desc: v.desc.trim(), category: v.category, amount, date: v.date, notes: v.notes.trim(), updatedAt: now };
          if (x) Object.assign(S.by(d2.expenses, x.id), data); else d2.expenses.push({ id: NQ.u.uid('exp'), createdAt: now, ...data });
          S.log(d2, `${x ? 'تعديل' : 'تسجيل'} مصروف ${data.desc} ${money(amount)}`);
        });
        UI.toast(x ? 'تم حفظ المصروف' : 'تم تسجيل المصروف');
      },
    });
  }

  // ---------- Reports ----------
  function reports() {
    const d = A.db();
    const r = A.getRange('rep', 'month');
    const br = FIN.breakdowns(d, r);
    const s = br.summary;
    const ser = FIN.series(d, r);
    const owing = s.eligible.map((b) => ({ b, f: FIN.bookingFinance(d, b) })).filter((x) => x.f.outstanding > 0).sort((a, b) => b.f.outstanding - a.f.outstanding);
    A.set(html`${A.ph('التقارير المالية', 'كل الأرقام مشتقة من السجلات نفسها التي تعرضها لوحة المتابعة.', html`${A.rangeBar('rep', 'month')}<button class="btn btn-outline no-print" data-print><i class="bi bi-printer" aria-hidden="true"></i>طباعة</button>`)}
      <div class="kpis">
        <div class="kpi"><div class="k">قيمة الحجوزات</div><div class="v">${money(s.orderValue)}</div><div class="s">خدمات ${money(s.serviceValue)} + انتقالات ${money(s.transportFees)}</div></div>
        <div class="kpi"><div class="k">المدفوعات المحصلة</div><div class="v">${money(s.gross)}</div></div>
        <div class="kpi"><div class="k">الاستردادات</div><div class="v">${money(s.refunds)}</div></div>
        <div class="kpi"><div class="k">صافي التحصيل</div><div class="v">${money(s.collections)}</div></div>
        <div class="kpi"><div class="k">المستحق على العملاء</div><div class="v">${money(s.outstanding)}</div></div>
        <div class="kpi"><div class="k">المصروفات</div><div class="v">${money(s.expenses)}</div></div>
        <div class="kpi hl ${s.surplus < 0 ? 'neg' : ''}"><div class="k">صافي الفائض النقدي التقديري</div><div class="v">${money(s.surplus)}</div><div class="s">صافي التحصيل − المصروفات</div></div>
      </div>
      <section class="panel mb-3"><div class="card-h"><h2>الحجوزات والتحصيل والمصروفات عبر الوقت</h2></div><div class="card-b">${UI.lineChart(ser.map((x) => x.label), [{ name: 'قيمة الحجوزات', values: ser.map((x) => x.orderValue) }, { name: 'صافي التحصيل', values: ser.map((x) => x.collections) }, { name: 'المصروفات', values: ser.map((x) => x.expenses) }], { label: 'رسم بياني للحجوزات والتحصيل والمصروفات' })}</div></section>
      <div class="grid-2e mb-3">
        <section class="panel"><div class="card-h"><h2>المبيعات حسب الخدمة</h2></div><div class="card-b">${UI.barList(br.byService)}</div></section>
        <section class="panel"><div class="card-h"><h2>المبيعات حسب المنطقة</h2><span class="small text-muted">شامل رسوم الانتقال</span></div><div class="card-b">${UI.barList(br.byArea)}</div></section>
        <section class="panel"><div class="card-h"><h2>صافي التحصيل حسب طريقة الدفع</h2></div><div class="card-b">${UI.barList(br.byMethod)}</div></section>
        <section class="panel"><div class="card-h"><h2>المصروفات حسب الفئة</h2></div><div class="card-b">${UI.barList(br.byExpense)}</div></section>
      </div>
      <section class="panel mb-3"><div class="card-h"><h2>أرصدة مستحقة على العملاء</h2><b>${money(s.outstanding)}</b></div>
        ${owing.length ? html`<div class="table-responsive"><table class="tbl stack"><thead><tr><th>الحجز</th><th>العميل</th><th>الموعد</th><th>الحالة</th><th class="r">الإجمالي</th><th class="r">المدفوع</th><th class="r">المتبقي</th></tr></thead><tbody>${owing.map(({ b, f }) => html`<tr class="row-link" data-href="#/orders/${b.id}"><td data-label="الحجز">${A.bookingLink(b)}</td><td data-label="العميل">${b.customer.name}</td><td data-label="الموعد">${dShort(b.date)}</td><td data-label="الحالة">${UI.statusBadge(b.status)}</td><td data-label="الإجمالي" class="r">${money(b.total)}</td><td data-label="المدفوع" class="r">${money(f.paid)}</td><td data-label="المتبقي" class="r text-danger">${money(f.outstanding)}</td></tr>`)}</tbody></table></div>` : UI.empty('bi-check2-circle', 'لا توجد أرصدة مستحقة في هذه الفترة', '')}
      </section>
      <section class="panel panel-pad"><h2 class="h6">تعريفات الأرقام</h2><ul class="small text-muted mb-0">
        <li><b>قيمة الحجوزات:</b> إجمالي الحجوزات غير الملغاة التي يقع موعدها داخل الفترة، شاملة رسوم الانتقال المحصلة من العميل.</li>
        <li><b>صافي التحصيل:</b> المدفوعات المسجلة بتاريخ داخل الفترة ناقص الاستردادات المسجلة في الفترة.</li>
        <li><b>المستحق على العملاء:</b> الجزء غير المدفوع من الحجوزات غير الملغاة في الفترة. الحجوزات الملغاة لا تُحسب كمبيعات.</li>
        <li><b>المصروفات:</b> المصروفات المسجلة بتاريخ داخل الفترة، ومنها تكلفة الانتقالات الفعلية (لا تُخصم رسوم الانتقال مرتين).</li>
        <li><b>صافي الفائض النقدي التقديري:</b> صافي التحصيل ناقص المصروفات المسجلة. تقدير مبني على ما تم إدخاله فقط وليس ربحًا محاسبيًا (لا يشمل الضرائب أو الالتزامات غير المسجلة).</li>
      </ul></section>`);
    const main = A.main();
    A.bindRange(main, A.rerender);
    main.onclick = (e) => {
      if (e.target.closest('[data-print]')) return window.print();
      const tr = e.target.closest('tr[data-href]'); if (tr && !e.target.closest('a,button')) location.hash = tr.dataset.href;
    };
  }

  A.route(/^\/payments$/, 'payments', payments, 'المدفوعات');
  A.route(/^\/expenses$/, 'expenses', expenses, 'المصروفات');
  A.route(/^\/reports$/, 'reports', reports, 'التقارير المالية');
})(window.NQ = window.NQ || {});
