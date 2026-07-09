/** Free-text clock label → sortable 24h 'HH:MM'. '6:30 PM' → '18:30', '18:30' →
 *  '18:30'. Null when the label doesn't carry a time ('Tonight', '', garbage) —
 *  callers must treat null as "unknown", not as midnight.
 *
 *  Lives apart from games.controller so the backfill script can reuse it without
 *  importing every route handler. */
export function parseTimeLabel(label?: string | null): string | null {
  if (!label) return null;
  const m = label.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? 0);
  const suffix = m[3]?.toUpperCase();
  if (minute > 59) return null;
  if (suffix) {
    // 12-hour clock: hours must be 1–12, and 12 AM/PM are the two special cases.
    if (hour < 1 || hour > 12) return null;
    if (suffix === 'PM' && hour < 12) hour += 12;
    if (suffix === 'AM' && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
