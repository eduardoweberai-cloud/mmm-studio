import { describe, it, expect } from 'vitest';
import { toNumber } from './parse';

describe('toNumber - auto format (Brazilian + US)', () => {
  it('Brazilian thousands with dots', () => {
    expect(toNumber('27.538.808')).toBe(27538808);
    expect(toNumber('293.921')).toBe(293921);
    expect(toNumber('29.659')).toBe(29659);
    expect(toNumber('1.234')).toBe(1234);
  });
  it('Brazilian decimal with comma', () => {
    expect(toNumber('1.234,56')).toBeCloseTo(1234.56, 6);
    expect(toNumber('29,5')).toBeCloseTo(29.5, 6);
  });
  it('US format', () => {
    expect(toNumber('1,234,567')).toBe(1234567);
    expect(toNumber('1,234.56')).toBeCloseTo(1234.56, 6);
  });
  it('plain numbers and genuine decimals', () => {
    expect(toNumber('29659')).toBe(29659);
    expect(toNumber('12.34')).toBeCloseTo(12.34, 6);
    expect(toNumber('1.5')).toBeCloseTo(1.5, 6);
    expect(toNumber('0')).toBe(0);
  });
  it('strips currency and spaces', () => {
    expect(toNumber('R$ 1.234,56')).toBeCloseTo(1234.56, 6);
    expect(toNumber(' 27.538.808 ')).toBe(27538808);
    expect(toNumber('-1.234')).toBe(-1234);
  });
  it('blank -> NaN', () => {
    expect(Number.isNaN(toNumber(''))).toBe(true);
    expect(Number.isNaN(toNumber('   '))).toBe(true);
  });
});

describe('toNumber - explicit formats', () => {
  it('br treats dot as thousands, comma as decimal', () => {
    expect(toNumber('1.234', 'br')).toBe(1234);
    expect(toNumber('1.234,56', 'br')).toBeCloseTo(1234.56, 6);
  });
  it('us treats comma as thousands, dot as decimal', () => {
    expect(toNumber('1.234', 'us')).toBeCloseTo(1.234, 6);
    expect(toNumber('1,234', 'us')).toBe(1234);
    expect(toNumber('1,234.56', 'us')).toBeCloseTo(1234.56, 6);
  });
});
