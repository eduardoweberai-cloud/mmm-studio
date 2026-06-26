import { describe, it, expect } from 'vitest';
import { olsFit } from '../ols';
import { fit } from '../index';
import { studentTwoSidedP } from '../dist';
import type { Dataset, ModelConfig } from '../types';

describe('olsFit - exact fit (algebra, independent of any stats lib)', () => {
  it('recovers exact coefficients with R2 = 1', () => {
    const x1 = [1, 2, 3, 4, 5, 6];
    const x2 = [2, 1, 4, 3, 6, 5];
    const X = x1.map((v, i) => [v, x2[i]]);
    const y = X.map(([a, b]) => 1 + 2 * a - 1 * b); // intercept 1, betas [2,-1]
    const f = olsFit(y, X);
    expect(f.intercept).toBeCloseTo(1, 9);
    expect(f.beta[0]).toBeCloseTo(2, 9);
    expect(f.beta[1]).toBeCloseTo(-1, 9);
    expect(f.r2).toBeCloseTo(1, 9);
    expect(f.rankDeficient).toBe(false);
  });
});

describe('simple linear regression - hand-derived reference', () => {
  // x=[1..5], y=[2,4,5,4,5]: slope 0.6, intercept 2.2, R2 0.6, SSE 2.4,
  // s=sqrt(0.8), stdErr(slope)=0.282843, t(slope)=2.12132, df=3.
  const x = [1, 2, 3, 4, 5];
  const y = [2, 4, 5, 4, 5];
  const ds: Dataset = { yLabel: 'Y', xLabels: ['X1'], y, x: x.map((v) => [v]) };
  const cfg: ModelConfig = { activeX: [0], trainRatio: 1 };
  const { model } = fit(ds, cfg);

  it('slope and intercept', () => {
    expect(model.coefficients[0].beta).toBeCloseTo(0.6, 9);
    expect(model.intercept.beta).toBeCloseTo(2.2, 9);
  });
  it('R2 = 0.6', () => {
    expect(model.r2).toBeCloseTo(0.6, 9);
  });
  it('stdErr and t of the slope', () => {
    expect(model.coefficients[0].stdErr).toBeCloseTo(0.282843, 5);
    expect(model.coefficients[0].tStat).toBeCloseTo(2.12132, 4);
  });
  it('p-value of the slope is ~0.124', () => {
    expect(model.coefficients[0].pValue).toBeGreaterThan(0.11);
    expect(model.coefficients[0].pValue).toBeLessThan(0.14);
  });
});

describe('studentTwoSidedP', () => {
  it('t=2.12132, df=3 -> ~0.124', () => {
    const p = studentTwoSidedP(2.12132, 3);
    expect(p).toBeGreaterThan(0.11);
    expect(p).toBeLessThan(0.14);
  });
  it('t=0 -> p=1', () => {
    expect(studentTwoSidedP(0, 5)).toBeCloseTo(1, 6);
  });
});

describe('fit - diagnostics and robustness', () => {
  it('collinear data: warns and stays finite', () => {
    const x1 = [1, 2, 3, 4, 5, 6, 7, 8];
    const X = x1.map((v) => [v, 2 * v]); // x2 = 2*x1, perfectly collinear
    const y = x1.map((v) => 3 + v);
    const ds: Dataset = { yLabel: 'Y', xLabels: ['X1', 'X2'], y, x: X };
    const { model } = fit(ds, { activeX: [0, 1], trainRatio: 1 });
    expect(
      model.warnings.some((w) => /colinearidade|correlacionadas|VIF|ignoradas/i.test(w)),
    ).toBe(true);
    expect(Number.isFinite(model.intercept.beta)).toBe(true);
    model.coefficients.forEach((c) => expect(Number.isFinite(c.beta)).toBe(true));
  });

  it('low degrees of freedom: adjR2 null + warning', () => {
    const rows = [
      [1, 2, 3],
      [2, 1, 1],
      [3, 3, 2],
      [1, 0, 4],
    ];
    const y = [1, 2, 3, 4];
    const ds: Dataset = { yLabel: 'Y', xLabels: ['X1', 'X2', 'X3'], y, x: rows };
    const { model } = fit(ds, { activeX: [0, 1, 2], trainRatio: 1 });
    expect(model.degreesOfFreedom).toBeLessThanOrEqual(0);
    expect(model.adjR2).toBeNull();
    expect(model.warnings.some((w) => /[Gg]raus de liberdade/.test(w))).toBe(true);
  });

  it('train/test split produces validation rows and metrics', () => {
    const n = 10;
    const x = Array.from({ length: n }, (_, i) => [i + 1]);
    const y = x.map(([v]) => 2 + 3 * v + (v % 2 === 0 ? 0.5 : -0.5));
    const ds: Dataset = { yLabel: 'Y', xLabels: ['X1'], y, x };
    const { validation } = fit(ds, { activeX: [0], trainRatio: 0.7 });
    expect(validation.rows.length).toBe(3); // 10 - round(7) = 3
    expect(validation.rmse).not.toBeNull();
    expect(validation.testR2).not.toBeNull();
  });
});

