// Variance Inflation Factor per active X: regress X_j on the other X
// (with intercept), VIF_j = 1 / (1 - R^2_j). Flags multicollinearity.

import { olsFit } from './ols';

export function computeVif(X: number[][]): number[] {
  const k = X[0]?.length ?? 0;
  if (k === 0) return [];
  if (k === 1) return [1]; // a single predictor cannot be collinear

  const vifs: number[] = [];
  for (let j = 0; j < k; j++) {
    const yj = X.map((row) => row[j]);
    const others = X.map((row) => row.filter((_, c) => c !== j));
    const fit = olsFit(yj, others);
    const rsq = fit.r2;
    vifs.push(rsq >= 1 ? Infinity : 1 / (1 - rsq));
  }
  return vifs;
}
