// Orchestrator: missing-value handling -> split -> stable fit on train
// -> inference -> diagnostics -> validate on test. Single public entry point.

import type {
  Dataset,
  ModelConfig,
  FitResponse,
  RegressionResult,
  Validation,
  Coefficient,
} from './types';
import { olsFit } from './ols';
import { rmse, mape, testR2 } from './metrics';
import { computeVif } from './vif';
import { contributions } from './contribution';
import { applyTransforms } from './transforms';
import { studentTwoSidedP, fTestPValue } from './dist';

export * from './types';

export function predictY(
  intercept: number,
  betas: number[],
  xValues: number[],
): number {
  return intercept + betas.reduce((s, b, j) => s + b * (xValues[j] ?? 0), 0);
}

const isMissing = (v: number | null | undefined): boolean =>
  v === null || v === undefined || !Number.isFinite(v);

export function fit(dataset: Dataset, config: ModelConfig): FitResponse {
  const warnings: string[] = [];
  const mode = config.missingMode ?? 'drop';

  const allCols = dataset.x[0]?.map((_, i) => i) ?? [];
  const activeX = config.activeX.length ? config.activeX : allCols;

  // Missing-value handling. A blank (null) is "no data", distinct from a real 0.
  const yKept: number[] = [];
  const xKept: number[][] = [];
  const keptPeriods: (string | undefined)[] = [];
  let droppedRows = 0;
  for (let i = 0; i < dataset.y.length; i++) {
    const yv = dataset.y[i];
    if (isMissing(yv)) {
      droppedRows++;
      continue;
    }
    const raw = activeX.map((c) => dataset.x[i]?.[c]);
    const missingMask = raw.map((v) => isMissing(v));
    if (mode === 'drop' && missingMask.some(Boolean)) {
      droppedRows++;
      continue;
    }
    xKept.push(raw.map((v, j) => (missingMask[j] ? 0 : (v as number))));
    yKept.push(yv as number);
    keptPeriods.push(dataset.periods?.[i]);
  }

  if (yKept.length < 2) {
    throw new Error(
      'Poucas linhas com dados completos para rodar o modelo. Verifique os valores em branco.',
    );
  }
  if (droppedRows > 0) {
    warnings.push(`${droppedRows} linha(s) ignorada(s) por valores faltantes.`);
  }

  const nKept = yKept.length;
  const trainCount = Math.min(
    nKept,
    Math.max(1, Math.round(nKept * config.trainRatio)),
  );

  const Xall = applyTransforms(xKept, config);
  const Xtrain = Xall.slice(0, trainCount);
  const yTrain = yKept.slice(0, trainCount);
  const Xtest = Xall.slice(trainCount);
  const yTest = yKept.slice(trainCount);
  const labels = activeX.map((c) => dataset.xLabels[c] ?? `X${c + 1}`);

  const f = olsFit(yTrain, Xtrain);
  const n = f.n;
  const dfResid = f.dfResid;

  const degLabels = labels.filter((_, j) => f.degenerate[j]);
  if (degLabels.length) {
    warnings.push(
      `Variaveis ignoradas por nao terem variacao nos dados: ${degLabels.join(', ')}.`,
    );
  }
  if (f.rankDeficient) {
    warnings.push(
      'Variaveis muito correlacionadas entre si (colinearidade); reduza variaveis para resultados mais estaveis.',
    );
  }
  if (dfResid <= 0) {
    warnings.push(
      `Graus de liberdade insuficientes para ${f.rank - 1} variaveis (linhas de treino=${n}). Reduza variaveis ou use mais dados.`,
    );
  }

  const mkCoef = (
    index: number,
    label: string,
    beta: number,
    stdErr: number,
  ): Coefficient => {
    const tStat = stdErr ? beta / stdErr : NaN;
    const pValue =
      Number.isFinite(tStat) && dfResid > 0 ? studentTwoSidedP(Math.abs(tStat), dfResid) : NaN;
    return {
      index,
      label,
      beta,
      stdErr,
      tStat,
      pValue,
      significant: Number.isFinite(pValue) && pValue < 0.05,
    };
  };

  const intercept = mkCoef(-1, 'Intercepto', f.intercept, f.interceptStdErr);
  const usedJ = labels.map((_, j) => j).filter((j) => !f.degenerate[j]);
  const coefficients = usedJ.map((j) =>
    mkCoef(activeX[j], labels[j], f.beta[j], f.stdErr[j]),
  );

  // VIF + contribution on the columns actually used.
  const Xused = Xtrain.map((r) => usedJ.map((j) => r[j]));
  const usedLabels = usedJ.map((j) => labels[j]);
  const vifVals = computeVif(Xused);
  const vif = usedLabels.map((label, t) => {
    const value = vifVals[t] ?? 1;
    return { label, value, high: value > 5 };
  });
  if (vif.some((v) => v.high)) {
    warnings.push('VIF alto (>5): possivel multicolinearidade entre variaveis.');
  }

  const usedBeta = usedJ.map((j) => f.beta[j]);
  const contribs = contributions(usedBeta, Xused, usedLabels);

  const adjR2 = dfResid > 0 ? 1 - ((1 - f.r2) * (n - 1)) / dfResid : null;

  // Overall F-test: are all the variables together significant?
  // F = (R2/df1) / ((1-R2)/df2), df1 = predictors, df2 = residual df.
  const df1 = Math.max(0, f.rank - 1);
  const df2 = dfResid;
  let fStat: number | null = null;
  let fPValue: number | null = null;
  if (df1 > 0 && df2 > 0) {
    if (1 - f.r2 < 1e-12) {
      fStat = Infinity;
      fPValue = 0;
    } else {
      fStat = (f.r2 * df2) / ((1 - f.r2) * df1);
      fPValue = fTestPValue(fStat, df1, df2);
    }
  }

  const model: RegressionResult = {
    intercept,
    coefficients,
    r2: f.r2,
    adjR2,
    n,
    k: usedJ.length,
    degreesOfFreedom: dfResid,
    vif,
    contributions: contribs,
    warnings,
    droppedRows,
    fStat,
    fPValue,
  };

  const preds = Xtest.map((row) => predictY(f.intercept, f.beta, row));
  const rows = yTest.map((actual, i) => ({
    period: keptPeriods[trainCount + i],
    actual,
    predicted: preds[i],
  }));
  const tR2 = yTest.length ? testR2(yTest, preds) : null;
  const validation: Validation = {
    rows,
    mape: yTest.length ? mape(yTest, preds) : null,
    rmse: yTest.length ? rmse(yTest, preds) : null,
    testR2: tR2,
  };
  if (tR2 !== null && tR2 < 0) {
    warnings.push(
      'R² de teste negativo: o modelo preve pior que a media no teste (sinal de overfitting). Use menos variaveis ou mais dados.',
    );
  }

  return { model, validation };
}
