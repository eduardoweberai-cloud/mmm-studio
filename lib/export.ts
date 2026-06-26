// Build a Brazilian-Excel-friendly CSV of the model results.
// Semicolon-delimited with comma decimals (pt-BR) so it opens with columns
// split correctly in Brazilian Excel. A UTF-8 BOM is added at download time.

import type { FitResponse, Coefficient } from './stats/types';

function num(v: number | null | undefined, d = 4): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '';
  return v.toLocaleString('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: 0 });
}

function cell(s: string | number | null | undefined): string {
  const str = s === null || s === undefined ? '' : String(s);
  return /[";\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function row(...cells: (string | number | null | undefined)[]): string {
  return cells.map(cell).join(';');
}

export function buildResultCsv(result: FitResponse, generatedAt: string): string {
  const { model, validation } = result;
  const lines: string[] = [];

  lines.push(row('MMM Studio - Resultado'));
  lines.push(row('Gerado em', generatedAt));
  lines.push('');

  lines.push(row('Resumo'));
  lines.push(row('R2 (treino)', num(model.r2)));
  lines.push(row('R2 ajustado', model.adjR2 === null ? '' : num(model.adjR2)));
  lines.push(
    row(
      'F (teste global)',
      model.fStat === null ? '' : Number.isFinite(model.fStat) ? num(model.fStat, 2) : 'infinito',
    ),
  );
  lines.push(row('Significancia F (p-valor)', model.fPValue === null ? '' : num(model.fPValue, 6)));
  lines.push(row('Linhas de treino', model.n));
  lines.push(row('Linhas de teste', validation.rows.length));
  lines.push(row('Variaveis no modelo', model.k));
  lines.push(row('Graus de liberdade', model.degreesOfFreedom));
  lines.push(row('MAPE (%)', validation.mape === null ? '' : num(validation.mape * 100, 2)));
  lines.push(row('RMSE', num(validation.rmse, 2)));
  lines.push(row('R2 (teste)', validation.testR2 === null ? '' : num(validation.testR2)));
  lines.push(row('Linhas ignoradas (faltantes)', model.droppedRows));
  lines.push('');

  if (model.warnings.length) {
    lines.push(row('Avisos'));
    for (const w of model.warnings) lines.push(row(w));
    lines.push('');
  }

  const coefRow = (c: Coefficient) =>
    row(c.label, num(c.beta), num(c.stdErr), num(c.tStat, 3), num(c.pValue), c.significant ? 'sim' : 'nao');
  lines.push(row('Coeficientes'));
  lines.push(row('Variavel', 'Coeficiente', 'Erro padrao', 't', 'p-valor', 'Significativo'));
  lines.push(coefRow(model.intercept));
  for (const c of model.coefficients) lines.push(coefRow(c));
  lines.push('');

  lines.push(row('Contribuicao (%)'));
  lines.push(row('Variavel', 'Contribuicao %'));
  for (const c of model.contributions) lines.push(row(c.label, num(c.pct, 2)));
  lines.push('');

  lines.push(row('VIF (multicolinearidade)'));
  lines.push(row('Variavel', 'VIF', 'Status'));
  for (const v of model.vif) {
    lines.push(row(v.label, Number.isFinite(v.value) ? num(v.value, 2) : 'inf', v.high ? 'alto' : 'ok'));
  }
  lines.push('');

  lines.push(row('Validacao (real vs previsto)'));
  lines.push(row('Periodo', 'Real', 'Previsto'));
  for (const r of validation.rows) lines.push(row(r.period ?? '', num(r.actual, 2), num(r.predicted, 2)));

  return lines.join('\r\n');
}
