type Value = string | null | undefined;

export const UNAVAILABLE_VALUE = '—';
const NBSP = '\u00a0';

function parseDecimal(value: Value) {
  if (typeof value !== 'string') return null;
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  // $ also matches before a final newline; the entire input must be decimal.
  if (!match || match[0] !== value) return null;
  const integer = match[2].replace(/^0+(?=\d)/, '');
  const fraction = match[3] ?? '';
  const sign = match[1] && /[1-9]/.test(integer + fraction) ? '-' : '';
  return { integer, fraction, sign };
}

export function formatMoney(value: Value): string {
  const decimal = parseDecimal(value);
  if (!decimal || decimal.fraction.length > 2) return UNAVAILABLE_VALUE;
  const { integer, fraction, sign } = decimal;
  const groups: string[] = [];
  for (let end = integer.length; end > 0; end -= 3) {
    groups.push(integer.slice(Math.max(0, end - 3), end));
  }
  return `${sign}${groups.reverse().join(NBSP)},${fraction.padEnd(2, '0')}${NBSP}₽`;
}

export function formatPct(value: Value): string {
  const decimal = parseDecimal(value);
  if (!decimal) return UNAVAILABLE_VALUE;
  const fraction = decimal.fraction.replace(/0+$/, '');
  return `${decimal.sign}${decimal.integer}${fraction ? `,${fraction}` : ''}${NBSP}%`;
}

function parseCalendar(value: Value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match || match[0] !== value) return null;
  const [, year, month, day] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > daysInMonth[m - 1]) return null;
  return { year, month, day };
}

export function formatDate(value: Value): string {
  const calendar = parseCalendar(value);
  if (!calendar) return UNAVAILABLE_VALUE;
  return `${calendar.day}.${calendar.month}.${calendar.year}`;
}

const moscowDateTime = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatDateTime(value: Value): string {
  if (typeof value !== 'string') return UNAVAILABLE_VALUE;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || match[0] !== value || !parseCalendar(match[1])) return UNAVAILABLE_VALUE;
  const [, , hours, minutes, seconds, zone] = match;
  if (Number(hours) > 23 || Number(minutes) > 59 || Number(seconds) > 59) return UNAVAILABLE_VALUE;
  if (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)) return UNAVAILABLE_VALUE;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return UNAVAILABLE_VALUE;
  const parts = moscowDateTime.formatToParts(timestamp);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)!.value;
  return `${part('day')}.${part('month')}.${part('year').padStart(4, '0')}, ${part('hour')}:${part('minute')}`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return UNAVAILABLE_VALUE;
  if (ms < 1000) return `${ms} мс`;
  if (ms < 60_000) {
    const sec = (ms / 1000).toFixed(1);
    return `${sec} с`;
  }
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return `${min} мин ${sec} с`;
}
