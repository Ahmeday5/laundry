/* Naqaa demo — seed data. Built relative to TODAY so the demo always has
 * past, current and upcoming activity. All business data is illustrative demo data. */
(function (NQ) {
  'use strict';

  const defaultSettings = () => ({
    businessName: 'نقاء', tagline: 'عناية منزلية بالمفروشات والسجاد',
    phone: '01000000000', whatsapp: '201000000000', email: 'hello@naqaa-demo.example',
    address: 'مقر تجريبي — 6 أكتوبر، الجيزة', mapUrl: 'https://maps.google.com/?q=30.0131,30.9772',
    bookingHorizonDays: 45, nextRef: 1001,
    adminUser: 'admin', adminPass: 'demo1234', // demo-only credentials, not real authentication
  });
  // 0=Sun … 6=Sat. Friday off.
  const defaultWorkdays = () => ({ 0: true, 1: true, 2: true, 3: true, 4: true, 5: false, 6: true });

  function build() {
    const u = NQ.u;
    const now = new Date().toISOString();
    const db = {
      version: 1, createdAt: now,
      settings: defaultSettings(),
      workdays: defaultWorkdays(),
      categories: [
        { id: 'cat_sofa', name: 'تنظيف الكنب والأنتريهات', desc: 'تنظيف بالبخار والشفط في بيتك بدون نقل القطع', icon: 'sofa', active: true, order: 1 },
        { id: 'cat_carpet', name: 'غسيل السجاد', desc: 'استلام من البيت، غسيل في المغسلة، وتسليم خلال أيام', icon: 'carpet', active: true, order: 2 },
        { id: 'cat_mattress', name: 'تنظيف وتعقيم المراتب', desc: 'إزالة الأتربة والعتة والبقع وتعقيم بالبخار', icon: 'mattress', active: true, order: 3 },
        { id: 'cat_home', name: 'خدمات منزلية إضافية', desc: 'ستائر، كراسي سفرة، وتعقيم شامل', icon: 'home', active: true, order: 4 },
      ],
      services: [
        { id: 'svc_sofa', categoryId: 'cat_sofa', name: 'تنظيف كنب بالبخار', short: 'تنظيف عميق للكنب والأنتريه في مكانه', desc: 'نبدأ بشفط الأتربة، ثم معالجة البقع حسب نوع القماش، ثم غسيل بالبخار وشفط المياه. القماش يجف خلال 4 إلى 6 ساعات حسب التهوية.', pricing: 'per_seat', price: 120, min: 3, max: 30, variants: [], options: [{ id: 'o_scent', name: 'تعطير بعد التنظيف', price: 10 }, { id: 'o_sanit', name: 'تعقيم ضد البكتيريا', price: 20 }], duration: 'حوالي 20 دقيقة لكل مقعد', workflow: 'onsite', active: true, featured: true, image: null },
        { id: 'svc_corner', categoryId: 'cat_sofa', name: 'تنظيف ركنة كاملة', short: 'سعر ثابت للركنة حتى 7 مقاعد', desc: 'مناسبة للركن على شكل L أو U. السعر يشمل الوسائد المنفصلة ومعالجة البقع الظاهرة.', pricing: 'fixed', price: 650, min: 1, max: 5, variants: [], options: [{ id: 'o_scent2', name: 'تعطير بعد التنظيف', price: 40 }], duration: '2 إلى 3 ساعات', workflow: 'onsite', active: true, featured: false, image: null },
        { id: 'svc_carpet', categoryId: 'cat_carpet', name: 'غسيل سجاد صناعي ويدوي', short: 'يُحسب بالمتر المربع مع الاستلام والتسليم', desc: 'نستلم السجاد من بيتك، ونغسله في المغسلة بماكينات الدوران والشطف، ثم يُجفف ويُغلف ويعود إليك. المدة المعتادة من 3 إلى 5 أيام عمل.', pricing: 'per_sqm', price: 40, min: 4, max: 120, step: 0.5, variants: [], options: [{ id: 'o_stain', name: 'معالجة بقع صعبة', price: 8 }, { id: 'o_wrap', name: 'تغليف للتخزين', price: 5 }], duration: '3 إلى 5 أيام عمل', workflow: 'pickup', active: true, featured: true, image: null },
        { id: 'svc_shaggy', categoryId: 'cat_carpet', name: 'غسيل سجاد شاجي وشعر طويل', short: 'عناية خاصة بالوبر الطويل', desc: 'غسيل يدوي بمنظفات مناسبة للوبر الطويل وتمشيط قبل التجفيف حتى يحتفظ السجاد بملمسه.', pricing: 'per_sqm', price: 55, min: 3, max: 60, step: 0.5, variants: [], options: [{ id: 'o_stain2', name: 'معالجة بقع صعبة', price: 10 }], duration: '4 إلى 6 أيام عمل', workflow: 'pickup', active: true, featured: false, image: null },
        { id: 'svc_mattress', categoryId: 'cat_mattress', name: 'تنظيف وتعقيم مرتبة', short: 'شفط عميق وبخار ومعالجة بقع', desc: 'نزيل الأتربة والعتة بجهاز شفط مخصص، ونعالج البقع، ثم نعقم بالبخار. تُستخدم المرتبة بعد 4 ساعات تقريبًا.', pricing: 'per_item', price: 220, min: 1, max: 10, variants: [{ id: 'v_single', name: 'مرتبة فردي', price: 220 }, { id: 'v_double', name: 'مرتبة مزدوج', price: 320 }], options: [{ id: 'o_both', name: 'تنظيف الوجهين', price: 80 }], duration: '30 إلى 45 دقيقة لكل مرتبة', workflow: 'onsite', active: true, featured: true, image: null },
        { id: 'svc_curtain', categoryId: 'cat_home', name: 'غسيل ستائر', short: 'فك وتركيب وغسيل في المغسلة', desc: 'نفك الستائر ونستلمها، ونغسلها حسب نوع القماش ونكويها، ثم نعيد تركيبها في الزيارة التالية.', pricing: 'per_item', price: 90, min: 2, max: 40, variants: [], options: [{ id: 'o_iron', name: 'كي بالبخار', price: 25 }], duration: '3 إلى 4 أيام عمل', workflow: 'pickup', active: true, featured: false, image: null },
        { id: 'svc_chairs', categoryId: 'cat_home', name: 'تنظيف كراسي سفرة', short: 'للكراسي المنجدة بالقماش', desc: 'تنظيف بالبخار للمقعد والظهر المنجد مع معالجة البقع.', pricing: 'per_item', price: 60, min: 4, max: 24, variants: [], options: [], duration: '10 دقائق لكل كرسي', workflow: 'onsite', active: true, featured: false, image: null },
        { id: 'svc_sanitize', categoryId: 'cat_home', name: 'تعقيم وتعطير شقة', short: 'رذاذ تعقيم آمن لكل الغرف', desc: 'تعقيم الأسطح والمفروشات برذاذ آمن على الأطفال والحيوانات الأليفة بعد التهوية. سعر ثابت للشقة حتى 200 م².', pricing: 'fixed', price: 450, min: 1, max: 1, variants: [], options: [], duration: 'ساعة إلى ساعتين', workflow: 'onsite', active: false, featured: false, image: null },
      ],
      slots: [
        { id: 'slot_a', start: '09:00', end: '11:00', active: true },
        { id: 'slot_b', start: '11:30', end: '13:30', active: true },
        { id: 'slot_c', start: '15:00', end: '17:00', active: true },
        { id: 'slot_d', start: '17:30', end: '19:30', active: true },
      ],
      areas: [
        { id: 'area_hadayek', name: 'حدائق أكتوبر', fee: 50, active: true, notes: 'الزيارات صباحية', coverage: { 0: ['slot_a', 'slot_b'], 2: ['slot_a', 'slot_b'], 4: ['slot_a'] } },
        { id: 'area_zayed', name: 'الشيخ زايد', fee: 70, active: true, notes: 'الزيارات مسائية', coverage: { 0: ['slot_c', 'slot_d'], 3: ['slot_c', 'slot_d'], 6: ['slot_b', 'slot_c'] } },
        { id: 'area_october', name: '6 أكتوبر', fee: 40, active: true, notes: 'أقرب منطقة للمغسلة', coverage: { 1: ['slot_a', 'slot_b', 'slot_c', 'slot_d'], 4: ['slot_b', 'slot_c'], 6: ['slot_a'] } },
        { id: 'area_motamayez', name: 'الحي المتميز', fee: 50, active: true, notes: '', coverage: { 2: ['slot_c', 'slot_d'], 3: ['slot_a'] } },
        { id: 'area_mohandessin', name: 'المهندسين', fee: 120, active: false, notes: 'متوقفة مؤقتًا', coverage: { 1: ['slot_d'] } },
      ],
      blocks: [], customers: [], bookings: [], payments: [], expenses: [], activity: [],
    };

    // ---------- Generate bookings that respect the schedule ----------
    const taken = new Set();
    const t = u.todayStr();
    function findSlot(areaId, offset, future) {
      for (let i = 0; i < 21; i++) {
        const d = u.addDays(t, future ? offset + i : offset - i);
        if (future && d <= t) continue;
        const area = db.areas.find((a) => a.id === areaId);
        const wd = u.weekday(d);
        if (!db.workdays[wd]) continue;
        const slots = (area.coverage[wd] || []);
        const s = slots.find((id) => !taken.has(d + id));
        if (s) { taken.add(d + s); return { date: d, slotId: s }; }
      }
      throw new Error('seed: no slot');
    }
    const custs = [
      ['منى عبد الحميد', '01012345671'], ['أحمد سامي', '01123456782'], ['ريهام فؤاد', '01234567893'],
      ['محمد الشريف', '01512345674'], ['هبة مصطفى', '01098765435'], ['كريم عادل', '01187654326'],
      ['سارة يوسف', '01276543217'], ['عمرو ناجي', '01065432108'],
    ];
    const iso = (date, h) => new Date(u.parseDate(date).getTime() + h * 36e5).toISOString();
    const plan = [
      // past
      { c: 0, a: 'area_hadayek', off: -38, items: [['svc_sofa', 7, null, ['o_scent']]], path: ['confirmed', 'completed'], pays: [['full', 'cash', 0]] },
      { c: 1, a: 'area_zayed', off: -31, items: [['svc_carpet', 12, null, ['o_stain']], ['svc_shaggy', 6]], path: ['confirmed', 'received', 'completed'], pays: [[0.4, 'instapay', -1], ['rest', 'cash', 4]] },
      { c: 2, a: 'area_october', off: -24, items: [['svc_mattress', 2, 'v_double', ['o_both']]], path: ['confirmed', 'completed'], pays: [['full', 'transfer', 0]] },
      { c: 3, a: 'area_motamayez', off: -19, items: [['svc_corner', 1, null, []], ['svc_chairs', 6]], path: ['confirmed', 'completed'], pays: [[0.5, 'cash', 0]] },
      { c: 4, a: 'area_hadayek', off: -15, items: [['svc_carpet', 8]], path: ['canceled'], pays: [[100, 'instapay', -2], ['refund', 'instapay', 1]], cancelNote: 'العميل سافر وطلب الإلغاء' },
      { c: 0, a: 'area_october', off: -11, items: [['svc_curtain', 6, null, ['o_iron']]], path: ['confirmed', 'received', 'completed'], pays: [['full', 'cash', 3]] },
      { c: 5, a: 'area_zayed', off: -8, items: [['svc_sofa', 5]], path: ['confirmed', 'completed'], pays: [] },
      { c: 6, a: 'area_october', off: -5, items: [['svc_carpet', 15.5, null, ['o_wrap']]], path: ['confirmed', 'received'], pays: [[200, 'transfer', 0]] },
      { c: 7, a: 'area_hadayek', off: -3, items: [['svc_sofa', 4]], path: ['canceled'], pays: [], cancelNote: 'لم يتم الرد على التأكيد' },
      { c: 2, a: 'area_zayed', off: -2, items: [['svc_mattress', 1, 'v_single', []], ['svc_sofa', 3, null, ['o_sanit']]], path: ['confirmed', 'completed'], pays: [['full', 'instapay', 0]] },
      // upcoming
      { c: 1, a: 'area_october', off: 1, items: [['svc_sofa', 8, null, ['o_scent', 'o_sanit']]], path: ['confirmed'], pays: [[300, 'instapay', 'today']], note: 'الكنب لونه بيج فاتح' },
      { c: 3, a: 'area_zayed', off: 2, items: [['svc_carpet', 9]], path: [], pays: [] },
      { c: 6, a: 'area_hadayek', off: 3, items: [['svc_mattress', 3, 'v_single', []]], path: [], pays: [], note: 'يفضّل الاتصال قبل الوصول بنصف ساعة' },
      { c: 4, a: 'area_motamayez', off: 4, items: [['svc_corner', 1, null, ['o_scent2']]], path: ['confirmed'], pays: [] },
      { c: 5, a: 'area_october', off: 6, items: [['svc_carpet', 20, null, ['o_stain']], ['svc_sofa', 4]], path: [], pays: [] },
    ];
    plan.forEach((p, idx) => {
      const [name, phone] = custs[p.c];
      let cust = db.customers.find((c) => c.phone === phone);
      if (!cust) { cust = { id: 'cus_seed' + p.c, name, phone, createdAt: iso(u.addDays(t, -45 + p.c), 10) }; db.customers.push(cust); }
      const area = db.areas.find((a) => a.id === p.a);
      const where = findSlot(p.a, p.off, p.off > 0);
      const slot = db.slots.find((s) => s.id === where.slotId);
      const items = p.items.map(([sid, qty, variantId, optionIds]) => NQ.pricing.quoteLine(db.services.find((s) => s.id === sid), { qty, variantId, optionIds: optionIds || [] }).snapshot);
      const subtotal = u.round2(items.reduce((s, i) => s + i.lineTotal, 0));
      const created = iso(u.addDays(where.date, p.off > 0 ? -Math.min(3, p.off) : -3), 11);
      const b = {
        id: 'bk_seed' + idx, ref: `NQ-${db.settings.nextRef++}`, token: u.trackingToken(), idemKey: null,
        customerId: cust.id, customer: { name, phone }, areaId: area.id, areaName: area.name,
        address: ['شارع 12، عمارة 4، الدور الثالث، شقة 9', 'كمبوند الندى، فيلا 22', 'الحي السابع، مجاورة 3، عمارة 115، شقة 6', 'شارع الياسمين، عمارة 7، الدور الأول'][idx % 4],
        landmark: ['بجوار مسجد الرحمن', 'أمام البوابة 2', 'خلف مول المصريين', ''][idx % 4], mapLink: idx % 3 === 0 ? 'https://maps.google.com/?q=30.0131,30.9772' : '',
        date: where.date, slotId: slot.id, slotLabel: `${u.fmtTime(slot.start)} – ${u.fmtTime(slot.end)}`,
        notes: p.note || '', items, subtotal, fee: area.fee, total: u.round2(subtotal + area.fee),
        workflow: items.some((i) => i.workflow === 'pickup') ? 'pickup' : 'onsite', status: 'pending',
        history: [{ status: 'pending', at: created, by: 'العميل', note: 'حجز من الموقع' }],
        internalNotes: [], source: 'website', createdAt: created, updatedAt: created,
      };
      p.path.forEach((st, k) => {
        const at = st === 'confirmed' ? iso(b.createdAt.slice(0, 10), 15) : iso(where.date, 12 + k + (st === 'completed' && b.workflow === 'pickup' ? 96 : 0));
        b.status = st;
        b.history.push({ status: st, at: new Date(Math.min(Date.now(), new Date(at).getTime())).toISOString(), by: 'الإدارة', note: st === 'canceled' ? (p.cancelNote || '') : '' });
      });
      if (idx === 1) b.internalNotes.push({ id: 'n1', text: 'سجادة الشاجي فيها بقعة قهوة قديمة، تم إبلاغ العميل أنها قد لا تزول بالكامل.', at: iso(where.date, 13), by: 'الإدارة' });
      db.bookings.push(b);
      let paidSoFar = 0;
      p.pays.forEach(([amt, method, dOff], k) => {
        const date = dOff === 'today' ? t : u.addDays(where.date, dOff);
        const safeDate = date > t ? t : date;
        let amount, kind = 'payment';
        if (amt === 'full') amount = b.total;
        else if (amt === 'rest') amount = u.round2(b.total - paidSoFar);
        else if (amt === 'refund') { amount = paidSoFar; kind = 'refund'; }
        else amount = amt < 1 ? u.round2(Math.round(b.total * amt / 10) * 10) : amt;
        paidSoFar += kind === 'refund' ? -amount : amount;
        db.payments.push({ id: `pay_seed${idx}_${k}`, bookingId: b.id, kind, amount, method, date: safeDate, notes: kind === 'refund' ? 'استرداد العربون بعد الإلغاء' : (k === 0 && p.pays.length > 1 ? 'عربون' : ''), by: 'الإدارة', createdAt: iso(safeDate, 14), updatedAt: iso(safeDate, 14) });
      });
    });

    const exp = [
      [-40, 'supplies', 'شامبو سجاد ومزيل بقع (جملة)', 750], [-36, 'transport', 'بنزين سيارة النقل', 350], [-30, 'labor', 'مكافأة فني مساعد', 700],
      [-27, 'marketing', 'إعلانات ممولة على فيسبوك', 600], [-22, 'maintenance', 'صيانة ماكينة البخار', 450], [-18, 'packaging', 'رولات تغليف سجاد', 220],
      [-14, 'transport', 'بنزين سيارة النقل', 350], [-9, 'labor', 'مكافأة فني مساعد', 700], [-6, 'supplies', 'معطرات ومواد تعقيم', 300],
      [-2, 'transport', 'بنزين سيارة النقل', 350], [0, 'other', 'أدوات مكتبية وطباعة إيصالات', 160],
    ];
    exp.forEach(([off, category, desc, amount], i) => {
      const date = u.addDays(t, off);
      db.expenses.push({ id: 'exp_seed' + i, desc, category, amount, date, notes: '', createdAt: iso(date, 18), updatedAt: iso(date, 18) });
    });
    db.activity.push({ at: now, text: 'تم تحميل البيانات التجريبية' });
    return db;
  }

  NQ.seed = { build, defaultSettings, defaultWorkdays };
})(window.NQ = window.NQ || {});
