export function ValuationSummary({
  base,
  bull,
  bear,
}: {
  base: number;
  bull: number;
  bear: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[{ label: "Base", value: base }, { label: "Bull", value: bull }, { label: "Bear", value: bear }].map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">{item.label} Fair Value</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">${item.value.toFixed(2)}</p>
        </div>
      ))}
    </div>
  );
}
