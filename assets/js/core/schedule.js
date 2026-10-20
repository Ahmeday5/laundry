/* Naqaa demo — scheduling & availability.
 * Business rule: ONE booking per date + time slot for the whole business
 * (independent of area, service or value). Canceled bookings release the slot.
 * Every screen (customer checkout, admin manual booking, admin calendar) uses slotStatus().
 */
(function (NQ) {
  'use strict';
  const { todayStr, weekday, nowHHMM, addDays } = NQ.u;

  const REASONS = {
    available: 'متاح',
    slot_inactive: 'الفترة موقوفة',
    past: 'وقت منقضٍ',
    dayoff: 'يوم إجازة',
    blocked: 'مغلق بقرار إداري',
    area_inactive: 'المنطقة غير مفعّلة',
    not_covered: 'المنطقة لا تُخدم في هذه الفترة',
    booked: 'محجوز',
    no_area: 'اختر المنطقة أولًا',
  };

  const sortedSlots = (db) => [...db.slots].sort((a, b) => a.start.localeCompare(b.start));
  const occupying = (b) => b.status !== 'canceled';
  const bookingAt = (db, date, slotId, excludeId) =>
    db.bookings.find((b) => occupying(b) && b.date === date && b.slotId === slotId && b.id !== excludeId) || null;
  const blockFor = (db, date, slotId) =>
    db.blocks.find((bl) => bl.date === date && (!bl.slotId || bl.slotId === slotId)) || null;

  /**
   * @param opts.excludeBookingId ignore this booking when checking occupancy (re-validation)
   * @param opts.skipPast        do not reject past times (used for conflict analysis)
   */
  function slotStatus(db, date, slotId, areaId, opts) {
    opts = opts || {};
    const slot = NQ.store.by(db.slots, slotId);
    const res = (code, extra) => ({ code, available: code === 'available', reason: REASONS[code], slot, ...(extra || {}) });
    if (!slot || !slot.active) return res('slot_inactive');
    if (!opts.skipPast) {
      const t = todayStr();
      if (date < t || (date === t && slot.start <= nowHHMM())) return res('past');
    }
    const wd = weekday(date);
    if (!db.workdays[wd]) return res('dayoff');
    const block = blockFor(db, date, slotId);
    if (block) return res('blocked', { block });
    if (!areaId) return res('no_area');
    const area = NQ.store.by(db.areas, areaId);
    if (!area || !area.active) return res('area_inactive');
    if (!((area.coverage && area.coverage[wd]) || []).includes(slotId)) return res('not_covered');
    const booking = bookingAt(db, date, slotId, opts.excludeBookingId);
    if (booking) return res('booked', { booking });
    return res('available');
  }

  const slotsForDate = (db, date, areaId, opts) => sortedSlots(db).filter((s) => s.active).map((s) => slotStatus(db, date, s.id, areaId, opts));

  function availableDates(db, areaId, horizon) {
    const days = horizon || Number(db.settings.bookingHorizonDays) || 45;
    const out = [];
    const t = todayStr();
    for (let i = 0; i <= days; i++) {
      const d = addDays(t, i);
      const free = slotsForDate(db, d, areaId).filter((s) => s.available);
      if (free.length) out.push({ date: d, free: free.length });
    }
    return out;
  }

  function nextAvailable(db, areaId, count) {
    const out = [];
    for (const d of availableDates(db, areaId)) {
      for (const s of slotsForDate(db, d.date, areaId)) {
        if (s.available) out.push({ date: d.date, slot: s.slot });
        if (out.length >= count) return out;
      }
    }
    return out;
  }

  /** Future, still-active bookings whose date/slot would NOT be offered under the given settings. */
  function outOfScheduleBookings(db) {
    const t = todayStr();
    return db.bookings.filter((b) => ['pending', 'confirmed'].includes(b.status) && b.date >= t).map((b) => {
      const st = slotStatus(db, b.date, b.slotId, b.areaId, { excludeBookingId: b.id, skipPast: true });
      return st.available ? null : { booking: b, reason: st.reason };
    }).filter(Boolean);
  }

  /** Compare two DB states: which bookings become newly affected by a schedule edit. */
  function newlyAffected(before, after) {
    const prev = new Set(outOfScheduleBookings(before).map((x) => x.booking.id));
    return outOfScheduleBookings(after).filter((x) => !prev.has(x.booking.id));
  }

  NQ.schedule = { REASONS, sortedSlots, slotStatus, slotsForDate, availableDates, nextAvailable, bookingAt, outOfScheduleBookings, newlyAffected, occupying };
})(window.NQ = window.NQ || {});
