/* Naqaa demo — booking creation, rescheduling, customers.
 * createBooking() is used by BOTH the public checkout and the admin manual-booking form.
 * It never trusts totals from the page: it re-quotes from the current service configuration,
 * re-checks slot availability immediately before saving, and is idempotent per idemKey.
 */
(function (NQ) {
  'use strict';
  const { normPhone, validPhone, isValidDate, uid, trackingToken } = NQ.u;

  class ValidationError extends Error {
    constructor(fields, message) { super(message || 'تحقق من البيانات المطلوبة'); this.fields = fields || {}; }
  }

  const validMap = (s) => !s || /^https?:\/\/\S+$/i.test(s) || /^-?\d{1,2}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?$/.test(s);

  function validateContact(input) {
    const f = {};
    const name = String(input.name || '').trim();
    if (name.length < 3) f.name = 'اكتب الاسم بالكامل (3 أحرف على الأقل)';
    if (!validPhone(input.phone)) f.phone = 'رقم الموبايل غير صحيح — مثال: 01012345678';
    if (!input.areaId) f.areaId = 'اختر منطقة الخدمة';
    if (String(input.address || '').trim().length < 8) f.address = 'اكتب العنوان بالتفصيل (الشارع، رقم العمارة، الدور، الشقة)';
    if (!validMap(String(input.mapLink || '').trim())) f.mapLink = 'ضع رابطًا يبدأ بـ https:// أو إحداثيات مثل 30.0444, 31.2357';
    if (!isValidDate(input.date)) f.date = 'اختر تاريخ الزيارة';
    if (!input.slotId) f.slotId = 'اختر موعدًا متاحًا';
    if (String(input.notes || '').length > 500) f.notes = 'الملاحظات أطول من 500 حرف';
    return f;
  }

  function upsertCustomer(db, name, phone) {
    const p = normPhone(phone);
    let c = db.customers.find((x) => x.phone === p);
    if (!c) {
      c = { id: uid('cus'), name: name.trim(), phone: p, createdAt: new Date().toISOString() };
      db.customers.push(c);
    } else if (name && name.trim() && c.name !== name.trim()) {
      c.name = name.trim(); // keep the most recent spelling the customer used
    }
    return c;
  }

  function nextRef(db) {
    const n = Number(db.settings.nextRef) || 1001;
    db.settings.nextRef = n + 1;
    return `NQ-${n}`;
  }

  /** Must be called inside NQ.store.tx(). Returns the saved booking. */
  function createBooking(db, input, opts) {
    opts = opts || {};
    if (input.idemKey) {
      const dup = db.bookings.find((b) => b.idemKey === input.idemKey);
      if (dup) return dup; // repeated click / resubmission → same booking
    }
    const fields = validateContact(input);
    const quote = NQ.pricing.quoteCart(db, input.items, input.areaId);
    if (!quote.ok) fields.items = quote.errors.join(' — ');
    if (Object.keys(fields).length) throw new ValidationError(fields);

    // Final availability check right before saving (global one-booking-per-slot rule).
    const st = NQ.schedule.slotStatus(db, input.date, input.slotId, input.areaId);
    if (!st.available) {
      throw new ValidationError({ slotId: st.code === 'booked' ? 'هذا الموعد حُجز للتو — اختر موعدًا آخر' : `هذا الموعد غير متاح: ${st.reason}` });
    }

    const customer = upsertCustomer(db, input.name, input.phone);
    const now = new Date().toISOString();
    const booking = {
      id: uid('bk'), ref: nextRef(db), token: trackingToken(), idemKey: input.idemKey || null,
      customerId: customer.id,
      customer: { name: String(input.name).trim(), phone: normPhone(input.phone) },
      areaId: quote.area.id, areaName: quote.area.name,
      address: String(input.address).trim(), landmark: String(input.landmark || '').trim(), mapLink: String(input.mapLink || '').trim(),
      date: input.date, slotId: input.slotId, slotLabel: `${NQ.u.fmtTime(st.slot.start)} – ${NQ.u.fmtTime(st.slot.end)}`,
      notes: String(input.notes || '').trim(),
      items: quote.lines.map((l) => l.snapshot),
      subtotal: quote.subtotal, fee: quote.fee, total: quote.total,
      workflow: quote.workflow, status: 'pending',
      history: [{ status: 'pending', at: now, by: opts.by || 'العميل', note: opts.source === 'admin' ? 'حجز أُنشئ من لوحة التحكم' : 'حجز من الموقع' }],
      internalNotes: [], source: opts.source || 'website', createdAt: now, updatedAt: now,
    };
    db.bookings.push(booking);
    NQ.store.log(db, `حجز جديد ${booking.ref} — ${booking.customer.name} (${booking.areaName})`, { bookingId: booking.id });
    return booking;
  }

  /** Explicit admin decision to move a booking to a new valid date/slot. */
  function reschedule(db, bookingId, date, slotId, note) {
    const b = NQ.store.by(db.bookings, bookingId);
    if (!b) throw new Error('الحجز غير موجود');
    if (!['pending', 'confirmed'].includes(b.status)) throw new Error('يمكن تعديل موعد الحجوزات قيد التأكيد أو المؤكدة فقط');
    const st = NQ.schedule.slotStatus(db, date, slotId, b.areaId, { excludeBookingId: b.id });
    if (!st.available) throw new Error(`الموعد الجديد غير متاح: ${st.reason}`);
    const old = `${NQ.u.fmtDate(b.date)} ${b.slotLabel}`;
    b.date = date; b.slotId = slotId; b.slotLabel = `${NQ.u.fmtTime(st.slot.start)} – ${NQ.u.fmtTime(st.slot.end)}`;
    b.history.push({ status: b.status, at: new Date().toISOString(), by: 'الإدارة', note: `تغيير الموعد من ${old} إلى ${NQ.u.fmtDate(date)} ${b.slotLabel}${note ? ' — ' + note : ''}` });
    b.updatedAt = new Date().toISOString();
    NQ.store.log(db, `تعديل موعد ${b.ref}`, { bookingId: b.id });
    return b;
  }

  const findByToken = (db, token) => db.bookings.find((b) => b.token === String(token || '').trim().toLowerCase()) || null;
  const findByRefPhone = (db, ref, last4) => {
    const l4 = String(last4 || '').trim();
    if (!/^\d{4}$/.test(l4)) return null;
    const r = String(ref || '').trim().toUpperCase().replace(/^(\d)/, 'NQ-$1');
    return db.bookings.find((b) => b.ref === r && b.customer.phone.endsWith(l4)) || null;
  };

  function customerStats(db, customerId) {
    const bookings = db.bookings.filter((b) => b.customerId === customerId).sort((a, b) => b.date.localeCompare(a.date));
    let value = 0, paid = 0, outstanding = 0;
    bookings.forEach((b) => { const f = NQ.finance.bookingFinance(db, b); if (b.status !== 'canceled') { value += b.total; outstanding += f.outstanding; } paid += f.paid; });
    return { bookings, value: NQ.u.round2(value), paid: NQ.u.round2(paid), outstanding: NQ.u.round2(outstanding) };
  }

  NQ.bookings = { ValidationError, validateContact, createBooking, reschedule, findByToken, findByRefPhone, customerStats, upsertCustomer };
})(window.NQ = window.NQ || {});
