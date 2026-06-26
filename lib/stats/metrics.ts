// Fit-quality and error metrics. All guard against degenerate inputs.

export function mean(a: number[]): number {
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
}

export function adjustedR2(r2: number, n: number, k: number): number | null {
  const df = n - k - 1;
  if (df <= 0) return null;
  return 1 - ((1 - r2) * (n - 1)) / df;
}

export function rmse(actual: number[], predicted: number[]): number | null {
  const m = actual.length;
  if (m === 0) return null;
  const sse = actual.reduce((s, a, i) => s + (a - predicted[i]) ** 2, 0);
  return Math.sqrt(sse / m);
}

/** Mean absolute percentage error, skipping rows where actual = 0. */
export function mape(actual: number[], predicted: number[]): number | null {
  const usable = actual
    .map((a, i) => [a, predicted[i]] as const)
    .filter(([a]) => a !== 0);
  if (usable.length === 0) return null;
  const total = usable.reduce((s, [a, p]) => s + Math.abs((a - p) / a), 0);
  return total / usable.length;
}

/** Out-of-sample R^2 around the test-set mean. */
export function testR2(actual: number[], predicted: number[]): number | null {
  const m = actual.length;
  if (m === 0) return null;
  const ab = mean(actual);
  const sse = actual.reduce((s, a, i) => s + (a - predicted[i]) ** 2, 0);
  const sst = actual.reduce((s, a) => s + (a - ab) ** 2, 0);
  if (sst === 0) return null;
  return 1 - sse / sst;
}
