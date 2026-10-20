/* Naqaa demo — financial calculations. Every card, table, chart and report uses these.
 * Definitions (all filtered by a date range):
 *  - Order value:   totals of NON-canceled bookings whose appointment date is in range.
 *  - Collections:   payments recorded (by payment date) in range, minus refunds recorded in range.
 *  - Outstanding:   unpaid part of non-canceled bookings whose appointment date is in range.
 *  - Expenses:      expense records dated in range.
 *  - Estimated net operating cash surplus = Collections − Expenses (an estimate, not accounting profit).
 * Payment status is never stored; it is derived from payment records.
 * Cancellation policy: payments stay on record; any amount already paid shows as
 * "refund due" until the admin records a refund transaction (negative cash flow).
 */
(function (NQ) {
  'use strict';
  const { round2, inRange, todayStr, addDays, parseDate, dateStr } = NQ.u;

  const PAY_STATUS = {
    unpaid:     { label: 'غير مدفوع',      tone: 'danger' },
    partial:    { label: 'مدفوع جزئيًا',    tone: 'warning' },
    paid:       { label: 'مدفوع بالكامل',   tone: 'success' },
    refund_due: { label: 'مستحق استرداد',   tone: 'danger' },
    settled:    { label: 'لا يوجد مستحقات', tone: 'secondary' },
  };
  const METHODS = { cash: 'نقدي', transfer: 'تحويل بنكي', instapay: 'إنستاباي', other: 'أخرى' };
  const EXPENSE_CATS = { transport: 'انتقالات', supplies: 'خامات ومواد تنظيف', labor: 'عمالة', packaging: 'تغليف', marketing: 'تسويق', maintenance: 'صيانة', other: 'أخرى' };

  const paymentsOf = (db, bookingId) => db.payments.filter((p) => p.bookingId === bookingId).sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt));
  const netPaid = (db, bookingId, excludeId) => round2(db.payments.reduce((s, p) => (p.bookingId === bookingId && p.id !== excludeId ? s + (p.kind === 'refund' ? -p.amount : p.amount) : s), 0));

  function bookingFinance(db, b) {
    const paid = netPaid(db, b.id);
    if (b.status === 'canceled') {
      return { total: b.total, paid, outstanding: 0, refundDue: Math.max(0, paid), status: paid > 0 ? 'refund_due' : 'settled' };
    }
    const outstanding = round2(Math.max(0, b.total - paid));
    const status = paid <= 0 ? 'unpaid' : outstanding > 0 ? 'partial' : 'paid';
    return { total: b.total, paid, outstanding, refundDue: 0, status };
  }

  /** Validate a payment/refund before saving. Returns error string or null. */
  function validatePayment(db, { bookingId, amount, kind, excludeId }) {
    const b = NQ.store.by(db.bookings, bookingId);
    if (!b) return 'الحجز غير موجود';
    const amt = round2(Number(amount));
    if (!isFinite(amt) || amt <= 0) return 'أدخل مبلغًا أكبر من صفر';
    const paid = netPaid(db, bookingId, excludeId);
    if (kind === 'refund') {
      if (amt > paid) return `مبلغ الاسترداد أكبر من صافي المدفوع (${NQ.u.money(paid)})`;
      return null;
    }
    if (b.status === 'canceled') return 'لا يمكن تسجيل دفعة على حجز ملغي؛ سجّل استردادًا عند الحاجة';
    const remaining = round2(b.total - paid);
    if (amt > remaining) return `المبلغ أكبر من المتبقي على الحجز (${NQ.u.money(remaining)})`;
    return null;
  }

  // ---------- Date ranges ----------
  const PRESETS = { today: 'اليوم', last7: 'آخر 7 أيام', last30: 'آخر 30 يومًا', month: 'هذا الشهر', all: 'كل الفترات', custom: 'فترة مخصصة' };
  function rangeFor(preset, from, to) {
    const t = todayStr();
    switch (preset) {
      case 'today': return { from: t, to: t };
      case 'last7': return { from: addDays(t, -6), to: t };
      case 'last30': return { from: addDays(t, -29), to: t };
      case 'month': { const d = parseDate(t); const first = dateStr(new Date(d.getFullYear(), d.getMonth(), 1)); const last = dateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0)); return { from: first, to: last }; }
      case 'custom': return { from: from || null, to: to || null };
      default: return { from: null, to: null };
    }
  }

  function summary(db, range) {
    const { from, to } = range || {};
    const inR = (d) => inRange(d, from, to);
    const bookings = db.bookings.filter((b) => inR(b.date));
    const eligible = bookings.filter((b) => b.status !== 'canceled');
    const counts = { total: bookings.length, pending: 0, confirmed: 0, received: 0, completed: 0, canceled: 0 };
    bookings.forEach((b) => { counts[b.status] = (counts[b.status] || 0) + 1; });
    const pays = db.payments.filter((p) => inR(p.date));
    const gross = round2(pays.filter((p) => p.kind === 'payment').reduce((s, p) => s + p.amount, 0));
    const refunds = round2(pays.filter((p) => p.kind === 'refund').reduce((s, p) => s + p.amount, 0));
    const expenses = round2(db.expenses.filter((e) => inR(e.date)).reduce((s, e) => s + e.amount, 0));
    const orderValue = round2(eligible.reduce((s, b) => s + b.total, 0));
    const transportFees = round2(eligible.reduce((s, b) => s + b.fee, 0));
    const outstanding = round2(eligible.reduce((s, b) => s + bookingFinance(db, b).outstanding, 0));
    const collections = round2(gross - refunds);
    const refundDue = round2(db.bookings.filter((b) => b.status === 'canceled' && inR(b.date)).reduce((s, b) => s + bookingFinance(db, b).refundDue, 0));
    return { counts, orderValue, transportFees, serviceValue: round2(orderValue - transportFees), gross, refunds, collections, outstanding, expenses, surplus: round2(collections - expenses), refundDue, eligible, bookings };
  }

  // ---------- Series & breakdowns ----------
  function buckets(db, range) {
    let { from, to } = range || {};
    if (!from || !to) {
      const dates = [...db.bookings.map((b) => b.date), ...db.payments.map((p) => p.date), ...db.expenses.map((e) => e.date)].sort();
      from = from || dates[0] || todayStr();
      to = to || dates[dates.length - 1] || todayStr();
    }
    const days = Math.round((parseDate(to) - parseDate(from)) / 864e5) + 1;
    if (days <= 62) {
      const out = []; for (let i = 0; i < days; i++) { const d = addDays(from, i); out.push({ key: d, from: d, to: d, label: NQ.u.fmtShortDate(d) }); } return out;
    }
    const out = []; let d = parseDate(from); d = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = parseDate(to);
    while (d <= end) {
      const f = dateStr(d); const l = dateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      out.push({ key: f.slice(0, 7), from: f, to: l, label: NQ.u.fmtDate(f, { month: 'short', year: '2-digit' }) });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
    return out;
  }

  function series(db, range) {
    const bs = buckets(db, range);
    return bs.map((bk) => {
      const r = { from: bk.from, to: bk.to };
      const s = summary(db, r);
      return { label: bk.label, orders: s.eligible.length, orderValue: s.orderValue, collections: s.collections, expenses: s.expenses };
    });
  }

  function breakdowns(db, range) {
    const s = summary(db, range);
    const byService = {}, byArea = {}, byMethod = {}, byExpense = {};
    s.eligible.forEach((b) => {
      b.items.forEach((it) => { byService[it.name] = round2((byService[it.name] || 0) + it.lineTotal); });
      byArea[b.areaName] = round2((byArea[b.areaName] || 0) + b.total);
    });
    db.payments.filter((p) => inRange(p.date, range && range.from, range && range.to)).forEach((p) => {
      const k = METHODS[p.method] || METHODS.other;
      byMethod[k] = round2((byMethod[k] || 0) + (p.kind === 'refund' ? -p.amount : p.amount));
    });
    db.expenses.filter((e) => inRange(e.date, range && range.from, range && range.to)).forEach((e) => {
      const k = EXPENSE_CATS[e.category] || EXPENSE_CATS.other;
      byExpense[k] = round2((byExpense[k] || 0) + e.amount);
    });
    const toArr = (o) => Object.entries(o).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    return { summary: s, byService: toArr(byService), byArea: toArr(byArea), byMethod: toArr(byMethod), byExpense: toArr(byExpense) };
  }

  /** Data-integrity checks shown in Settings → diagnostics. */
  function diagnostics(db) {
    const issues = [];
    const bIds = new Set(db.bookings.map((b) => b.id));
    db.payments.forEach((p) => { if (!bIds.has(p.bookingId)) issues.push({ level: 'danger', text: `دفعة بمبلغ ${NQ.u.money(p.amount)} مرتبطة بحجز غير موجود` }); });
    const seen = {};
    db.bookings.forEach((b) => {
      const sub = round2(b.items.reduce((s, i) => s + i.lineTotal, 0));
      if (sub !== round2(b.subtotal)) issues.push({ level: 'danger', text: `${b.ref}: مجموع البنود (${sub}) لا يطابق الإجمالي الفرعي (${b.subtotal})` });
      if (round2(b.subtotal + b.fee) !== round2(b.total)) issues.push({ level: 'danger', text: `${b.ref}: الإجمالي لا يساوي الإجمالي الفرعي + رسوم الانتقال` });
      const paid = netPaid(db, b.id);
      if (paid > b.total) issues.push({ level: 'danger', text: `${b.ref}: المدفوع (${paid}) أكبر من قيمة الحجز (${b.total})` });
      if (paid < 0) issues.push({ level: 'danger', text: `${b.ref}: صافي المدفوع سالب` });
      if (b.status === 'canceled' && paid > 0) issues.push({ level: 'warning', text: `${b.ref}: حجز ملغي وعليه ${NQ.u.money(paid)} مستحقة للعميل — سجّل الاسترداد بعد ردّ المبلغ` });
      if (!NQ.store.by(db.customers, b.customerId)) issues.push({ level: 'warning', text: `${b.ref}: لا يوجد سجل عميل مرتبط` });
      if (NQ.schedule.occupying(b)) {
        const k = b.date + '|' + b.slotId;
        if (seen[k]) issues.push({ level: 'danger', text: `${b.ref} و ${seen[k]}: حجزان في نفس الموعد` });
        seen[k] = b.ref;
      }
    });
    NQ.schedule.outOfScheduleBookings(db).forEach((x) => issues.push({ level: 'warning', text: `${x.booking.ref}: موعد قادم خارج الجدول الحالي (${x.reason}) — تواصل مع العميل` }));
    return issues;
  }

  NQ.finance = { PAY_STATUS, METHODS, EXPENSE_CATS, PRESETS, paymentsOf, netPaid, bookingFinance, validatePayment, rangeFor, summary, series, breakdowns, diagnostics };
})(window.NQ = window.NQ || {});
