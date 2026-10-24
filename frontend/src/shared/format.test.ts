import { describe, expect, it } from 'vitest';
import { formatMoney, formatPct } from './format';

describe('formatMoney', () => {
  it.each([
    ['9007199254740993.01', '9\u00a0007\u00a0199\u00a0254\u00a0740\u00a0993,01\u00a0₽'],
    ['2500000', '2\u00a0500\u00a0000,00\u00a0₽'],
    ['0', '0,00\u00a0₽'],
    ['-0012.5', '-12,50\u00a0₽'],
    ['-0.00', '0,00\u00a0₽'],
    ['0000.01', '0,01\u00a0₽'],
    ['-0.01', '-0,01\u00a0₽'],
    ['123456.78', '123\u00a0456,78\u00a0₽'],
  ])('точно отображает %s', (value, expected) => {
    expect(formatMoney(value)).toBe(expected);
  });

  it.each([null, undefined, '', ' ', ' 12', '12 ', '12\n', '+12', '.5', '12.', '1,50', '1e6', 'NaN', 'Infinity', '12.345', '12.000'])('отклоняет %s без округления и подстановки нуля', (value) => {
    expect(formatMoney(value)).toBe('—');
  });
});

describe('formatPct', () => {
  it.each([
    ['21.000', '21\u00a0%'],
    ['0.1250', '0,125\u00a0%'],
    ['00021.100', '21,1\u00a0%'],
    ['-0.000', '0\u00a0%'],
    ['-0.01250', '-0,0125\u00a0%'],
    ['9007199254740993.1234567890', '9007199254740993,123456789\u00a0%'],
  ])('сохраняет величину и значащие цифры %s', (value, expected) => {
    expect(formatPct(value)).toBe(expected);
  });

  it.each([null, undefined, '', ' ', '21\n', '21.', '+21', '1e2', '0,125', 'NaN', 'Infinity'])('отклоняет %s', (value) => {
    expect(formatPct(value)).toBe('—');
  });
});

it.each([0, 12.5, NaN, Infinity, {}, [], true])('защищает форматтеры от неверного runtime-типа %s', (value) => {
  const invalid = value as unknown as string;
  expect(formatMoney(invalid)).toBe('—');
  expect(formatPct(invalid)).toBe('—');
});
