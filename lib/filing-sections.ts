import type { FilingDocument } from "@/types/valuation";

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAroundHeading(text: string, patterns: RegExp[], maxLen = 2200): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match || match.index < 0) continue;

    const start = match.index;
    const end = Math.min(text.length, start + maxLen);
    return text.slice(start, end).trim();
  }
  return null;
}

async function fetchFilingText(url?: string | null): Promise<string | null> {
  if (!url) return null;
  const res = await fetch(url, {
    headers: {
      "User-Agent": process.env.SEC_USER_AGENT ?? "sec-valuation-saas/1.0 support@example.com",
      Accept: "text/html,application/xhtml+xml,application/xml",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const raw = await res.text();
  return stripHtml(raw);
}

export async function extractFilingSections(input: {
  latest10K: FilingDocument | null;
  latest10Q: FilingDocument | null;
}) {
  const [kText, qText] = await Promise.all([
    fetchFilingText(input.latest10K?.documentUrl),
    fetchFilingText(input.latest10Q?.documentUrl),
  ]);

  const mdnaPatterns = [
    /item\s+7\.?\s+management['’]s\s+discussion\s+and\s+analysis/i,
    /management['’]s\s+discussion\s+and\s+analysis/i,
  ];
  const riskPatterns = [
    /item\s+1a\.?\s+risk\s+factors/i,
    /risk\s+factors/i,
  ];
  const segmentPatterns = [
    /segment\s+information/i,
    /business\s+segments/i,
    /reportable\s+segments/i,
  ];

  return {
    latest10kMdna: kText ? extractAroundHeading(kText, mdnaPatterns) : null,
    latest10kRiskFactors: kText ? extractAroundHeading(kText, riskPatterns) : null,
    latest10kSegmentNotes: kText ? extractAroundHeading(kText, segmentPatterns) : null,
    latest10qMdna: qText ? extractAroundHeading(qText, mdnaPatterns) : null,
    latest10qRiskFactors: qText ? extractAroundHeading(qText, riskPatterns) : null,
    latest10qSegmentNotes: qText ? extractAroundHeading(qText, segmentPatterns) : null,
  };
}
