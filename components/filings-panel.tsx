type FilingDoc = {
  form: string;
  filingDate: string;
  reportDate?: string | null;
  primaryDocDescription?: string;
  documentUrl: string;
};

export function FilingsPanel({
  latest10K,
  latest10Q,
  recent,
  quality,
}: {
  latest10K: FilingDoc | null;
  latest10Q: FilingDoc | null;
  recent: FilingDoc[];
  quality: { historyYears: number; has10K: boolean; has10Q: boolean; score: number };
}) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-900">SEC Filing Audit Trail</h3>
        <p className="text-sm text-slate-600">Data Quality Score: {quality.score}/100</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Latest 10-K</p>
          {latest10K ? (
            <a href={latest10K.documentUrl} target="_blank" rel="noreferrer" className="mt-1 block text-sm font-medium text-sky-700 underline">
              {latest10K.form} filed {latest10K.filingDate}
            </a>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Not available in recent submissions.</p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Latest 10-Q</p>
          {latest10Q ? (
            <a href={latest10Q.documentUrl} target="_blank" rel="noreferrer" className="mt-1 block text-sm font-medium text-sky-700 underline">
              {latest10Q.form} filed {latest10Q.filingDate}
            </a>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Not available in recent submissions.</p>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-slate-500">
              <th className="pb-2">Form</th>
              <th className="pb-2">Filing Date</th>
              <th className="pb-2">Report Date</th>
              <th className="pb-2">Document</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((doc) => (
              <tr key={`${doc.form}-${doc.filingDate}-${doc.documentUrl}`} className="border-t border-slate-100">
                <td className="py-2">{doc.form}</td>
                <td className="py-2">{doc.filingDate}</td>
                <td className="py-2">{doc.reportDate ?? "-"}</td>
                <td className="py-2">
                  <a href={doc.documentUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline">
                    {doc.primaryDocDescription || "Open filing"}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
