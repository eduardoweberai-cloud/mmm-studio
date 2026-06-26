import { NextResponse } from 'next/server';
import { fit } from '@/lib/stats';
import type { Dataset, ModelConfig } from '@/lib/stats/types';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      dataset?: Dataset;
      modelConfig?: ModelConfig;
    };
    const dataset = body.dataset;
    const modelConfig = body.modelConfig;

    if (
      !dataset ||
      !Array.isArray(dataset.y) ||
      !Array.isArray(dataset.x) ||
      !modelConfig
    ) {
      return NextResponse.json({ error: 'Dados invalidos.' }, { status: 400 });
    }
    if (dataset.y.length < 3) {
      return NextResponse.json(
        { error: 'Informe pelo menos 3 linhas de dados.' },
        { status: 400 },
      );
    }
    const result = fit(dataset, modelConfig);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? 'Erro ao calcular o modelo.' },
      { status: 400 },
    );
  }
}
