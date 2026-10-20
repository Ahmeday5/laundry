/* Naqaa demo — pricing. The ONLY place line and booking totals are computed. */
(function (NQ) {
  'use strict';
  const { round2 } = NQ.u;

  const PRICING = {
    fixed:    { name: 'سعر ثابت للخدمة', unit: 'للخدمة',        qtyLabel: 'العدد',            qtyUnit: 'خدمة' },
    per_seat: { name: 'بالمقعد',          unit: 'للمقعد',        qtyLabel: 'عدد المقاعد',      qtyUnit: 'مقعد' },
    per_sqm:  { name: 'بالمتر المربع',    unit: 'للمتر المربع',  qtyLabel: 'المساحة (م²)',     qtyUnit: 'م²' },
    per_item: { name: 'بالقطعة',          unit: 'للقطعة',        qtyLabel: 'عدد القطع',        qtyUnit: 'قطعة' },
  };
  const limits = (s) => ({
    min: Number(s.min) > 0 ? Number(s.min) : 1,
    max: Number(s.max) > 0 ? Number(s.max) : (s.pricing === 'per_sqm' ? 200 : 50),
    step: s.pricing === 'per_sqm' ? (Number(s.step) > 0 ? Number(s.step) : 0.5) : 1,
  });

  /** Quote one line from the CURRENT service configuration. */
  function quoteLine(service, sel) {
    const errors = [];
    if (!service) return { ok: false, errors: ['الخدمة لم تعد متاحة'] };
    if (!service.active) errors.push(`خدمة "${service.name}" غير متاحة حاليًا للحجز`);
    const lim = limits(service);
    const qty = round2(Number(sel.qty));
    if (!isFinite(qty) || qty <= 0) errors.push('الكمية غير صحيحة');
    else if (qty < lim.min) errors.push(`الحد الأدنى لخدمة "${service.name}" هو ${lim.min} ${PRICING[service.pricing].qtyUnit}`);
    else if (qty > lim.max) errors.push(`الحد الأقصى لخدمة "${service.name}" هو ${lim.max} ${PRICING[service.pricing].qtyUnit}`);
    else if (service.pricing !== 'per_sqm' && !Number.isInteger(qty)) errors.push('الكمية يجب أن تكون رقمًا صحيحًا');

    let unitPrice = Number(service.price);
    let variant = null;
    const variants = service.variants || [];
    if (variants.length) {
      variant = variants.find((v) => v.id === sel.variantId) || null;
      if (!variant) errors.push(`اختر نوعًا لخدمة "${service.name}"`);
      else unitPrice = Number(variant.price);
    }
    const chosen = (service.options || []).filter((o) => (sel.optionIds || []).includes(o.id));
    const optionsUnit = chosen.reduce((s, o) => s + Number(o.price), 0);
    const lineTotal = round2((unitPrice + optionsUnit) * (qty || 0));
    return {
      ok: errors.length === 0, errors, qty, unitPrice, optionsUnit, lineTotal,
      variant, options: chosen,
      // Snapshot stored inside the booking so later price edits never rewrite history.
      snapshot: {
        serviceId: service.id, name: service.name, categoryId: service.categoryId,
        pricing: service.pricing, unit: PRICING[service.pricing].qtyUnit,
        unitPrice, variantName: variant ? variant.name : null,
        options: chosen.map((o) => ({ name: o.name, price: Number(o.price) })),
        qty, lineTotal, workflow: service.workflow === 'pickup' ? 'pickup' : 'onsite',
      },
    };
  }

  /** Quote a whole cart for an area; recalculated server-style before any booking is saved. */
  function quoteCart(db, cartItems, areaId) {
    const errors = [];
    const lines = (cartItems || []).map((ci) => {
      const svc = NQ.store.by(db.services, ci.serviceId);
      const q = quoteLine(svc, ci);
      errors.push(...q.errors);
      return { cartKey: ci.key, service: svc, ...q };
    });
    if (!lines.length) errors.push('سلة الحجز فارغة');
    const subtotal = round2(lines.reduce((s, l) => s + (l.lineTotal || 0), 0));
    const area = areaId ? NQ.store.by(db.areas, areaId) : null;
    if (areaId && (!area || !area.active)) errors.push('منطقة الخدمة المختارة غير متاحة');
    const fee = area ? round2(area.fee) : 0;
    const workflow = lines.some((l) => l.snapshot && l.snapshot.workflow === 'pickup') ? 'pickup' : 'onsite';
    return { ok: errors.length === 0, errors, lines, subtotal, fee, total: round2(subtotal + fee), area, workflow };
  }

  const priceText = (s) => {
    if (s.variants && s.variants.length) {
      const min = Math.min(...s.variants.map((v) => Number(v.price)));
      return `يبدأ من ${NQ.u.money(min)} ${PRICING[s.pricing].unit}`;
    }
    return `${NQ.u.money(s.price)} ${PRICING[s.pricing].unit}`;
  };

  NQ.pricing = { PRICING, limits, quoteLine, quoteCart, priceText };
})(window.NQ = window.NQ || {});
