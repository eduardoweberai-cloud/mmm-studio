// Core data contracts for the MMM Studio regression engine.
// Framework-free on purpose: this module is unit-testable without any UI.

export type Dataset = {
  /** Optional month/period labels, excluded from the model. */
  periods?: string[];
  /** Dependent variable label (default "Y"). */
  yLabel: string;
  /** Independent variable labels (default ["X1".."Xk"]). */
  xLabels: string[];
  /** Dependent values, length n. null = missing (no data). */
  y: (number | null)[];
  /** Independent values, n rows x k columns. null = missing (no data). */
  x: (number | null)[][];
};

export type ModelConfig = {
  /** Indices (into xLabels / x columns) of the X variables to include. */
  activeX: number[];
  /** Training fraction, 0..1. Default 0.7 -> 25 train / 11 test on 36 rows. */
  trainRatio: number;
  /**
   * How to treat blank cells (missing data, distinct from a real 0).
   * 'drop'  = complete-case analysis: exclude rows with any missing active value (default, statistically honest).
   * 'zero'  = replace blanks with 0 (only when a blank truly means zero).
   */
  missingMode?: 'drop' | 'zero';
  // v2 seam: transforms?: { adstock?: AdstockConfig; saturation?: SaturationConfig };
};

export type Coefficient = {
  /** Original X column index, or -1 for the intercept. */
  index: number;
  label: string;
  beta: number;
  stdErr: number;
  tStat: number;
  pValue: number;
  significant: boolean;
};

export type VifEntry = { label: string; value: number; high: boolean };
export type ContributionEntry = { label: string; pct: number };

export type RegressionResult = {
  intercept: Coefficient;
  coefficients: Coefficient[];
  r2: number;
  adjR2: number | null;
  /** Training rows. */
  n: number;
  /** Number of active X variables. */
  k: number;
  degreesOfFreedom: number;
  vif: VifEntry[];
  contributions: ContributionEntry[];
  warnings: string[];
  /** Rows excluded because of missing data. */
  droppedRows: number;
  /** Overall F-test (all variables jointly); null when undefined. */
  fStat: number | null;
  /** p-value of the overall F-test ("Significancia F"). */
  fPValue: number | null;
};

export type ValidationRow = { period?: string; actual: number; predicted: number };

export type Validation = {
  rows: ValidationRow[];
  mape: number | null;
  rmse: number | null;
  testR2: number | null;
};

export type FitResponse = {
  model: RegressionResult;
  validation: Validation;
};
