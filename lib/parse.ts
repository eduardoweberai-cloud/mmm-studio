// Parsing helpers: pasted Excel/TSV/CSV text and Brazilian / US number formats.

import Papa from 'papaparse';

export type NumberFormat = 'auto' | 'br' | 'us';

/** Parse pasted/uploaded delimited text into a trimmed 2D string grid. */
export function parseDelimited(text: string): string[][] {
  const result = Papa.parse<string[]>(text.trim(), {
    skipEmptyLines: true,
    delimiter: '', // auto-detect among , ; \t |
  });
  return (result.data as unknown as string[][]).map((row) =>
    row.map((c) => String(c ?? '').trim()),
  );
}

// Decide separators when the format is unknown.
// Handles: 27.538.808 (BR thousands), 1.234,56 (BR), 1,234.56 (US),
// 1,234,567 (US thousands), 12.34 / 1.5 (decimals), 293.921 / 1.234 (BR thousands).
function autoNormalize(t: string): string {
  const hasComma = t.includes(',');
  const hasDot = t.includes('.');

  if (hasComma && hasDot) {
    // The rightmost separator is the decimal one.
    return t.lastIndexOf(',') > t.lastIndexOf('.')
      ? t.replace(/\./g, '').replace(',', '.') // 1.234,56 -> 1234.56
      : t.replace(/,/g, ''); //                  1,234.56 -> 1234.56
  }
  if (hasComma) {
    const parts = t.split(',');
    if (parts.length > 2) return t.replace(/,/g, ''); // 1,234,567 thousands
    return t.replace(',', '.'); //                       single comma = decimal (BR)
  }
  if (hasDot) {
    const parts = t.split('.');
    if (parts.length > 2) return t.replace(/\./g, ''); // 27.538.808 thousands
    // Single dot: exactly 3 trailing digits is a thousands group (293.921, 1.234);
    // otherwise it is a decimal (12.34, 1.5).
    if (parts[1].length === 3) return t.replace('.', '');
    return t;
  }
  return t;
}

/** Coerce a string to a number under the chosen format ('auto' by default). */
export function toNumber(s: string, fmt: NumberFormat = 'auto'): number {
  let t = String(s).trim();
  if (t === '') return NaN;
  t = t.replace(/[R$\s %]/gi, ''); // strip currency, spaces, percent
  if (t === '') return NaN;
  const neg = /^-/.test(t);
  t = t.replace(/[+-]/g, '');
  if (t === '') return NaN;

  let normalized: string;
  if (fmt === 'br') normalized = t.replace(/\./g, '').replace(',', '.');
  else if (fmt === 'us') normalized = t.replace(/,/g, '');
  else normalized = autoNormalize(t);

  const num = Number(normalized);
  return neg ? -num : num;
}

export function isNumeric(s: string, fmt: NumberFormat = 'auto'): boolean {
  return !Number.isNaN(toNumber(s, fmt));
}
