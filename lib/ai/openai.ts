import { z } from "zod";

const aiResponseSchema = z.object({
  conviction: z.enum(["low", "medium", "high"]),
  conviction_reasoning: z.array(z.string()).min(1),
  profitability_summary: z.string(),
  growth_summary: z.string(),
  cash_flow_summary: z.string(),
  balance_sheet_summary: z.string(),
  liquidity_summary: z.string(),
  risks: z.array(z.string()),
  strengths: z.array(z.string()),
  what_would_change_view: z.array(z.string()),
  trade_scenarios: z.array(z.string()),
  missing_data: z.array(z.string()),
  disclaimer: z.string(),
});

export type AiCompanyAnalysis = z.infer<typeof aiResponseSchema>;

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-4.1-mini";
const ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "conviction",
    "conviction_reasoning",
    "profitability_summary",
    "growth_summary",
    "cash_flow_summary",
    "balance_sheet_summary",
    "liquidity_summary",
    "risks",
    "strengths",
    "what_would_change_view",
    "trade_scenarios",
    "missing_data",
    "disclaimer",
  ],
  properties: {
    conviction: { type: "string", enum: ["low", "medium", "high"] },
    conviction_reasoning: { type: "array", items: { type: "string" } },
    profitability_summary: { type: "string" },
    growth_summary: { type: "string" },
    cash_flow_summary: { type: "string" },
    balance_sheet_summary: { type: "string" },
    liquidity_summary: { type: "string" },
    risks: { type: "array", items: { type: "string" } },
    strengths: { type: "array", items: { type: "string" } },
    what_would_change_view: { type: "array", items: { type: "string" } },
    trade_scenarios: { type: "array", items: { type: "string" } },
    missing_data: { type: "array", items: { type: "string" } },
    disclaimer: { type: "string" },
  },
} as const;

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue to extraction fallbacks
  }

  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return JSON.parse(fencedMatch[1]);
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function callOpenAi({
  apiKey,
  payload,
  timeoutMs = 20_000,
}: {
  apiKey: string;
  payload: unknown;
  timeoutMs?: number;
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI API ${res.status}: ${text}`);
    }

    const json = (await res.json()) as {
      output_text?: string;
      output?: Array<{
        type?: string;
        content?: Array<{ type?: string; text?: string }>;
      }>;
      content?: Array<{ type?: string; text?: string }>;
      choices?: Array<{ message?: { content?: string } }>;
    };

    if (json.output_text && typeof json.output_text === "string") {
      return json.output_text;
    }

    if (Array.isArray(json.output)) {
      const chunks = json.output.flatMap((item) =>
        Array.isArray(item.content)
          ? item.content
              .map((c) => (typeof c.text === "string" ? c.text : ""))
              .filter((t) => t.length > 0)
          : [],
      );
      if (chunks.length > 0) {
        return chunks.join("\n");
      }
    }

    if (Array.isArray(json.content)) {
      const chunks = json.content
        .map((c) => (typeof c.text === "string" ? c.text : ""))
        .filter((t) => t.length > 0);
      if (chunks.length > 0) {
        return chunks.join("\n");
      }
    }

    const choiceText = json.choices?.[0]?.message?.content;
    if (choiceText && typeof choiceText === "string") {
      return choiceText;
    }

    throw new Error("OpenAI response contained no parseable text payload");
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeCompanyData(input: {
  ticker: string;
  companyName: string;
  cik: string;
  reportData: unknown;
  newsEnabled: boolean;
  maxRetries?: number;
}): Promise<AiCompanyAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const maxRetries = input.maxRetries ?? 2;
  const systemPrompt =
    "You are a conservative financial analyst. Analyze only provided data. Never invent numbers or facts. If inputs are missing, list them in missing_data. Output strict JSON only.";

  const userPrompt = JSON.stringify(
    {
      task: "Produce structured financial analysis from provided valuation report data.",
      required_output_shape: {
        conviction: "low|medium|high",
        conviction_reasoning: ["string"],
        profitability_summary: "string",
        growth_summary: "string",
        cash_flow_summary: "string",
        balance_sheet_summary: "string",
        liquidity_summary: "string",
        risks: ["string"],
        strengths: ["string"],
        what_would_change_view: ["string"],
        trade_scenarios: ["string"],
        missing_data: ["string"],
        disclaimer: "string",
      },
      constraints: [
        "No hype or guarantees",
        "No fabricated financial values",
        "State uncertainty explicitly",
        "Professional analyst tone",
      ],
      context: {
        ticker: input.ticker,
        companyName: input.companyName,
        cik: input.cik,
        newsEnabled: input.newsEnabled,
        reportData: input.reportData,
      },
    },
    null,
    2,
  );

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const outputText = await callOpenAi({
        apiKey,
        payload: {
          model: MODEL,
          input: [
            { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
            { role: "user", content: [{ type: "input_text", text: userPrompt }] },
          ],
          max_output_tokens: 900,
          text: {
            format: {
              type: "json_schema",
              name: "company_analysis",
              schema: ANALYSIS_JSON_SCHEMA,
              strict: true,
            },
          },
        },
      });

      const parsed = parseJsonObject(outputText);
      return aiResponseSchema.parse(parsed);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("AI analysis failed");
}
