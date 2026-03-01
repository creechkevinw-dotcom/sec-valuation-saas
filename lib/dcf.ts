import type { DcfScenarioResult, ProjectionYear, ScenarioName, SensitivityCell } from "@/types/valuation";

type DcfInputs = {
  projections: ProjectionYear[];
  cash: number;
  debt: number;
  sharesOutstanding: number;
};

type ScenarioConfig = {
  name: ScenarioName;
  growthAdjust: number;
  marginAdjust: number;
  wacc: number;
  terminalGrowth: number;
};

const SCENARIOS: ScenarioConfig[] = [
  { name: "base", growthAdjust: 0, marginAdjust: 0, wacc: 0.095, terminalGrowth: 0.025 },
  { name: "bull", growthAdjust: 0.02, marginAdjust: 0.01, wacc: 0.085, terminalGrowth: 0.03 },
  { name: "bear", growthAdjust: -0.02, marginAdjust: -0.01, wacc: 0.11, terminalGrowth: 0.02 },
];

function discount(value: number, rate: number, year: number) {
  return value / Math.pow(1 + rate, year);
}

export function runScenario(inputs: DcfInputs, config: ScenarioConfig): DcfScenarioResult {
  const adjusted = inputs.projections.map((row, index) => {
    const prior = index === 0 ? row.revenue : inputs.projections[index - 1].revenue;
    const growth = prior > 0 ? row.revenue / prior - 1 : 0;
    const adjRevenue = row.revenue * (1 + config.growthAdjust * (1 - index / inputs.projections.length));
    const adjMargin = Math.max(0.03, row.fcfMargin + config.marginAdjust * (1 - index / inputs.projections.length));
    const adjFcf = adjRevenue * adjMargin * (1 + growth * 0.15);
    return { ...row, revenue: adjRevenue, fcf: adjFcf, fcfMargin: adjMargin };
  });

  const pvFcf = adjusted.reduce((sum, row, i) => sum + discount(row.fcf, config.wacc, i + 1), 0);
  const terminalFcf = adjusted[adjusted.length - 1]?.fcf ?? 0;
  const terminalValue =
    config.wacc > config.terminalGrowth
      ? (terminalFcf * (1 + config.terminalGrowth)) / (config.wacc - config.terminalGrowth)
      : terminalFcf * 12;

  const pvTerminal = discount(terminalValue, config.wacc, adjusted.length);
  const enterpriseValue = pvFcf + pvTerminal;
  const equityValue = enterpriseValue + inputs.cash - inputs.debt;
  const fairValuePerShare = equityValue / Math.max(1, inputs.sharesOutstanding);

  return {
    scenario: config.name,
    enterpriseValue,
    equityValue,
    fairValuePerShare,
    wacc: config.wacc,
    terminalGrowth: config.terminalGrowth,
  };
}

export function runDCF(inputs: DcfInputs) {
  const base = runScenario(inputs, SCENARIOS[0]);
  const bull = runScenario(inputs, SCENARIOS[1]);
  const bear = runScenario(inputs, SCENARIOS[2]);

  return { base, bull, bear };
}

export function buildSensitivityTable(
  inputs: DcfInputs,
  waccCenter: number,
  growthCenter: number,
): SensitivityCell[] {
  const waccValues = [waccCenter - 0.01, waccCenter, waccCenter + 0.01];
  const growthValues = [growthCenter - 0.005, growthCenter, growthCenter + 0.005];

  const rows: SensitivityCell[] = [];
  for (const wacc of waccValues) {
    for (const terminalGrowth of growthValues) {
      const scenario = runScenario(inputs, {
        name: "base",
        growthAdjust: 0,
        marginAdjust: 0,
        wacc,
        terminalGrowth,
      });
      rows.push({
        wacc,
        terminalGrowth,
        fairValuePerShare: scenario.fairValuePerShare,
      });
    }
  }

  return rows;
}
