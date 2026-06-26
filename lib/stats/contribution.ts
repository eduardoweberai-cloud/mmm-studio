// Practical signal-share decomposition used in applied MMM:
// contribution_j = sum_i |beta_j * X_ij| over training rows,
// reported as a percentage of the total. This is NOT a variance decomposition,
// and the UI labels it accordingly.

import type { ContributionEntry } from './types';

export function contributions(
  betaX: number[],
  X: number[][],
  labels: string[],
): ContributionEntry[] {
  const k = betaX.length;
  const sums = new Array(k).fill(0);
  for (const row of X) {
    for (let j = 0; j < k; j++) {
      sums[j] += Math.abs(betaX[j] * row[j]);
    }
  }
  const total = sums.reduce((s: number, v: number) => s + v, 0);
  return labels.map((label, j) => ({
    label,
    pct: total > 0 ? (100 * sums[j]) / total : 0,
  }));
}
