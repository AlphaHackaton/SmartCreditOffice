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