describe('missing values (blank is not zero)', () => {
  const ds = (y: (number | null)[], x: (number | null)[][]): Dataset => ({
    yLabel: 'Y',
    xLabels: ['X1', 'X2'],
    y,
    x,
  });

  it('drop mode excludes rows with a missing active X', () => {
    const y = [10, 20, 30, 40, 50, 60];
    const x = [[1, 1], [2, 2], [null, 3], [4, 4], [5, 5], [6, 6]];
    const { model } = fit(ds(y, x), { activeX: [0, 1], trainRatio: 1, missingMode: 'drop' });
    expect(model.droppedRows).toBe(1);
    expect(model.n).toBe(5);
  });

  it('zero mode treats a missing X as 0 and keeps the row', () => {
    const y = [10, 20, 30, 40, 50, 60];
    const x = [[1, 1], [2, 2], [null, 3], [4, 4], [5, 5], [6, 6]];
    const { model } = fit(ds(y, x), { activeX: [0, 1], trainRatio: 1, missingMode: 'zero' });
    expect(model.droppedRows).toBe(0);
    expect(model.n).toBe(6);
  });

  it('a row with missing Y is always dropped', () => {
    const y = [10, null, 30, 40, 50, 60];
    const x = [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6]];
    const { model } = fit(ds(y, x), { activeX: [0, 1], trainRatio: 1, missingMode: 'zero' });
    expect(model.droppedRows).toBe(1);
    expect(model.n).toBe(5);
  });

  it('a real 0 is kept (0 is not missing)', () => {
    const y = [10, 20, 30, 40];
    const x = [[0, 1], [2, 0], [3, 3], [4, 4]];
    const { model } = fit(ds(y, x), { activeX: [0, 1], trainRatio: 1, missingMode: 'drop' });
    expect(model.droppedRows).toBe(0);
    expect(model.n).toBe(4);
  });
});

describe('numerical robustness (the -240000 bug)', () => {
  it('drops a constant column and keeps R2 in [0,1]', () => {
    const y = [10, 12, 9, 14, 11, 13, 15, 12];
    const x = y.map((_, i) => [i + 1, 5]); // X2 is constant
    const ds: Dataset = { yLabel: 'Y', xLabels: ['X1', 'X2'], y, x };
    const { model } = fit(ds, { activeX: [0, 1], trainRatio: 1 });
    expect(model.r2).toBeGreaterThanOrEqual(0);
    expect(model.r2).toBeLessThanOrEqual(1);
    expect(model.warnings.some((w) => /ignoradas|variacao/i.test(w))).toBe(true);
    expect(model.coefficients.length).toBe(1); // only the varying column remains
  });

  it('handles wildly different scales without breaking R2', () => {
    const n = 20;
    const y: number[] = [];
    const x: number[][] = [];
    for (let i = 0; i < n; i++) {
      const big = 1_000_000 + i * 50_000; // millions
      const small = (i % 5) + 1; // single digits
      y.push(2 + 0.000003 * big + 1.5 * small);
      x.push([big, small]);
    }
    const ds: Dataset = { yLabel: 'Y', xLabels: ['X1', 'X2'], y, x };
    const { model } = fit(ds, { activeX: [0, 1], trainRatio: 1 });
    expect(model.r2).toBeGreaterThanOrEqual(0);
    expect(model.r2).toBeLessThanOrEqual(1);
    expect(model.r2).toBeGreaterThan(0.99);
    expect(Number.isFinite(model.intercept.beta)).toBe(true);
  });
});
