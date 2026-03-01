import { z } from "zod";
import type {
  DeterministicRecommendation,
  DeterministicSignal,
  EarningsSnapshot,
  FundamentalSnapshot,
  MarketSnapshot,
  OptionsSnapshot,
  TechnicalSnapshot,
} from "@/lib/trade/types";

const schema = z.object({
  shortTermTrade: z.string(),
  longTermTrade: z.string(),
  optionsStrategy: z.string(),
  riskFactors: z.array(z.string()),
  confidenceAdjustment: z.number().min(-5).max(5),
});

type ExplainResult = z.infer<typeof schema>;

function extractNumbers(text: string): number[] {
  const matches = text.match(/-?\d+(?:\.\d+)?/g) ?? [];
  return matches.map(Number).filter((n) => Number.isFinite(n));
}

function numbersAreSubset(generated: number[], allowed: number[]) {
  const roundedAllowed = new Set(allowed.map((n) => Number(n.toFixed(4))));
  return generated.every((n) => roundedAllowed.has(Number(n.toFixed(4))));
}

export async function explainRecommendation(input: {
  marketSnapshot: MarketSnapshot;
  technicalSnapshot: TechnicalSnapshot;
  fundamentalSnapshot: FundamentalSnapshot;
  optionsSnapshot: OptionsSnapshot;
  deterministicSignal: DeterministicSignal;
  deterministicRecommendation: DeterministicRecommendation;
  confidenceScore: number;
  earningsData: EarningsSnapshot;
}): Promise<ExplainResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                'You are a quantitative trade explanation engine. Use only provided JSON values. Never introduce new numbers. If insufficient data, return "INSUFFICIENT_DATA" in all narrative fields.',
            },
          ],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: JSON.stringify(input) }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "trade_explanation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["shortTermTrade", "longTermTrade", "optionsStrategy", "riskFactors", "confidenceAdjustment"],
            properties: {
              shortTermTrade: { type: "string" },
              longTermTrade: { type: "string" },
              optionsStrategy: { type: "string" },
              riskFactors: { type: "array", items: { type: "string" } },
              confidenceAdjustment: { type: "number", minimum: -5, maximum: 5 },
            },
          },
        },
      },
      max_output_tokens: 500,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI API ${res.status}`);
  }
  const json = (await res.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };

  const outputText =
    json.output_text ??
    json.output?.flatMap((o) => o.content?.map((c) => c.text ?? "") ?? []).join("\n") ??
    "";
  if (!outputText) {
    throw new Error("Empty AI explanation payload");
  }
  const parsed = schema.parse(JSON.parse(outputText));

  const allowedNumbers: number[] = [
    input.marketSnapshot.price,
    input.marketSnapshot.bid,
    input.marketSnapshot.ask,
    input.marketSnapshot.spreadPct,
    input.technicalSnapshot.rsi14,
    input.technicalSnapshot.atr14,
    input.deterministicSignal.technicalScore,
    input.deterministicSignal.fundamentalScore,
    input.deterministicSignal.liquidityScore,
    input.confidenceScore,
    input.deterministicRecommendation.shortTermTrade?.entry ?? 0,
    input.deterministicRecommendation.shortTermTrade?.target ?? 0,
    input.deterministicRecommendation.shortTermTrade?.stop ?? 0,
    input.deterministicRecommendation.longTermTrade?.entry ?? 0,
    input.deterministicRecommendation.longTermTrade?.target ?? 0,
    input.deterministicRecommendation.longTermTrade?.stop ?? 0,
  ];

  const generatedNumbers = extractNumbers(
    [parsed.shortTermTrade, parsed.longTermTrade, parsed.optionsStrategy, ...parsed.riskFactors].join(" "),
  );
  if (!numbersAreSubset(generatedNumbers, allowedNumbers)) {
    throw new Error("AI numeric mismatch with deterministic inputs");
  }

  return parsed;
}
