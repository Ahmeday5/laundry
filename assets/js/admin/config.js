/* Naqaa demo — admin: services, categories, schedule, areas, settings */
(function (NQ) {
  'use strict';
  const A = NQ.admin;
  const { html, raw, money, num, qs, qsa, fmtDate, fmtTime, todayStr, addDays, DAY_NAMES } = NQ.u;
  const S = NQ.store, UI = NQ.ui, FIN = NQ.finance, SCH = NQ.schedule, P = NQ.pricing;
  const usedServiceIds = (d) => new Set(d.bookings.flatMap((b) => b.items.map((i) => i.serviceId)));
  const switchEl = (attr, id, on, label) => html`<div class="form-check form-switch m-0"><input class="form-check-input" type="checkbox" role="switch" ${raw(attr)}="${id}" ${on ? 'checked' : ''} aria-label="${label}"></div>`;

  // ---------- Services ----------
  function services() {
    const st = A.state.svc || (A.state.svc = { cat: '' });
    const d = A.db();
    const used = usedServiceIds(d);
    const rows = d.services.filter((s) => !st.cat || s.categoryId === st.cat);
    A.set(html`${A.ph('الخدمات', 'تغيير السعر يؤثر على الحجوزات الجديدة فقط؛ الحجوزات السابقة تحتفظ بسعرها.', html`<button class="btn btn-brand" data-new><i class="bi bi-plus-lg" aria-hidden="true"></i>خدمة جديدة</button>`)}
      <section class="panel">
        <div class="p-3 border-bottom d-flex gap-2 flex-wrap align-items-center"><label class="small text-muted" for="sv-cat">الفئة</label><select class="form-select w-auto" id="sv-cat"><option value="">كل الفئات</option>${d.categories.map((c) => html`<option value="${c.id}" ${st.cat === c.id ? 'selected' : ''}>${c.name}</option>`)}</select><span class="small text-muted ms-auto">${rows.length} خدمة</span></div>
        ${rows.length ? html`<div class="table-responsive"><table class="tbl stack"><thead><tr><th>الخدمة</th><th>الفئة</th><th>التسعير</th><th>طريقة التنفيذ</th><th>مفعّلة</th><th>مميزة</th><th class="acts"><span class="visually-hidden">إجراءات</span></th></tr></thead><tbody>
          ${rows.map((s) => { const c = S.by(d.categories, s.categoryId); return html`<tr><td data-label="الخدمة"><div class="d-flex gap-2 align-items-center"><span class="svc-thumb">${UI.serviceArt(s)}</span><span>${s.name}<span class="sub">${used.has(s.id) ? 'مستخدمة في حجوزات' : 'غير مستخدمة بعد'}</span></span></div></td>
            <td data-label="الفئة">${c ? c.name : '—'}${c && !c.active ? html`<span class="sub text-danger">الفئة موقوفة</span>` : ''}</td>
            <td data-label="التسعير">${P.priceText(s)}<span class="sub">${P.PRICING[s.pricing].name}</span></td>
            <td data-label="التنفيذ">${s.workflow === 'pickup' ? 'استلام وتسليم' : 'في موقع العميل'}</td>
            <td data-label="مفعّلة">${switchEl('data-active', s.id, s.active, 'تفعيل الخدمة')}</td>
            <td data-label="مميزة">${switchEl('data-featured', s.id, s.featured, 'إظهار في الرئيسية')}</td>
            <td data-label="" class="acts"><button class="btn btn-sm btn-outline" data-edit="${s.id}">تعديل</button><button class="btn btn-sm btn-ghost text-danger" data-del="${s.id}" aria-label="حذف ${s.name}"><i class="bi bi-trash3" aria-hidden="true"></i></button></td></tr>`; })}
        </tbody></table></div>` : UI.empty('bi-grid', 'لا توجد خدمات في هذه الفئة', '', html`<button class="btn btn-brand" data-new>إضافة خدمة</button>`)}
      </section>`);
    const main = A.main();
    main.onchange = (e) => {
      if (e.target.id === 'sv-cat') { st.cat = e.target.value; return A.rerender(); }
      const a = e.target.dataset.active, f = e.target.dataset.featured;
      if (a) { S.tx((d2) => { const s = S.by(d2.services, a); s.active = e.target.checked; S.log(d2, `${s.active ? 'تفعيل' : 'إيقاف'} خدمة ${s.name}`); }); UI.toast(e.target.checked ? 'الخدمة متاحة للحجز' : 'تم إخفاء الخدمة من الموقع — الحجوزات السابقة لم تتأثر', 'info'); }
      if (f) { S.tx((d2) => { S.by(d2.services, f).featured = e.target.checked; }); UI.toast('تم التحديث'); }
    };
    main.onclick = async (e) => {
      if (e.target.closest('[data-new]')) return serviceModal(null);
      const ed = e.target.closest('[data-edit]'); if (ed) return serviceModal(S.by(A.db().services, ed.dataset.edit));
      const del = e.target.closest('[data-del]');
      if (del) {
        const s = S.by(A.db().services, del.dataset.del);
        if (usedServiceIds(A.db()).has(s.id)) return UI.modal({ title: 'لا يمكن حذف الخدمة', size: 'sm', body: html`<p>"${s.name}" مستخدمة في حجوزات مسجلة. حذفها سيجعل سجلها غير واضح.</p><p class="small text-muted mb-0">أوقفها بدلًا من ذلك: تختفي من الموقع وتبقى الحجوزات كما هي.</p>`, footer: html`<button class="btn btn-ghost" data-bs-dismiss="modal">إغلاق</button>` });
        if (await UI.confirm({ title: 'حذف الخدمة', message: `حذف "${s.name}" نهائيًا؟`, okText: 'حذف', danger: true })) { S.tx((d2) => { d2.services = d2.services.filter((x) => x.id !== s.id); S.log(d2, `حذف خدمة ${s.name}`); }); UI.toast('تم حذف الخدمة', 'info'); }
      }
    };
  }

  function rowsEditor(kind, list) {
    return html`<div data-rows="${kind}">${(list || []).map((r) => rowEdit(kind, r))}</div><button type="button" class="btn btn-sm btn-outline" data-add-row="${kind}"><i class="bi bi-plus" aria-hidden="true"></i>${kind === 'variants' ? 'إضافة نوع' : 'إضافة اختيار'}</button>`;
  }
  const rowEdit = (kind, r) => html`<div class="row-edit" data-row="${r.id}"><input class="form-control" placeholder="${kind === 'variants' ? 'اسم النوع' : 'اسم الإضافة'}" value="${r.name || ''}" data-rn aria-label="الاسم"><input class="form-control" type="number" min="0" step="0.5" placeholder="السعر" value="${r.price != null ? r.price : ''}" data-rp aria-label="السعر"><button type="button" class="btn btn-ghost btn-icon text-danger" data-rm-row aria-label="حذف"><i class="bi bi-x-lg" aria-hidden="true"></i></button></div>`;

  function readImage(file) {
    return new Promise((resolve, reject) => {
      if (!/^image\//.test(file.type)) return reject(new Error('اختر ملف صورة'));
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const w = Math.min(720, img.width), h = Math.round(img.height * (w / img.width));
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/jpeg', 0.78)); // small enough for LocalStorage
        };
        img.onerror = () => reject(new Error('تعذّر قراءة الصورة'));
        img.src = fr.result;
      };
      fr.onerror = () => reject(new Error('تعذّر قراءة الملف'));
      fr.readAsDataURL(file);
    });
  }

  function serviceModal(s) {
    const d = A.db();
    const isNew = !s;
    s = s || { name: '', categoryId: (d.categories[0] || {}).id, short: '', desc: '', pricing: 'fixed', price: 0, min: 1, max: 10, step: 0.5, variants: [], options: [], duration: '', workflow: 'onsite', active: true, featured: false, image: null };
    let image = s.image;
    A.formModal({
      title: isNew ? 'خدمة جديدة' : `تعديل: ${s.name}`, size: 'lg', saveText: isNew ? 'إضافة الخدمة' : 'حفظ التعديلات',
      body: html`<div class="row g-3">
        <div class="col-md-8"><label class="form-label" for="s-name">اسم الخدمة<span class="req">*</span></label><input class="form-control" id="s-name" name="name" value="${s.name}" required><div class="invalid-feedback" data-for="name"></div></div>
        <div class="col-md-4"><label class="form-label" for="s-cat">الفئة</label><select class="form-select" id="s-cat" name="categoryId">${d.categories.map((c) => html`<option value="${c.id}" ${c.id === s.categoryId ? 'selected' : ''}>${c.name}${c.active ? '' : ' (موقوفة)'}</option>`)}</select><div class="invalid-feedback" data-for="categoryId"></div></div>
        <div class="col-12"><label class="form-label" for="s-short">وصف مختصر</label><input class="form-control" id="s-short" name="short" maxlength="90" value="${s.short}"></div>
        <div class="col-12"><label class="form-label" for="s-desc">الوصف التفصيلي</label><textarea class="form-control" id="s-desc" name="desc">${s.desc}</textarea></div>
        <div class="col-md-4"><label class="form-label" for="s-pr">طريقة التسعير</label><select class="form-select" id="s-pr" name="pricing">${Object.entries(P.PRICING).map(([k, v]) => html`<option value="${k}" ${k === s.pricing ? 'selected' : ''}>${v.name}</option>`)}</select></div>
        <div class="col-md-4"><label class="form-label" for="s-price">السعر الأساسي (ج.م)<span class="req">*</span></label><input class="form-control" id="s-price" name="price" type="number" min="0" step="0.5" value="${s.price}"><div class="invalid-feedback" data-for="price"></div><div class="form-text">يُستبدل بسعر النوع إذا أضفت أنواعًا.</div></div>
        <div class="col-md-4"><label class="form-label" for="s-wf">طريقة التنفيذ</label><select class="form-select" id="s-wf" name="workflow"><option value="onsite" ${s.workflow === 'onsite' ? 'selected' : ''}>في موقع العميل</option><option value="pickup" ${s.workflow === 'pickup' ? 'selected' : ''}>استلام وتسليم</option></select></div>
        <div class="col-4"><label class="form-label" for="s-min">الحد الأدنى</label><input class="form-control" id="s-min" name="min" type="number" min="0.5" step="0.5" value="${s.min}"><div class="invalid-feedback" data-for="min"></div></div>
        <div class="col-4"><label class="form-label" for="s-max">الحد الأقصى</label><input class="form-control" id="s-max" name="max" type="number" min="1" step="0.5" value="${s.max}"></div>
        <div class="col-4"><label class="form-label" for="s-dur">المدة / ملاحظة</label><input class="form-control" id="s-dur" name="duration" value="${s.duration}"></div>
        <div class="col-md-6"><p class="form-label mb-2">الأنواع (اختياري)</p>${rowsEditor('variants', s.variants)}<div class="invalid-feedback" data-for="variants"></div></div>
        <div class="col-md-6"><p class="form-label mb-2">إضافات تُحسب لكل وحدة (اختياري)</p>${rowsEditor('options', s.options)}<div class="invalid-feedback" data-for="options"></div></div>
        <div class="col-md-6"><label class="form-label" for="s-img">صورة الخدمة</label><input class="form-control" type="file" id="s-img" accept="image/*"><div class="d-flex gap-2 align-items-center mt-2"><div class="img-prev" id="s-prev"></div><button type="button" class="btn btn-sm btn-ghost" data-noimg>استخدام الرسم الافتراضي</button></div></div>
        <div class="col-md-6 d-flex flex-column gap-2 justify-content-end"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" role="switch" id="s-act" name="active" ${s.active ? 'checked' : ''}><label class="form-check-label" for="s-act">متاحة للحجز</label></div><div class="form-check form-switch"><input class="form-check-input" type="checkbox" role="switch" id="s-feat" name="featured" ${s.featured ? 'checked' : ''}><label class="form-check-label" for="s-feat">تظهر في الصفحة الرئيسية</label></div></div>
      </div>`,
      onMount(form) {
        const prev = () => { form.querySelector('#s-prev').innerHTML = String(UI.serviceArt({ ...s, image, categoryId: form.categoryId.value, name: form.name.value })); };
        prev();
        form.addEventListener('click', (e) => {
          const add = e.target.closest('[data-add-row]');
          if (add) { const box = form.querySelector(`[data-rows="${add.dataset.addRow}"]`); box.insertAdjacentHTML('beforeend', String(rowEdit(add.dataset.addRow, { id: NQ.u.uid(add.dataset.addRow === 'variants' ? 'v' : 'o'), name: '', price: '' }))); }
          const rm = e.target.closest('[data-rm-row]'); if (rm) rm.closest('[data-row]').remove();
          if (e.target.closest('[data-noimg]')) { image = null; form.querySelector('#s-img').value = ''; prev(); }
        });
        form.addEventListener('change', async (e) => {
          if (e.target.id === 's-img' && e.target.files[0]) { try { image = await readImage(e.target.files[0]); prev(); } catch (err) { UI.toast(err.message, 'danger'); } }
          if (e.target.name === 'categoryId') prev();
        });
      },
      onSave(v, form) {
        const readRows = (k) => qsa(`[data-rows="${k}"] [data-row]`, form).map((r) => ({ id: r.dataset.row, name: r.querySelector('[data-rn]').value.trim(), price: Number(r.querySelector('[data-rp]').value) }));
        const variants = readRows('variants'), options = readRows('options');
        const f = {};
        if (v.name.trim().length < 2) f.name = 'اكتب اسم الخدمة';
        if (!S.by(A.db().categories, v.categoryId)) f.categoryId = 'اختر فئة';
        const price = Number(v.price), min = Number(v.min), max = Number(v.max);
        if (!isFinite(price) || price < 0 || (price === 0 && !variants.length)) f.price = 'أدخل سعرًا أكبر من صفر';
        if (!(min > 0) || !(max >= min)) f.min = 'الحد الأدنى يجب أن يكون أكبر من صفر وأقل من أو يساوي الحد الأقصى';
        if (v.pricing !== 'per_sqm' && (!Number.isInteger(min) || !Number.isInteger(max))) f.min = 'استخدم أرقامًا صحيحة لهذه الطريقة';
        if (variants.some((x) => !x.name || !(x.price > 0))) f.variants = 'لكل نوع اسم وسعر أكبر من صفر';
        if (options.some((x) => !x.name || !(x.price >= 0) || !isFinite(x.price))) f.options = 'لكل إضافة اسم وسعر صحيح';
        if (Object.keys(f).length) throw A.fieldErr(f);
        const data = { name: v.name.trim(), categoryId: v.categoryId, short: v.short.trim(), desc: v.desc.trim(), pricing: v.pricing, price: variants.length ? variants[0].price : price, min, max, step: 0.5, variants, options, duration: v.duration.trim(), workflow: v.workflow, active: !!v.active, featured: !!v.featured, image };
        try {
          S.tx((d2) => {
            if (isNew) d2.services.push({ id: NQ.u.uid('svc'), createdAt: new Date().toISOString(), ...data });
            else Object.assign(S.by(d2.services, s.id), data, { updatedAt: new Date().toISOString() });
            S.log(d2, `${isNew ? 'إضافة' : 'تعديل'} خدمة ${data.name}`);
          });
        } catch (e) { throw new Error('تعذّر الحفظ — قد تكون الصورة كبيرة جدًا على مساحة المتصفح'); }
        UI.toast(isNew ? 'تمت إضافة الخدمة' : 'تم حفظ الخدمة — الحجوزات السابقة احتفظت بأسعارها');
      },
    });
  }

  // ---------- Categories ----------
  function categories() {
    const d = A.db();
    const rows = [...d.categories].sort((a, b) => (a.order || 0) - (b.order || 0));
    A.set(html`${A.ph('الفئات', 'إيقاف فئة يخفي كل خدماتها من الموقع دون المساس بالحجوزات السابقة.', html`<button class="btn btn-brand" data-new><i class="bi bi-plus-lg" aria-hidden="true"></i>فئة جديدة</button>`)}
      <section class="panel">${rows.length ? html`<div class="table-responsive"><table class="tbl stack"><thead><tr><th>الترتيب</th><th>الفئة</th><th>الخدمات</th><th>مفعّلة</th><th class="acts"><span class="visually-hidden">إجراءات</span></th></tr></thead><tbody>
        ${rows.map((c) => { const n = d.services.filter((s) => s.categoryId === c.id); return html`<tr><td data-label="الترتيب">${c.order || 0}</td><td data-label="الفئة">${c.name}<span class="sub">${c.desc}</span></td><td data-label="الخدمات">${n.length} (${n.filter((s) => s.active).length} مفعّلة)</td><td data-label="مفعّلة">${switchEl('data-active', c.id, c.active, 'تفعيل الفئة')}</td><td data-label="" class="acts"><button class="btn btn-sm btn-outline" data-edit="${c.id}">تعديل</button><button class="btn btn-sm btn-ghost text-danger" data-del="${c.id}" aria-label="حذف ${c.name}"><i class="bi bi-trash3" aria-hidden="true"></i></button></td></tr>`; })}
      </tbody></table></div>` : UI.empty('bi-tags', 'لا توجد فئات', '', html`<button class="btn btn-brand" data-new>إضافة فئة</button>`)}</section>`);
    const main = A.main();
    main.onchange = (e) => { const id = e.target.dataset.active; if (id) { S.tx((d2) => { const c = S.by(d2.categories, id); c.active = e.target.checked; S.log(d2, `${c.active ? 'تفعيل' : 'إيقاف'} فئة ${c.name}`); }); UI.toast('تم التحديث'); } };
    main.onclick = async (e) => {
      const ed = e.target.closest('[data-edit]');
      if (e.target.closest('[data-new]') || ed) {
        const c = ed ? S.by(A.db().categories, ed.dataset.edit) : null;
        return A.formModal({
          title: c ? 'تعديل الفئة' : 'فئة جديدة',
          body: html`<div class="mb-3"><label class="form-label" for="c-n">اسم الفئة<span class="req">*</span></label><input class="form-control" id="c-n" name="name" value="${c ? c.name : ''}"><div class="invalid-feedback" data-for="name"></div></div><div class="mb-3"><label class="form-label" for="c-d">الوصف</label><input class="form-control" id="c-d" name="desc" value="${c ? c.desc : ''}"></div><div class="row g-3"><div class="col-6"><label class="form-label" for="c-o">الترتيب</label><input class="form-control" type="number" id="c-o" name="order" value="${c ? c.order || 0 : A.db().categories.length + 1}"></div><div class="col-6"><label class="form-label" for="c-i">نوع الرسم</label><select class="form-select" id="c-i" name="icon">${[['sofa', 'كنب'], ['carpet', 'سجاد'], ['mattress', 'مراتب'], ['home', 'منزلي']].map(([k, l]) => html`<option value="${k}" ${c && c.icon === k ? 'selected' : ''}>${l}</option>`)}</select></div></div>`,
          onSave(v) {
            if (v.name.trim().length < 2) throw A.fieldErr({ name: 'اكتب اسم الفئة' });
            if (A.db().categories.some((x) => x.name === v.name.trim() && (!c || x.id !== c.id))) throw A.fieldErr({ name: 'يوجد فئة بنفس الاسم' });
            S.tx((d2) => {
              const data = { name: v.name.trim(), desc: v.desc.trim(), order: Number(v.order) || 0, icon: v.icon };
              if (c) Object.assign(S.by(d2.categories, c.id), data); else d2.categories.push({ id: NQ.u.uid('cat'), active: true, ...data });
            });
            UI.toast('تم حفظ الفئة');
          },
        });
      }
      const del = e.target.closest('[data-del]');
      if (del) {
        const c = S.by(A.db().categories, del.dataset.del);
        if (A.db().services.some((s) => s.categoryId === c.id)) return UI.toast('لا يمكن حذف فئة بها خدمات. انقل الخدمات أو أوقف الفئة.', 'warning');
        if (await UI.confirm({ title: 'حذف الفئة', message: `حذف "${c.name}"؟`, okText: 'حذف', danger: true })) { S.tx((d2) => { d2.categories = d2.categories.filter((x) => x.id !== c.id); }); UI.toast('تم الحذف', 'info'); }
      }
    };
  }

  // ---------- Schedule ----------
  function schedule() {
    const st = A.state.sched || (A.state.sched = { tab: 'day', date: todayStr() });
    const d = A.db();
    const tabs = [['day', 'جدول يوم'], ['workdays', 'أيام العمل'], ['slots', 'الفترات الزمنية'], ['blocks', 'أيام وفترات مغلقة']];
    const slots = SCH.sortedSlots(d);
    let body = '';
    if (st.tab === 'day') {
      const wd = NQ.u.weekday(st.date);
      body = html`<div class="d-flex gap-2 flex-wrap align-items-end mb-3"><button class="btn btn-outline btn-icon" data-day="-1" aria-label="اليوم السابق"><i class="bi bi-chevron-right" aria-hidden="true"></i></button><div><label class="form-label" for="sd-date">التاريخ</label><input type="date" class="form-control" id="sd-date" value="${st.date}"></div><button class="btn btn-outline btn-icon" data-day="1" aria-label="اليوم التالي"><i class="bi bi-chevron-left" aria-hidden="true"></i></button><button class="btn btn-ghost" data-day="0">اليوم</button></div>
        <h2 class="h5">${fmtDate(st.date)} ${d.workdays[wd] ? '' : html`<span class="nq-badge tone-secondary ms-2">يوم إجازة</span>`}</h2>
        <div class="daygrid mt-3">${slots.map((sl) => {
          const bk = SCH.bookingAt(d, st.date, sl.id);
          const block = d.blocks.find((b) => b.date === st.date && (!b.slotId || b.slotId === sl.id));
          const areas = d.areas.filter((a) => a.active && ((a.coverage[wd] || []).includes(sl.id)));
          const cls = bk ? 'booked' : block ? 'blocked' : !d.workdays[wd] ? 'dayoff' : '';
          return html`<div class="dayslot ${cls}"><div><b>${fmtTime(sl.start)} – ${fmtTime(sl.end)}</b>${sl.active ? '' : html`<span class="sub small text-muted d-block">الفترة موقوفة</span>`}</div>
            <div>${bk ? html`<a href="#/orders/${bk.id}"><b class="ltr">${bk.ref}</b> — ${bk.customer.name}</a><span class="d-block small text-muted">${bk.areaName} — ${bk.items.map((i) => i.name).join('، ')}</span>`
              : block ? html`<span>مغلق${block.reason ? ': ' + block.reason : ''}</span>`
              : !d.workdays[wd] ? html`<span class="text-muted">يوم إجازة — لا حجوزات جديدة</span>`
              : !sl.active ? html`<span class="text-muted">غير متاحة للحجز</span>`
              : areas.length ? html`<span>متاحة لـ: ${areas.map((a) => a.name).join('، ')}</span>` : html`<span class="text-muted">لا توجد منطقة مغطاة في هذه الفترة</span>`}</div>
            <div>${bk ? UI.statusBadge(bk.status) : block ? html`<button class="btn btn-sm btn-outline" data-unblock="${block.id}">فتح</button>` : d.workdays[wd] && sl.active ? html`<button class="btn btn-sm btn-ghost" data-quickblock="${sl.id}">إغلاق الفترة</button>` : ''}</div></div>`;
        })}</div>
        <div class="alert-soft info mt-3"><i class="bi bi-info-circle" aria-hidden="true"></i><span>تظهر الفترة للعميل فقط إذا كان اليوم يوم عمل، والفترة مفعّلة، وغير مغلقة، ومنطقة العميل مغطاة فيها، ولا يوجد حجز آخر في نفس الموعد لأي منطقة.</span></div>`;
    } else if (st.tab === 'workdays') {
      body = html`<p class="text-muted">الأيام المغلقة لا تُعرض فيها مواعيد لأي منطقة، حتى لو كانت ضمن تغطية المنطقة.</p>
        <div class="row g-2" style="max-width:640px">${DAY_NAMES.map((n, i) => html`<div class="col-sm-6"><div class="panel p-3 d-flex justify-content-between align-items-center"><label class="fw-semibold" for="wd-${i}">${n}</label><div class="form-check form-switch m-0"><input class="form-check-input" type="checkbox" role="switch" id="wd-${i}" data-wd="${i}" ${d.workdays[i] ? 'checked' : ''}></div></div></div>`)}</div>`;
    } else if (st.tab === 'slots') {
      const usedSlots = new Set(d.bookings.map((b) => b.slotId));
      body = html`<div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2"><p class="text-muted mb-0">الفترات العامة لكل الخدمات. تحدد كل منطقة أيًّا منها تغطيه من صفحة المناطق.</p><button class="btn btn-brand" data-new-slot><i class="bi bi-plus-lg" aria-hidden="true"></i>فترة جديدة</button></div>
        <div class="table-responsive"><table class="tbl stack"><thead><tr><th>الفترة</th><th>المدة</th><th>مفعّلة</th><th>الاستخدام</th><th class="acts"><span class="visually-hidden">إجراءات</span></th></tr></thead><tbody>
        ${slots.map((s) => { const [h1, m1] = s.start.split(':').map(Number), [h2, m2] = s.end.split(':').map(Number); return html`<tr><td data-label="الفترة"><b>${fmtTime(s.start)} – ${fmtTime(s.end)}</b></td><td data-label="المدة">${num((h2 * 60 + m2 - h1 * 60 - m1) / 60)} ساعة</td><td data-label="مفعّلة">${switchEl('data-slot-active', s.id, s.active, 'تفعيل الفترة')}</td><td data-label="الاستخدام">${d.bookings.filter((b) => b.slotId === s.id && SCH.occupying(b) && b.date >= todayStr()).length} حجز قادم</td><td data-label="" class="acts"><button class="btn btn-sm btn-outline" data-edit-slot="${s.id}">تعديل</button><button class="btn btn-sm btn-ghost text-danger" data-del-slot="${s.id}" ${usedSlots.has(s.id) ? raw('title="مستخدمة في حجوزات — أوقفها بدلًا من الحذف"') : ''} aria-label="حذف"><i class="bi bi-trash3" aria-hidden="true"></i></button></td></tr>`; })}
        </tbody></table></div>`;
    } else {
      const blocks = [...d.blocks].sort((a, b) => a.date.localeCompare(b.date));
      body = html`<form id="blk" class="row g-2 align-items-end mb-4" novalidate>
          <div class="col-sm-3"><label class="form-label" for="b-date">التاريخ<span class="req">*</span></label><input type="date" class="form-control" id="b-date" name="date" min="${todayStr()}"><div class="invalid-feedback" data-for="date"></div></div>
          <div class="col-sm-3"><label class="form-label" for="b-slot">الفترة</label><select class="form-select" id="b-slot" name="slotId"><option value="">اليوم كله</option>${slots.map((s) => html`<option value="${s.id}">${fmtTime(s.start)} – ${fmtTime(s.end)}</option>`)}</select></div>
          <div class="col-sm-4"><label class="form-label" for="b-r">السبب</label><input class="form-control" id="b-r" name="reason" placeholder="عطلة رسمية، صيانة…"></div>
          <div class="col-sm-2"><button class="btn btn-brand w-100" type="submit">إغلاق</button></div></form>
        ${blocks.length ? html`<ul class="mini-list panel">${blocks.map((b) => { const s = S.by(d.slots, b.slotId); return html`<li><span>${fmtDate(b.date)} — ${s ? `${fmtTime(s.start)} – ${fmtTime(s.end)}` : 'اليوم كله'}<span class="sub">${b.reason || 'بدون سبب'}${b.date < todayStr() ? ' — منقضي' : ''}</span></span><button class="btn btn-sm btn-outline" data-unblock="${b.id}">إلغاء الإغلاق</button></li>`; })}</ul>` : UI.empty('bi-calendar-check', 'لا توجد أيام أو فترات مغلقة', 'أغلق يومًا أو فترة لمنع الحجز فيها.')}`;
    }
    A.set(html`${A.ph('أيام العمل والفترات', 'إعدادات عامة لكل الخدمات. أي تغيير يؤثر على الحجوزات الجديدة فقط ويُنبهك إلى الحجوزات القائمة المتأثرة.')}
      <ul class="nav nav-tabs mb-3" role="tablist">${tabs.map(([k, l]) => html`<li class="nav-item" role="presentation"><button class="nav-link ${st.tab === k ? 'active' : ''}" role="tab" aria-selected="${st.tab === k}" data-tab="${k}">${l}</button></li>`)}</ul>
      <section class="panel panel-pad">${body}</section>`);
    const main = A.main();
    main.onclick = async (e) => {
      const t = e.target.closest('[data-tab]'); if (t) { st.tab = t.dataset.tab; return A.rerender(); }
      const dd = e.target.closest('[data-day]'); if (dd) { st.date = dd.dataset.day === '0' ? todayStr() : addDays(st.date, Number(dd.dataset.day)); return A.rerender(); }
      const ub = e.target.closest('[data-unblock]'); if (ub) { S.tx((d2) => { d2.blocks = d2.blocks.filter((b) => b.id !== ub.dataset.unblock); S.log(d2, 'إلغاء إغلاق موعد'); }); return UI.toast('أصبح الموعد متاحًا مرة أخرى'); }
      const qb = e.target.closest('[data-quickblock]'); if (qb) return A.applySchedule((d2) => d2.blocks.push({ id: NQ.u.uid('blk'), date: st.date, slotId: qb.dataset.quickblock, reason: '' }), 'تم إغلاق الفترة');
      if (e.target.closest('[data-new-slot]')) return slotModal(null);
      const es = e.target.closest('[data-edit-slot]'); if (es) return slotModal(S.by(A.db().slots, es.dataset.editSlot));
      const ds = e.target.closest('[data-del-slot]');
      if (ds) {
        const sid = ds.dataset.delSlot;
        if (A.db().bookings.some((b) => b.slotId === sid)) return UI.toast('هذه الفترة مستخدمة في حجوزات مسجلة. أوقفها بدلًا من حذفها.', 'warning');
        if (await UI.confirm({ title: 'حذف الفترة', message: 'حذف هذه الفترة وإزالتها من تغطية كل المناطق؟', okText: 'حذف', danger: true })) A.applySchedule((d2) => { d2.slots = d2.slots.filter((s) => s.id !== sid); d2.areas.forEach((a) => Object.keys(a.coverage).forEach((k) => { a.coverage[k] = a.coverage[k].filter((x) => x !== sid); })); d2.blocks = d2.blocks.filter((b) => b.slotId !== sid); }, 'تم حذف الفترة');
      }
    };
    main.onchange = async (e) => {
      if (e.target.id === 'sd-date' && e.target.value) { st.date = e.target.value; return A.rerender(); }
      if (e.target.dataset.wd != null) { const i = e.target.dataset.wd, on = e.target.checked; const ok = await A.applySchedule((d2) => { d2.workdays[i] = on; }, `${on ? 'تفعيل' : 'إغلاق'} يوم ${DAY_NAMES[i]}`); if (!ok) A.rerender(); }
      if (e.target.dataset.slotActive) { const id = e.target.dataset.slotActive, on = e.target.checked; const ok = await A.applySchedule((d2) => { S.by(d2.slots, id).active = on; }, on ? 'تم تفعيل الفترة' : 'تم إيقاف الفترة'); if (!ok) A.rerender(); }
    };
    main.onsubmit = (e) => {
      if (e.target.id !== 'blk') return;
      e.preventDefault();
      const v = NQ.u.formData(e.target);
      if (!NQ.u.isValidDate(v.date) || v.date < todayStr()) return UI.showFieldErrors(e.target, { date: 'اختر تاريخًا من اليوم فصاعدًا' });
      if (A.db().blocks.some((b) => b.date === v.date && (!b.slotId || b.slotId === v.slotId))) return UI.showFieldErrors(e.target, { date: 'هذا الموعد مغلق بالفعل' });
      A.applySchedule((d2) => d2.blocks.push({ id: NQ.u.uid('blk'), date: v.date, slotId: v.slotId || null, reason: v.reason.trim() }), 'تم إغلاق الموعد');
    };
  }

  function slotModal(s) {
    A.formModal({
      title: s ? 'تعديل الفترة' : 'فترة جديدة', size: 'sm',
      body: html`<div class="row g-3"><div class="col-6"><label class="form-label" for="sl-s">من</label><input type="time" class="form-control" id="sl-s" name="start" value="${s ? s.start : '09:00'}" required><div class="invalid-feedback" data-for="start"></div></div><div class="col-6"><label class="form-label" for="sl-e">إلى</label><input type="time" class="form-control" id="sl-e" name="end" value="${s ? s.end : '11:00'}" required></div></div>${s ? html`<p class="small text-muted mt-3 mb-0">الحجوزات القائمة تحتفظ بوقت الفترة الأصلي المسجل فيها.</p>` : ''}`,
      async onSave(v) {
        if (!/^\d{2}:\d{2}$/.test(v.start) || !/^\d{2}:\d{2}$/.test(v.end) || v.start >= v.end) throw A.fieldErr({ start: 'وقت البداية يجب أن يكون قبل وقت النهاية' });
        const overlap = A.db().slots.find((x) => x.active && (!s || x.id !== s.id) && v.start < x.end && x.start < v.end);
        if (overlap) throw A.fieldErr({ start: `تتداخل مع فترة ${fmtTime(overlap.start)} – ${fmtTime(overlap.end)}` });
        const ok = await A.applySchedule((d2) => { if (s) Object.assign(S.by(d2.slots, s.id), { start: v.start, end: v.end }); else d2.slots.push({ id: NQ.u.uid('slot'), start: v.start, end: v.end, active: true }); }, s ? 'تم تعديل الفترة' : 'تمت إضافة الفترة — فعّلها في تغطية المناطق');
        return ok;
      },
    });
  }

  // ---------- Areas ----------
  function areas() {
    const d = A.db();
    const slots = SCH.sortedSlots(d).filter((s) => s.active);
    const covTable = (a) => html`<div class="table-responsive"><table class="cov"><thead><tr><th>اليوم</th>${slots.map((s) => html`<th>${fmtTime(s.start)}</th>`)}</tr></thead><tbody>${DAY_NAMES.map((n, i) => html`<tr><th scope="row">${n}</th>${slots.map((s) => d.workdays[i] ? html`<td>${(a.coverage[i] || []).includes(s.id) ? html`<i class="bi bi-check-lg text-success" aria-label="مغطاة"></i>` : html`<span class="text-muted" aria-label="غير مغطاة">—</span>`}</td>` : html`<td class="off" aria-label="يوم إجازة"></td>`)}</tr>`)}</tbody></table></div>`;
    A.set(html`${A.ph('المناطق والتغطية', 'لكل منطقة رسوم انتقال وجدول أسبوعي ثابت يحدد الأيام والفترات المتاحة للعملاء فيها.', html`<button class="btn btn-brand" data-new><i class="bi bi-plus-lg" aria-hidden="true"></i>منطقة جديدة</button>`)}
      <div class="alert-soft info mb-3"><i class="bi bi-diagram-3" aria-hidden="true"></i><span>الفترات وأيام العمل عامة (من صفحة أيام العمل والفترات). التغطية هنا تختار منها ما يناسب كل منطقة. الفترة الواحدة تُحجز لعميل واحد فقط مهما كانت المنطقة.</span></div>
      <div class="grid-2e">${d.areas.map((a) => html`<section class="panel area-card"><div class="card-h"><div><h2>${a.name}</h2><span class="small text-muted">${a.notes || ''}</span></div><div class="d-flex gap-2 align-items-center">${a.active ? html`<span class="nq-badge tone-success">مفعّلة</span>` : html`<span class="nq-badge tone-secondary">موقوفة</span>`}<button class="btn btn-sm btn-outline" data-edit="${a.id}">تعديل</button><button class="btn btn-sm btn-ghost text-danger" data-del="${a.id}" aria-label="حذف ${a.name}"><i class="bi bi-trash3" aria-hidden="true"></i></button></div></div>
        <div class="card-b"><p class="mb-2">رسوم الانتقال: <b>${money(a.fee)}</b> — ${d.bookings.filter((b) => b.areaId === a.id && SCH.occupying(b) && b.date >= todayStr()).length} حجز قادم</p>${covTable(a)}</div></section>`)}</div>`);
    const main = A.main();
    main.onclick = async (e) => {
      const ed = e.target.closest('[data-edit]');
      if (ed || e.target.closest('[data-new]')) return areaModal(ed ? S.by(A.db().areas, ed.dataset.edit) : null);
      const del = e.target.closest('[data-del]');
      if (del) {
        const a = S.by(A.db().areas, del.dataset.del);
        if (A.db().bookings.some((b) => b.areaId === a.id)) return UI.toast('المنطقة مرتبطة بحجوزات مسجلة. أوقفها بدلًا من حذفها.', 'warning');
        if (await UI.confirm({ title: 'حذف المنطقة', message: `حذف "${a.name}"؟`, okText: 'حذف', danger: true })) { S.tx((d2) => { d2.areas = d2.areas.filter((x) => x.id !== a.id); S.log(d2, `حذف منطقة ${a.name}`); }); UI.toast('تم الحذف', 'info'); }
      }
    };
  }

  function areaModal(a) {
    const d = A.db();
    const slots = SCH.sortedSlots(d).filter((s) => s.active);
    const cov = a ? a.coverage : {};
    A.formModal({
      title: a ? `تعديل: ${a.name}` : 'منطقة جديدة', size: 'lg',
      body: html`<div class="row g-3">
        <div class="col-md-5"><label class="form-label" for="a-n">اسم المنطقة<span class="req">*</span></label><input class="form-control" id="a-n" name="name" value="${a ? a.name : ''}"><div class="invalid-feedback" data-for="name"></div></div>
        <div class="col-md-3"><label class="form-label" for="a-f">رسوم الانتقال (ج.م)</label><input class="form-control" id="a-f" name="fee" type="number" min="0" step="5" value="${a ? a.fee : 50}"><div class="invalid-feedback" data-for="fee"></div></div>
        <div class="col-md-4 d-flex align-items-end"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" role="switch" id="a-act" name="active" ${!a || a.active ? 'checked' : ''}><label class="form-check-label" for="a-act">متاحة للحجز</label></div></div>
        <div class="col-12"><label class="form-label" for="a-notes">ملاحظات</label><input class="form-control" id="a-notes" name="notes" value="${a ? a.notes : ''}"></div>
        <div class="col-12"><p class="form-label">التغطية الأسبوعية</p><div class="table-responsive"><table class="cov"><thead><tr><th>اليوم</th>${slots.map((s) => html`<th>${fmtTime(s.start)}<br><span class="fw-normal">${fmtTime(s.end)}</span></th>`)}</tr></thead><tbody>${DAY_NAMES.map((n, i) => html`<tr><th scope="row">${n}${d.workdays[i] ? '' : html`<br><span class="fw-normal small">إجازة</span>`}</th>${slots.map((s) => html`<td class="${d.workdays[i] ? '' : 'off'}"><input class="form-check-input" type="checkbox" data-cov="${i}|${s.id}" ${(cov[i] || []).includes(s.id) ? 'checked' : ''} aria-label="${n} ${fmtTime(s.start)}"></td>`)}</tr>`)}</tbody></table></div><p class="form-text">الأيام المظللة إجازة عامة: يمكن تحديدها مسبقًا لكنها لن تظهر للعملاء حتى يُفعّل اليوم.</p></div>
      </div>`,
      async onSave(v, form) {
        const f = {};
        if (v.name.trim().length < 2) f.name = 'اكتب اسم المنطقة';
        if (A.db().areas.some((x) => x.name === v.name.trim() && (!a || x.id !== a.id))) f.name = 'يوجد منطقة بنفس الاسم';
        const fee = Number(v.fee); if (!isFinite(fee) || fee < 0) f.fee = 'أدخل رسومًا صحيحة';
        if (Object.keys(f).length) throw A.fieldErr(f);
        const coverage = {};
        qsa('[data-cov]', form).forEach((cb) => { if (cb.checked) { const [day, sid] = cb.dataset.cov.split('|'); (coverage[day] = coverage[day] || []).push(sid); } });
        // keep coverage for inactive slots that are not shown in the matrix
        if (a) Object.entries(a.coverage).forEach(([day, ids]) => ids.forEach((sid) => { const sl = S.by(A.db().slots, sid); if (sl && !sl.active) (coverage[day] = coverage[day] || []).push(sid); }));
        const data = { name: v.name.trim(), fee: NQ.u.round2(fee), active: !!v.active, notes: v.notes.trim(), coverage };
        return A.applySchedule((d2) => { if (a) Object.assign(S.by(d2.areas, a.id), data); else d2.areas.push({ id: NQ.u.uid('area'), ...data }); }, a ? `تم حفظ منطقة ${data.name}${a.fee !== data.fee ? ' — الرسوم الجديدة للحجوزات الجديدة فقط' : ''}` : 'تمت إضافة المنطقة');
      },
    });
  }

  // ---------- Settings ----------
  function settings() {
    const d = A.db();
    const st = d.settings;
    const issues = FIN.diagnostics(d);
    let bytes = 0; try { bytes = (localStorage.getItem(S.KEY) || '').length * 2; } catch (e) {}
    A.set(html`${A.ph('الإعدادات والبيانات', 'بيانات النشاط، وبيانات الدخول التجريبية، وأدوات العرض.')}
      <div class="grid-2e">
        <form class="panel" id="set-f" novalidate><div class="card-h"><h2>بيانات النشاط</h2></div><div class="card-b row g-3">
          <div class="col-sm-6"><label class="form-label" for="st-phone">رقم الهاتف</label><input class="form-control" id="st-phone" name="phone" dir="ltr" value="${st.phone}"><div class="invalid-feedback" data-for="phone"></div></div>
          <div class="col-sm-6"><label class="form-label" for="st-wa">واتساب (بالصيغة الدولية)</label><input class="form-control" id="st-wa" name="whatsapp" dir="ltr" value="${st.whatsapp}"><div class="invalid-feedback" data-for="whatsapp"></div></div>
          <div class="col-12"><label class="form-label" for="st-addr">العنوان</label><input class="form-control" id="st-addr" name="address" value="${st.address}"></div>
          <div class="col-12"><label class="form-label" for="st-map">رابط الخريطة</label><input class="form-control" id="st-map" name="mapUrl" dir="ltr" value="${st.mapUrl}"><div class="invalid-feedback" data-for="mapUrl"></div></div>
          <div class="col-sm-6"><label class="form-label" for="st-hz">أقصى مدة للحجز المسبق (يوم)</label><input class="form-control" id="st-hz" name="bookingHorizonDays" type="number" min="7" max="120" value="${st.bookingHorizonDays}"><div class="invalid-feedback" data-for="bookingHorizonDays"></div></div>
          <div class="col-12"><hr class="my-1"><p class="small text-muted mb-0">بيانات دخول العرض التجريبي (ليست حماية حقيقية)</p></div>
          <div class="col-sm-6"><label class="form-label" for="st-u">اسم المستخدم</label><input class="form-control" id="st-u" name="adminUser" dir="ltr" value="${st.adminUser}"><div class="invalid-feedback" data-for="adminUser"></div></div>
          <div class="col-sm-6"><label class="form-label" for="st-p">كلمة المرور</label><input class="form-control" id="st-p" name="adminPass" dir="ltr" value="${st.adminPass}"><div class="invalid-feedback" data-for="adminPass"></div></div>
          <div class="col-12"><button class="btn btn-brand" type="submit">حفظ الإعدادات</button></div>
        </div></form>
        <div class="d-grid gap-3 align-content-start">
          <section class="panel"><div class="card-h"><h2>فحص اتساق البيانات</h2><span class="nq-badge ${issues.some((i) => i.level === 'danger') ? 'tone-danger' : issues.length ? 'tone-warning' : 'tone-success'}">${issues.length ? `${issues.length} ملاحظة` : 'سليمة'}</span></div><div class="card-b">
            ${issues.length ? html`<ul class="list-unstyled mb-0 d-grid gap-2">${issues.map((i) => html`<li class="alert-soft ${i.level === 'danger' ? 'err' : 'warn'}"><i class="bi ${i.level === 'danger' ? 'bi-x-octagon' : 'bi-exclamation-triangle'}" aria-hidden="true"></i><span>${i.text}</span></li>`)}</ul>` : html`<div class="alert-soft ok"><i class="bi bi-check2-circle" aria-hidden="true"></i><span>المدفوعات تطابق الحجوزات، والإجماليات صحيحة، ولا يوجد حجزان في نفس الموعد.</span></div>`}
            <p class="small text-muted mt-3 mb-0">${d.bookings.length} حجز — ${d.payments.length} عملية مالية — ${d.expenses.length} مصروف — ${d.customers.length} عميل — حجم البيانات ${num(bytes / 1024)} ك.ب — إصدار المخطط ${d.version}</p>
          </div></section>
          <section class="panel"><div class="card-h"><h2>بيانات العرض التجريبي</h2></div><div class="card-b">
            <p class="text-muted">كل البيانات محفوظة في هذا المتصفح فقط (LocalStorage). الموقع العام ولوحة التحكم يقرآن نفس البيانات.</p>
            <div class="d-flex gap-2 flex-wrap"><button class="btn btn-outline" data-export><i class="bi bi-download" aria-hidden="true"></i>تنزيل نسخة JSON</button><button class="btn btn-soft-danger" data-reset><i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>استعادة البيانات التجريبية</button></div>
          </div></section>
        </div>
      </div>`);
    const main = A.main();
    main.onsubmit = (e) => {
      e.preventDefault();
      const v = NQ.u.formData(e.target); const f = {};
      if (!NQ.u.validPhone(v.phone)) f.phone = 'رقم موبايل مصري غير صحيح';
      if (!/^20\d{10}$/.test(v.whatsapp.trim())) f.whatsapp = 'اكتب الرقم بالصيغة الدولية بدون + مثل 201012345678';
      if (v.mapUrl && !/^https?:\/\//.test(v.mapUrl.trim())) f.mapUrl = 'الرابط يجب أن يبدأ بـ https://';
      const hz = Number(v.bookingHorizonDays); if (!(hz >= 7 && hz <= 120)) f.bookingHorizonDays = 'من 7 إلى 120 يومًا';
      if (v.adminUser.trim().length < 3) f.adminUser = '3 أحرف على الأقل';
      if (v.adminPass.length < 6) f.adminPass = '6 أحرف على الأقل';
      if (Object.keys(f).length) return UI.showFieldErrors(e.target, f);
      S.tx((d2) => { Object.assign(d2.settings, { phone: NQ.u.normPhone(v.phone), whatsapp: v.whatsapp.trim(), address: v.address.trim(), mapUrl: v.mapUrl.trim(), bookingHorizonDays: hz, adminUser: v.adminUser.trim(), adminPass: v.adminPass }); S.log(d2, 'تعديل إعدادات النشاط'); });
      UI.toast('تم حفظ الإعدادات');
    };
    main.onclick = async (e) => {
      if (e.target.closest('[data-export]')) {
        const blob = new Blob([JSON.stringify(A.db(), null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `naqaa-demo-${todayStr()}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        UI.toast('تم تنزيل نسخة البيانات');
      }
      if (e.target.closest('[data-reset]')) {
        const ok = await UI.confirm({ title: 'استعادة البيانات التجريبية', message: 'سيتم حذف كل ما أضفته (حجوزات، مدفوعات، مصروفات، تعديلات الخدمات والمواعيد) وإرجاع بيانات العرض الأصلية.', detail: 'لا يمكن التراجع عن هذه الخطوة. سلة الحجز في الموقع ستُفرغ أيضًا.', okText: 'حذف البيانات واستعادة العرض', danger: true });
        if (ok) { S.reset(); A.state.ranges = {}; UI.toast('تمت استعادة البيانات التجريبية'); A.go('/dashboard'); }
      }
    };
  }

  A.route(/^\/services$/, 'services', services, 'الخدمات');
  A.route(/^\/categories$/, 'categories', categories, 'الفئات');
  A.route(/^\/schedule$/, 'schedule', schedule, 'أيام العمل والفترات');
  A.route(/^\/areas$/, 'areas', areas, 'المناطق والتغطية');
  A.route(/^\/settings$/, 'settings', settings, 'الإعدادات والبيانات');
})(window.NQ = window.NQ || {});
