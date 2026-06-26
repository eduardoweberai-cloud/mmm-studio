'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { FitResponse } from '@/lib/stats/types';
import { predictY } from '@/lib/stats';
import { buildResultCsv } from '@/lib/export';

const PALETTE = ['#6366f1', '#22d3ee', '#f59e0b', '#ec4899', '#10b981', '#a78bfa', '#f43f5e', '#84cc16'];

function fmt(v: number | null | undefined, d = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '--';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fF(v: number | null | undefined): string {
  if (v === null || v === undefined) return '--';
  if (!Number.isFinite(v)) return '∞';
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

function fP(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '--';
  if (v < 0.0001) return '< 0,0001';
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 4, minimumFractionDigits: 0 });
}

function Card({
  label,
  value,
  hint,
  testid,
  valueClass,
}: {
  label: string;
  value: string;
  hint?: string;
  testid?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4" data-testid={testid}>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${valueClass ?? 'text-zinc-50'}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-zinc-500">{hint}</div> : null}
    </div>
  );
}

export default function Results({ result }: { result: FitResponse }) {
  const { model, validation } = result;
  const betas = model.coefficients.map((c) => c.beta);
  const [sim, setSim] = useState<string[]>(model.coefficients.map(() => ''));
  const simY = predictY(model.intercept.beta, betas, sim.map((s) => Number(s.replace(',', '.')) || 0));

  const contribData = model.contributions.map((c) => ({ name: c.label, pct: Number(c.pct.toFixed(2)) }));
  const valData = validation.rows.map((r, i) => ({
    name: r.period ?? `T${i + 1}`,
    Real: Number(r.actual.toFixed(2)),
    Previsto: Number(r.predicted.toFixed(2)),
  }));

  function exportCsv() {
    const csv = buildResultCsv(result, new Date().toLocaleString('pt-BR'));
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mmm-studio-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  function exportPdf() {
    window.print();
  }

  return (
    <div className="flex flex-col gap-6" data-testid="results">
      <div className="print-only">
        <h1 className="text-xl font-bold text-zinc-50">MMM Studio - Relatorio</h1>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <h2 className="text-lg font-semibold text-zinc-100">Resultados</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportCsv}
            data-testid="export-csv"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Exportar Excel (CSV)
          </button>
          <button
            type="button"
            onClick={exportPdf}
            data-testid="export-pdf"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Exportar PDF
          </button>
        </div>
      </div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card label="R²" value={fmt(model.r2, 4)} hint="ajuste no treino" />
        <Card label="R² ajustado" value={model.adjR2 === null ? '--' : fmt(model.adjR2, 4)} />
        <Card label="F" value={fF(model.fStat)} hint="teste global do modelo" />
        <Card
          label="Significancia F"
          value={fP(model.fPValue)}
          hint="p < 0,05 = significativo"
          testid="f-test"
          valueClass={
            model.fPValue === null
              ? 'text-zinc-50'
              : model.fPValue < 0.05
                ? 'text-emerald-400'
                : 'text-amber-400'
          }
        />
        <Card label="Treino / Teste" value={`${model.n} / ${validation.rows.length}`} hint="linhas" />
        <Card label="Graus de liberdade" value={String(model.degreesOfFreedom)} hint={`${model.k} variaveis`} />
      </div>

      {/* Warnings */}
      {model.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-700/50 bg-amber-950/40 p-4" data-testid="warnings">
          <div className="mb-2 text-sm font-semibold text-amber-300">Avisos do modelo</div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-200/90">
            {model.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Coefficients */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-200">Coeficientes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-2 py-1">Variavel</th>
                <th className="px-2 py-1 text-right">Coeficiente</th>
                <th className="px-2 py-1 text-right">Erro padrao</th>
                <th className="px-2 py-1 text-right">t</th>
                <th className="px-2 py-1 text-right">p-valor</th>
                <th className="px-2 py-1 text-center">Sig.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {[model.intercept, ...model.coefficients].map((c, i) => (
                <tr key={i} className="text-zinc-200">
                  <td className="px-2 py-1.5 font-medium">{c.label}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmt(c.beta, 4)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-zinc-400">{fmt(c.stdErr, 4)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-zinc-400">{fmt(c.tStat, 3)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-zinc-400">{fmt(c.pValue, 4)}</td>
                  <td className="px-2 py-1.5 text-center">{c.significant ? <span className="text-emerald-400">●</span> : <span className="text-zinc-600">○</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-500">● = significativo a 5% (p &lt; 0,05).</p>
      </section>

      {/* Contribution + Validation charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-200">Contribuicao por variavel (%)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={contribData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} unit="%" />
                <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, color: '#e4e4e7' }} />
                <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                  {contribData.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-zinc-500">Participacao de cada variavel no sinal explicado (nao e decomposicao de variancia).</p>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-200">Validacao: real vs previsto (teste)</h3>
          {valData.length > 0 ? (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={valData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
                    <YAxis stroke="#71717a" fontSize={12} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, color: '#e4e4e7' }} />
                    <Legend />
                    <Line type="monotone" dataKey="Real" stroke="#22d3ee" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Previsto" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <Card label="MAPE" value={validation.mape === null ? '--' : `${fmt(validation.mape * 100, 1)}%`} />
                <Card label="RMSE" value={fmt(validation.rmse, 1)} />
                <Card label="R² teste" value={validation.testR2 === null ? '--' : fmt(validation.testR2, 4)} />
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500">Sem linhas de teste (aumente os dados ou reduza o % de treino).</p>
          )}
        </section>
      </div>

      {/* VIF + Simulator */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-200">Diagnostico de multicolinearidade (VIF)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-2 py-1">Variavel</th>
                <th className="px-2 py-1 text-right">VIF</th>
                <th className="px-2 py-1 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {model.vif.map((v, i) => (
                <tr key={i} className="text-zinc-200">
                  <td className="px-2 py-1.5 font-medium">{v.label}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{Number.isFinite(v.value) ? fmt(v.value, 2) : '∞'}</td>
                  <td className="px-2 py-1.5 text-right">
                    {v.high ? <span className="text-amber-400">alto</span> : <span className="text-emerald-400">ok</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-zinc-500">VIF &gt; 5 sugere correlacao alta entre variaveis.</p>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4" data-testid="simulator">
          <h3 className="mb-3 text-sm font-semibold text-zinc-200">Simulador de previsao</h3>
          <p className="mb-3 text-xs text-zinc-500">Informe valores hipoteticos das variaveis e veja a previsao de Y.</p>
          <div className="grid gap-2">
            {model.coefficients.map((c, j) => (
              <label key={j} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-300">{c.label}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={sim[j]}
                  onChange={(e) => {
                    const next = [...sim];
                    next[j] = e.target.value;
                    setSim(next);
                  }}
                  className="w-40 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-right text-zinc-100 outline-none focus:border-indigo-500"
                  placeholder="0"
                />
              </label>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-indigo-700/40 bg-indigo-950/30 p-3">
            <div className="text-xs uppercase tracking-wide text-indigo-300">Y previsto</div>
            <div className="mt-1 text-2xl font-semibold text-indigo-100" data-testid="sim-output">{fmt(simY, 2)}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
