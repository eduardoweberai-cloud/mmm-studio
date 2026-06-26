// Deterministic sample dataset: 36 months, 3 channels, a clean linear signal
// so users (and the e2e test) can run the model immediately.

export function sampleDataset(): {
  periods: string[];
  xLabels: string[];
  y: number[];
  x: number[][];
} {
  const n = 36;
  const periods: string[] = [];
  const y: number[] = [];
  const x: number[][] = [];
  for (let i = 0; i < n; i++) {
    const t = i + 1;
    const x1 = Math.round(8000 + 3000 * Math.sin(i / 3) + 120 * t);
    const x2 = Math.round(5000 + 2000 * Math.cos(i / 4) + 60 * t);
    const x3 = Math.round(2000 + 1500 * Math.sin(i / 6 + 1) + 30 * t);
    const seasonal = 400 * Math.sin(i / 6);
    const noise = 200 * Math.sin(i * 1.7);
    const yv = Math.round(
      20000 + 1.8 * x1 + 1.2 * x2 + 0.6 * x3 + seasonal + noise,
    );
    periods.push(`M${t}`);
    y.push(yv);
    x.push([x1, x2, x3]);
  }
  return { periods, xLabels: ['X1', 'X2', 'X3'], y, x };
}
