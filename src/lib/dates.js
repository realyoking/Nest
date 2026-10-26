// Hong Kong time helpers.
const HK = 8 * 3600e3;
export const hkDayKey = (d = new Date()) => new Date(d.getTime() + HK).toISOString().slice(0, 10);
export function toLocalInput(d) {
  if (!d) return '';
  return new Date(d.getTime() + HK).toISOString().slice(0, 16);
}
export function fromLocalInput(v) {
  if (!v) return null;
  // value is HK wall time "YYYY-MM-DDTHH:mm"
  const [date, time = '09:00'] = v.split('T');
  return new Date(`${date}T${time}:00+08:00`);
}
export function dueLabel(d, t, fmtDate) {
  if (!d) return '';
  const today = hkDayKey(); const day = hkDayKey(d);
  const tomorrow = hkDayKey(new Date(Date.now() + 864e5));
  const time = fmtDate(d, { hour: 'numeric', minute: '2-digit' });
  if (d < new Date()) return `${t('common.overdue')} · ${fmtDate(d)}`;
  if (day === today) return `${t('common.today')} ${time}`;
  if (day === tomorrow) return `${t('common.tomorrow')} ${time}`;
  return fmtDate(d, { month: 'short', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' });
}
