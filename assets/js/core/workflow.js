/* Naqaa demo — order status workflow (separate from payment status).
 * Workflow is derived from the booking's services:
 *   onsite  (sofa, mattress, in-home):  pending → confirmed → completed
 *   pickup  (carpets, curtains):        pending → confirmed → received → completed
 * A booking containing ANY pickup item follows the pickup workflow, because the
 * order can only be completed after the picked-up items are processed and returned.
 */
(function (NQ) {
  'use strict';
  const STATUS = {
    pending:   { label: 'في انتظار التأكيد', tone: 'warning', icon: 'bi-hourglass-split' },
    confirmed: { label: 'تم التأكيد',        tone: 'info',    icon: 'bi-calendar-check' },
    received:  { label: 'تم الاستلام',        tone: 'primary', icon: 'bi-box-seam' },
    completed: { label: 'مكتمل',             tone: 'success', icon: 'bi-check2-circle' },
    canceled:  { label: 'ملغي',              tone: 'danger',  icon: 'bi-x-circle' },
  };
  const FLOW = {
    onsite: ['pending', 'confirmed', 'completed'],
    pickup: ['pending', 'confirmed', 'received', 'completed'],
  };
  const TRANSITIONS = {
    onsite: { pending: ['confirmed', 'canceled'], confirmed: ['completed', 'canceled'], completed: [], canceled: [] },
    pickup: { pending: ['confirmed', 'canceled'], confirmed: ['received', 'canceled'], received: ['completed'], completed: [], canceled: [] },
  };
  const ACTION_LABEL = { confirmed: 'تأكيد الحجز', received: 'تسجيل استلام القطع', completed: 'تمييز كمكتمل', canceled: 'إلغاء الحجز' };
  const WORKFLOW_LABEL = { onsite: 'خدمة في موقع العميل', pickup: 'استلام وتسليم' };

  const allowed = (b) => ((TRANSITIONS[b.workflow] || TRANSITIONS.onsite)[b.status]) || [];

  function transition(db, bookingId, to, note, by) {
    const b = NQ.store.by(db.bookings, bookingId);
    if (!b) throw new Error('الحجز غير موجود');
    if (!allowed(b).includes(to)) throw new Error(`لا يمكن الانتقال من "${STATUS[b.status].label}" إلى "${STATUS[to] ? STATUS[to].label : to}"`);
    b.status = to;
    b.history.push({ status: to, at: new Date().toISOString(), by: by || 'الإدارة', note: note || '' });
    b.updatedAt = new Date().toISOString();
    NQ.store.log(db, `${ACTION_LABEL[to]} — ${b.ref}`, { bookingId: b.id });
    return b;
  }

  NQ.workflow = { STATUS, FLOW, TRANSITIONS, ACTION_LABEL, WORKFLOW_LABEL, allowed, transition };
})(window.NQ = window.NQ || {});
