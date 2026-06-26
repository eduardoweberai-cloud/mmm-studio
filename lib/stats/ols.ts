// Numerically stable OLS via standardization + SVD.
//
// Why not the textbook (X'X)^-1 X'y? That squares the condition number, so with
// real marketing data (columns in millions next to columns in units, constant
// columns, many zeros) it produces garbage coefficients and impossible R^2
// values. Instead we:
//   1. drop constant (zero-variance) columns,
//   2. standardize the rest (mean 0, std 1),
//   3. solve with SVD (min-norm least squares, stable under collinearity),
//   4. back-transform coefficients and standard errors to the original scale.
// Training R^2 is therefore always in [0, 1].

import { Matrix, SingularValueDecomposition } from 'ml-matrix';
import { mean } from './metrics';

export type OlsFit = {
  intercept: number;
  interceptStdErr: number;
  /** Original-scale coefficients, length k (0 for dropped columns). */
  beta: number[];
  /** Standard errors, length k (NaN for dropped columns). */
  stdErr: number[];
  /** Per-column flag: column had no variation and was excluded. */
  degenerate: boolean[];
  fitted: number[];
  residuals: number[];
  sse: number;
  sst: number;
  r2: number;
  /** Numerical rank of the standardized design (intercept included). */
  rank: number;
  dfResid: number;
  rankDeficient: boolean;
  n: number;
  k: number;
};

function quadForm(a: number[], M: number[][]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === 0) continue;
    for (let j = 0; j < a.length; j++) {
      if (a[j] === 0) continue;
      s += a[i] * M[i][j] * a[j];
    }
  }
  return s;
}

export function olsFit(y: number[], X: number[][]): OlsFit {
  const n = y.length;
  const k = X[0]?.length ?? 0;
  const ybar = mean(y);
  const sst = y.reduce((s, v) => s + (v - ybar) ** 2, 0);

  // Column means/stds; flag zero-variance columns.
  const mu: number[] = [];
  const sd: number[] = [];
  const degenerate: boolean[] = [];
  for (let j = 0; j < k; j++) {
    const col = X.map((r) => r[j]);
    const m = mean(col);
    const variance = col.reduce((s, x) => s + (x - m) ** 2, 0) / (n || 1);
    const s = Math.sqrt(variance);
    mu.push(m);
    sd.push(s);
    degenerate.push(!(s > 1e-12));
  }
  const used: number[] = [];
  for (let j = 0; j < k; j++) if (!degenerate[j]) used.push(j);
  const p = used.length;
  const dim = p + 1; // intercept + used slopes

  // Standardized design with an explicit intercept column.
  const D = X.map((r) => {
    const row = [1];
    for (const j of used) row.push((r[j] - mu[j]) / sd[j]);
    return row;
  });

  const svd = new SingularValueDecomposition(new Matrix(D), { autoTranspose: true });
  const sv = svd.diagonal;
  const sMax = sv.reduce((a, b) => Math.max(a, b), 0);
  const tol = sMax * Math.max(n, dim) * 2.220446049250313e-16;
  let rank = 0;
  for (const s of sv) if (s > tol) rank++;
  const rankDeficient = rank < dim;

  const gamma = svd.solve(Matrix.columnVector(y)).to1DArray();

  // Back-transform coefficients to the original scale.
  const beta = new Array(k).fill(0);
  used.forEach((j, t) => {
    beta[j] = gamma[t + 1] / sd[j];
  });
  const intercept =
    gamma[0] - used.reduce((s, j, t) => s + (gamma[t + 1] * mu[j]) / sd[j], 0);

  const fitted = X.map((r) => intercept + r.reduce((s, v, j) => s + beta[j] * v, 0));
  const residuals = y.map((v, i) => v - fitted[i]);
  const sse = residuals.reduce((s, r) => s + r * r, 0);
  let r2 = sst > 0 ? 1 - sse / sst : sse < 1e-9 ? 1 : 0;
  if (!Number.isFinite(r2)) r2 = 0;
  r2 = Math.min(1, Math.max(0, r2));

  const dfResid = n - rank;
  const sigma2 = dfResid > 0 ? sse / dfResid : NaN;

  // (D'D)^+ = V * diag(1/s_i^2) * V'  for s_i > tol.
  const V = svd.rightSingularVectors;
  const inv2 = sv.map((s) => (s > tol ? 1 / (s * s) : 0));
  const covGamma: number[][] = Array.from({ length: dim }, () => new Array(dim).fill(0));
  for (let a = 0; a < dim; a++) {
    for (let b = a; b < dim; b++) {
      let s = 0;
      for (let i = 0; i < dim; i++) s += V.get(a, i) * V.get(b, i) * inv2[i];
      covGamma[a][b] = s;
      covGamma[b][a] = s;
    }
  }

  // Standard errors (back-transformed). Slopes: Var(beta_j)=Var(gamma)/sd^2.
  const stdErr = new Array(k).fill(NaN);
  used.forEach((j, t) => {
    const varSlope = (covGamma[t + 1][t + 1] / (sd[j] * sd[j])) * sigma2;
    stdErr[j] = Number.isFinite(varSlope) && varSlope >= 0 ? Math.sqrt(varSlope) : NaN;
  });
  // Intercept depends on the means: beta0 = gamma0 - sum gamma_t*mu/sd.
  const a0 = new Array(dim).fill(0);
  a0[0] = 1;
  used.forEach((j, t) => {
    a0[t + 1] = -mu[j] / sd[j];
  });
  const varIntercept = quadForm(a0, covGamma) * sigma2;
  const interceptStdErr =
    Number.isFinite(varIntercept) && varIntercept >= 0 ? Math.sqrt(varIntercept) : NaN;

  return {
    intercept,
    interceptStdErr,
    beta,
    stdErr,
    degenerate,
    fitted,
    residuals,
    sse,
    sst,
    r2,
    rank,
    dfResid,
    rankDeficient,
    n,
    k,
  };
}
