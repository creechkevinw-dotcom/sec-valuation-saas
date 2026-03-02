import type { MonteCarloBin, MonteCarloResult, ProjectionYear } from "@/types/valuation";

type MonteCarloInputs = {
  projections: ProjectionYear[];
  cash: number;
  debt: number;
  sharesOutstanding: number;
  baseWacc: number;
  baseTerminalGrowth: number;
  iterations?: number;
  seed?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function stringToSeed(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed: number) {
  let state = seed || 123456789;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomNormal(rand: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const weight = idx - lo;
  return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

function buildHistogram(values: number[], bins = 10): MonteCarloBin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max <= min) {
    return [{ start: min, end: max, count: values.length }];
  }

  const width = (max - min) / bins;
  const counts = new Array<number>(bins).fill(0);
  for (const value of values) {
    const pos = clamp(Math.floor((value - min) / width), 0, bins - 1);
    counts[pos] += 1;
  }

  return counts.map((count, index) => ({
    start: min + index * width,
    end: min + (index + 1) * width,
    count,
  }));
}

export function runMonteCarlo(inputs: MonteCarloInputs): MonteCarloResult {
  const iterations = clamp(inputs.iterations ?? 2000, 500, 10000);
  const seed = stringToSeed(inputs.seed ?? "default-seed");
  const rand = createRng(seed);

  const baseGrowths = inputs.projections.map((row, index) => {
    if (index === 0) return 0.06;
    const prev = inputs.projections[index - 1].revenue;
    return prev > 0 ? row.revenue / prev - 1 : 0.04;
  });
  const baseMargins = inputs.projections.map((row) => row.fcfMargin);
  const startRevenue = inputs.projections[0]?.revenue ?? 0;

  const results: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    let revenue = startRevenue;
    let pvFcf = 0;
    const wacc = clamp(inputs.baseWacc + randomNormal(rand) * 0.012, 0.07, 0.14);
    const terminalGrowth = clamp(inputs.baseTerminalGrowth + randomNormal(rand) * 0.004, 0.015, 0.035);

    for (let year = 0; year < inputs.projections.length; year += 1) {
      const fade = 1 - year / Math.max(1, inputs.projections.length - 1);
      const growthShock = randomNormal(rand) * 0.035 * fade;
      const marginShock = randomNormal(rand) * 0.025 * fade;
      const growth = clamp(baseGrowths[year] + growthShock, -0.1, 0.3);
      const margin = clamp(baseMargins[year] + marginShock, 0.03, 0.45);

      revenue *= 1 + growth;
      const fcf = revenue * margin;
      pvFcf += fcf / Math.pow(1 + wacc, year + 1);
    }

    const terminalFcf = revenue * clamp(baseMargins[baseMargins.length - 1] + randomNormal(rand) * 0.01, 0.04, 0.45);
    const terminalValue =
      wacc > terminalGrowth
        ? (terminalFcf * (1 + terminalGrowth)) / (wacc - terminalGrowth)
        : terminalFcf * 12;

    const pvTerminal = terminalValue / Math.pow(1 + wacc, inputs.projections.length);
    const enterpriseValue = pvFcf + pvTerminal;
    const equityValue = enterpriseValue + inputs.cash - inputs.debt;
    const perShare = equityValue / Math.max(1, inputs.sharesOutstanding);
    if (Number.isFinite(perShare) && perShare > 0) {
      results.push(perShare);
    }
  }

  const sorted = [...results].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / Math.max(1, sorted.length);

  return {
    iterations,
    successRate: Number((sorted.length / iterations).toFixed(4)),
    p10: Number(percentile(sorted, 0.1).toFixed(2)),
    p50: Number(percentile(sorted, 0.5).toFixed(2)),
    p90: Number(percentile(sorted, 0.9).toFixed(2)),
    mean: Number(mean.toFixed(2)),
    min: Number((sorted[0] ?? 0).toFixed(2)),
    max: Number((sorted[sorted.length - 1] ?? 0).toFixed(2)),
    histogram: buildHistogram(sorted, 12),
  };
}
