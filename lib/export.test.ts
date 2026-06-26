import { describe, it, expect } from 'vitest';
import { fit } from './stats';
import { buildResultCsv } from './export';
import { sampleDataset } from './sample';

describe('buildResultCsv', () => {
  const s = sampleDataset();
  const res = fit(
    { yLabel: 'Y', xLabels: s.xLabels, periods: s.periods, y: s.y, x: s.x },
    { activeX: [0, 1, 2], trainRatio: 0.7 },
  );
  const csv = buildResultCsv(res, '2026-06-26 10:00');

  it('contains all the report sections', () => {
    expect(csv).toContain('MMM Studio - Resultado');
    expect(csv).toContain('Resumo');
    expect(csv).toContain('Coeficientes');
    expect(csv).toContain('Intercepto');
    expect(csv).toContain('Contribuicao (%)');
    expect(csv).toContain('Validacao (real vs previsto)');
  });

  it('is semicolon-delimited with a header row', () => {
    expect(csv).toMatch(/Variavel;Coeficiente;Erro padrao;t;p-valor;Significativo/);
    expect(csv.split('\r\n').length).toBeGreaterThan(15);
  });
});
