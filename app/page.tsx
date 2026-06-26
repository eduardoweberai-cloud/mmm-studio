'use client';

import { useRef, useState } from 'react';
import type React from 'react';
import { sampleDataset } from '@/lib/sample';
import { parseDelimited, toNumber, isNumeric, type NumberFormat } from '@/lib/parse';
import type { FitResponse } from '@/lib/stats/types';
import Results from '@/components/Results';

const MAX_X = 20;
const MIN_X = 1;
const MIN_ROWS = 4;

function emptyGrid(rows: number, xCount: number): string[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: xCount + 1 }, () => ''),
  );
}

function Btn({
  children,
  onClick,
  variant = 'ghost',
  testid,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'ghost' | 'primary';
  testid?: string;
}) {
  const base =
    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50';
  const styles =
    variant === 'primary'
      ? 'bg-indigo-600 text-white hover:bg-indigo-500'
      : 'border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800';
  return (
    <button type="button" onClick={onClick} className={`${base} ${styles}`} data-testid={testid}>
      {children}
    </button>
  );
}

export default function Home() {
  const [xLabels, setXLabels] = useState<string[]>(['X1', 'X2', 'X3']);
  const [activeX, setActiveX] = useState<boolean[]>([true, true, true]);
  const [cells, setCells] = useState<string[][]>(() => emptyGrid(36, 3));
  const [yLabel, setYLabel] = useState('Y');
  const [periods, setPeriods] = useState<string[]>(() =>
    Array.from({ length: 36 }, (_, i) => `M${i + 1}`),
  );
  const [trainRatio, setTrainRatio] = useState(0.7);
  const [missingMode, setMissingMode] = useState<'drop' | 'zero'>('drop');
  const [numberFormat, setNumberFormat] = useState<NumberFormat>('auto');
  const [result, setResult] = useState<FitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const n = cells.length;
  const xCount = xLabels.length;
  const trainCount = Math.min(n, Math.max(1, Math.round(n * trainRatio)));

  function setCell(r: number, c: number, value: string) {
    setCells((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = value;
      return next;
    });
  }
  function setXLabel(j: number, value: string) {
    setXLabels((prev) => prev.map((l, i) => (i === j ? value : l)));
  }
  function setPeriod(r: number, value: string) {
    setPeriods((prev) => {
      const next = [...prev];
      while (next.length <= r) next.push(`M${next.length + 1}`);
      next[r] = value;
      return next;
    });
  }

  function loadExample() {
    const s = sampleDataset();
    setXLabels(s.xLabels);
    setActiveX(s.xLabels.map(() => true));
    setYLabel('Y');
    setPeriods(s.periods);
    setCells(s.y.map((yv, i) => [String(yv), ...s.x[i].map((v) => String(v))]));
    setResult(null);
    setError(null);
  }

  function clearAll() {
    setCells(emptyGrid(n, xCount));
    setResult(null);
    setError(null);
  }

  function addRow() {
    setCells((prev) => [...prev, Array.from({ length: xCount + 1 }, () => '')]);
    setPeriods((prev) => [...prev, `M${prev.length + 1}`]);
  }
  function removeRow() {
    setCells((prev) => (prev.length > MIN_ROWS ? prev.slice(0, -1) : prev));
    setPeriods((prev) => (prev.length > MIN_ROWS ? prev.slice(0, -1) : prev));
  }
  function addCol() {
    if (xCount >= MAX_X) return;
    setXLabels((prev) => [...prev, `X${prev.length + 1}`]);
    setActiveX((prev) => [...prev, true]);
    setCells((prev) => prev.map((row) => [...row, '']));
  }
  function removeCol() {
    if (xCount <= MIN_X) return;
    setXLabels((prev) => prev.slice(0, -1));
    setActiveX((prev) => prev.slice(0, -1));
    setCells((prev) => prev.map((row) => row.slice(0, -1)));
  }
  function toggleX(j: number) {
    setActiveX((prev) => prev.map((v, i) => (i === j ? !v : v)));
  }

  function handlePaste(e: React.ClipboardEvent, r: number, c: number) {
    const text = e.clipboardData.getData('text');
    if (!text || (!text.includes('\t') && !text.includes('\n') && !text.includes(','))) return;
    e.preventDefault();
    const grid = parseDelimited(text);
    if (grid.length === 0) return;

    // Auto-grow: create the rows and X columns needed to fit the pasted block.
    const gw = Math.max(...grid.map((row) => row.length));
    const neededX = Math.min(MAX_X, Math.max(xCount, c + gw - 1));
    const neededRows = Math.max(n, r + grid.length);
    const totalCols = neededX + 1;

    setXLabels((prev) => {
      const next = [...prev];
      while (next.length < neededX) next.push(`X${next.length + 1}`);
      return next;
    });
    setActiveX((prev) => {
      const next = [...prev];
      while (next.length < neededX) next.push(true);
      return next;
    });
    setPeriods((prev) => {
      const next = [...prev];
      while (next.length < neededRows) next.push(`M${next.length + 1}`);
      return next;
    });
    setCells((prev) => {
      const next = prev.map((row) => {
        const nr = [...row];
        while (nr.length < totalCols) nr.push('');
        return nr;
      });
      while (next.length < neededRows) {
        next.push(Array.from({ length: totalCols }, () => ''));
      }
      for (let i = 0; i < grid.length; i++) {
        for (let j = 0; j < grid[i].length; j++) {
          const rr = r + i;
          const cc = c + j;
          if (rr < next.length && cc < next[rr].length) next[rr][cc] = grid[i][j];
        }
      }
      return next;
    });
  }

  async function handleCsv(file: File) {
    const text = await file.text();
    let grid = parseDelimited(text);
    if (grid.length === 0) return;
    if (grid[0].some((cell) => cell !== '' && !isNumeric(cell, numberFormat))) {
      grid = grid.slice(1); // drop header row
    }
    const xc = Math.max(MIN_X, Math.min(MAX_X, (grid[0]?.length ?? 2) - 1));
    setXLabels(Array.from({ length: xc }, (_, i) => `X${i + 1}`));
    setActiveX(Array.from({ length: xc }, () => true));
    setPeriods(grid.map((_, i) => `M${i + 1}`));
    setCells(
      grid.map((row) => {
        const r = row.slice(0, xc + 1);
        while (r.length < xc + 1) r.push('');
        return r;
      }),
    );
    setResult(null);
    setError(null);
  }

  function run() {
    setError(null);
    const y: (number | null)[] = [];
    const x: (number | null)[][] = [];
    for (let i = 0; i < n; i++) {
      const yRaw = (cells[i][0] ?? '').trim();
      // Blank or an Excel artifact (#, ###, #REF!, #N/A) counts as "no data".
      const yMissing = yRaw === '' || yRaw.startsWith('#');
      const yv = yMissing ? null : toNumber(yRaw, numberFormat);
      if (!yMissing && !Number.isFinite(yv as number)) {
        setError(`Linha ${i + 1}: ${yLabel || 'Y'} nao e um numero valido.`);
        return;
      }
      y.push(yv);
      const row: (number | null)[] = [];
      for (let j = 0; j < xCount; j++) {
        // A deactivated variable is not used by the model: never let it block a run.
        if (!activeX[j]) {
          row.push(null);
          continue;
        }
        const xRaw = (cells[i][j + 1] ?? '').trim();
        if (xRaw === '' || xRaw.startsWith('#')) {
          row.push(null); // blank or Excel artifact = missing; handled per the selected mode
          continue;
        }
        const xv = toNumber(xRaw, numberFormat);
        if (!Number.isFinite(xv)) {
          setError(`Linha ${i + 1}, ${xLabels[j] || `X${j + 1}`}: valor invalido.`);
          return;
        }
        row.push(xv);
      }
      x.push(row);
    }
    const activeIdx = activeX.map((on, j) => (on ? j : -1)).filter((j) => j >= 0);
    if (activeIdx.length === 0) {
      setError('Selecione ao menos uma variavel X.');
      return;
    }
    const dataset = {
      yLabel: yLabel.trim() || 'Y',
      xLabels: xLabels.map((l, i) => l.trim() || `X${i + 1}`),
      periods: Array.from({ length: n }, (_, i) => periods[i]?.trim() || `M${i + 1}`),
      y,
      x,
    };
    const modelConfig = { activeX: activeIdx, trainRatio, missingMode };
    setLoading(true);
    fetch('/api/regress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset, modelConfig }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Erro ao calcular.');
        setResult(json as FitResponse);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">MMM Studio</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Marketing Mix Modeling por regressao linear multipla. Cole os dados mensais, escolha as
          variaveis e rode o modelo.
        </p>
      </header>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2 no-print">
        <Btn onClick={loadExample} variant="primary" testid="load-example">
          Carregar exemplo
        </Btn>
        <Btn onClick={clearAll} testid="clear">Limpar</Btn>
        <Btn onClick={() => fileRef.current?.click()}>Importar CSV</Btn>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleCsv(f);
            e.target.value = '';
          }}
        />
        <select
          value={numberFormat}
          onChange={(e) => setNumberFormat(e.target.value as NumberFormat)}
          title="Como interpretar os numeros (separador de milhar e decimal)"
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 outline-none hover:bg-zinc-800"
        >
          <option value="auto">Numeros: Auto</option>
          <option value="br">Numeros: 1.234,56</option>
          <option value="us">Numeros: 1,234.56</option>
        </select>
        <span className="mx-1 h-5 w-px bg-zinc-800" />
        <Btn onClick={addCol}>+ coluna X</Btn>
        <Btn onClick={removeCol}>- coluna X</Btn>
        <Btn onClick={addRow}>+ linha</Btn>
        <Btn onClick={removeRow}>- linha</Btn>
        <span className="ml-auto text-xs text-zinc-500">
          {n} linhas, {xCount} variaveis. Cole do Excel em qualquer celula (a tabela cria linhas e colunas sozinha). Clique nos titulos para renomear.
        </span>
      </div>

      {/* Grid */}
      <div className="max-h-[420px] overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/40 no-print">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-900">
            <tr>
              <th className="border-b border-zinc-800 px-2 py-2 text-left text-xs font-medium text-zinc-400">Periodo</th>
              <th className="border-b border-zinc-800 px-1 py-1.5 text-left">
                <input
                  value={yLabel}
                  onChange={(e) => setYLabel(e.target.value)}
                  title="Clique para renomear"
                  className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-left text-xs font-semibold text-cyan-300 outline-none hover:border-zinc-700 focus:border-indigo-500"
                />
              </th>
              {xLabels.map((lbl, j) => (
                <th key={j} className="border-b border-zinc-800 px-1 py-1.5 text-left">
                  <input
                    value={lbl}
                    onChange={(e) => setXLabel(j, e.target.value)}
                    title="Clique para renomear"
                    className={`w-28 rounded border border-transparent bg-transparent px-1 py-0.5 text-left text-xs font-semibold outline-none hover:border-zinc-700 focus:border-indigo-500 ${activeX[j] ? 'text-zinc-200' : 'text-zinc-600 line-through'}`}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cells.map((row, r) => (
              <tr key={r} className="odd:bg-zinc-900/20">
                <td className="px-1 py-0.5">
                  <input
                    value={periods[r] ?? `M${r + 1}`}
                    onChange={(e) => setPeriod(r, e.target.value)}
                    title="Clique para renomear o periodo"
                    className="w-20 rounded border border-transparent bg-transparent px-1.5 py-1 text-left text-xs text-zinc-500 outline-none hover:border-zinc-700 focus:border-indigo-500"
                  />
                </td>
                {row.map((val, c) => (
                  <td key={c} className="px-1 py-0.5">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={val}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      onPaste={(e) => handlePaste(e, r, c)}
                      className={`w-24 rounded border border-transparent bg-transparent px-1.5 py-1 text-right tabular-nums outline-none hover:border-zinc-700 focus:border-indigo-500 ${c === 0 ? 'text-cyan-200' : 'text-zinc-200'} ${c > 0 && !activeX[c - 1] ? 'opacity-40' : ''}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Controls */}
      <div className="mt-4 grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:grid-cols-2 lg:grid-cols-3 no-print">
        <div>
          <div className="mb-2 text-sm font-medium text-zinc-200">Divisao treino / teste</div>
          <input
            type="range"
            min={0.5}
            max={0.9}
            step={0.05}
            value={trainRatio}
            onChange={(e) => setTrainRatio(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <div className="mt-1 text-xs text-zinc-400">
            {Math.round(trainRatio * 100)}% treino: <span className="text-zinc-200">{trainCount}</span> linhas de treino,{' '}
            <span className="text-zinc-200">{n - trainCount}</span> de teste.
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-zinc-200">Variaveis ativas</div>
          <div className="flex flex-wrap gap-2">
            {xLabels.map((lbl, j) => (
              <label
                key={j}
                className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm ${activeX[j] ? 'border-indigo-600/60 bg-indigo-950/40 text-indigo-200' : 'border-zinc-700 bg-zinc-900 text-zinc-500'}`}
              >
                <input type="checkbox" checked={activeX[j]} onChange={() => toggleX(j)} className="accent-indigo-500" />
                {lbl || `X${j + 1}`}
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-zinc-200">Valores em branco (faltantes)</div>
          <div className="inline-flex rounded-lg border border-zinc-700 p-0.5">
            <button
              type="button"
              onClick={() => setMissingMode('drop')}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${missingMode === 'drop' ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:text-zinc-100'}`}
            >
              Ignorar a linha
            </button>
            <button
              type="button"
              onClick={() => setMissingMode('zero')}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${missingMode === 'zero' ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:text-zinc-100'}`}
            >
              Tratar como zero
            </button>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Em branco = sem dado (a linha sai do calculo). Digite 0 quando o valor for realmente zero.
          </p>
        </div>
      </div>

      {/* Run */}
      <div className="mt-4 flex items-center gap-3 no-print">
        <Btn onClick={run} variant="primary" testid="run">
          {loading ? 'Calculando...' : 'Rodar modelo'}
        </Btn>
        {error ? <span className="text-sm text-red-400" data-testid="error">{error}</span> : null}
      </div>

      {/* Results */}
      {result ? (
        <div className="mt-8">
          <Results result={result} />
        </div>
      ) : (
        <div className="mt-8 rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
          Carregue o exemplo ou cole seus dados e clique em Rodar modelo para ver coeficientes, contribuicao, validacao e o simulador.
        </div>
      )}

      <footer className="mt-10 border-t border-zinc-900 pt-4 text-xs text-zinc-600">
        MMM Studio: regressao linear multipla (OLS) com divisao treino/teste, contribuicao por variavel, diagnostico VIF e simulador.
      </footer>
    </div>
  );
}
