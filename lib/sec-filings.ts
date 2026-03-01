import { SEC_BASE_URL, SEC_USER_AGENT } from "@/lib/env";

type SubmissionsRecent = {
  accessionNumber: string[];
  filingDate: string[];
  reportDate: Array<string | null>;
  form: string[];
  primaryDocument: string[];
  primaryDocDescription: string[];
};

type SubmissionsResponse = {
  name: string;
  cik: string;
  filings?: {
    recent?: SubmissionsRecent;
  };
};

export type FilingDocument = {
  form: string;
  accessionNumber: string;
  filingDate: string;
  reportDate?: string | null;
  primaryDocument: string;
  primaryDocDescription?: string;
  documentUrl: string;
  filingFolderUrl: string;
};

function secHeaders() {
  return {
    "User-Agent": SEC_USER_AGENT,
    Accept: "application/json",
  };
}

async function fetchSubmissions(cik: string): Promise<SubmissionsResponse> {
  const res = await fetch(`${SEC_BASE_URL}/submissions/CIK${cik}.json`, {
    headers: secHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`SEC submissions fetch failed (${res.status}) for CIK${cik}`);
  }
  return (await res.json()) as SubmissionsResponse;
}

function normalizeCikForArchive(cik: string): string {
  return String(Number(cik));
}

function toFilingDocs(cik: string, recent: SubmissionsRecent): FilingDocument[] {
  const cikArchive = normalizeCikForArchive(cik);
  const len = recent.form.length;
  const docs: FilingDocument[] = [];

  for (let i = 0; i < len; i += 1) {
    const accessionNumber = recent.accessionNumber[i];
    const accessionNoDashes = accessionNumber?.replace(/-/g, "");
    const primaryDocument = recent.primaryDocument[i];
    if (!accessionNumber || !accessionNoDashes || !primaryDocument) {
      continue;
    }

    const filingFolderUrl = `https://www.sec.gov/Archives/edgar/data/${cikArchive}/${accessionNoDashes}/`;
    const documentUrl = `${filingFolderUrl}${primaryDocument}`;

    docs.push({
      form: recent.form[i],
      accessionNumber,
      filingDate: recent.filingDate[i],
      reportDate: recent.reportDate[i],
      primaryDocument,
      primaryDocDescription: recent.primaryDocDescription[i],
      documentUrl,
      filingFolderUrl,
    });
  }

  return docs.sort((a, b) => b.filingDate.localeCompare(a.filingDate));
}

export async function fetchLatestFilings(cik: string) {
  const submissions = await fetchSubmissions(cik);
  const recent = submissions.filings?.recent;
  if (!recent) {
    return {
      latest10K: null,
      latest10Q: null,
      recent10k10q: [] as FilingDocument[],
    };
  }

  const docs = toFilingDocs(cik, recent).filter((doc) =>
    ["10-K", "10-K/A", "10-Q", "10-Q/A"].includes(doc.form),
  );

  const latest10K = docs.find((d) => d.form.startsWith("10-K")) ?? null;
  const latest10Q = docs.find((d) => d.form.startsWith("10-Q")) ?? null;

  return {
    latest10K,
    latest10Q,
    recent10k10q: docs.slice(0, 8),
  };
}
