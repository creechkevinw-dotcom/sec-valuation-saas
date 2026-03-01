type Cell = {
  wacc: number;
  terminalGrowth: number;
  fairValuePerShare: number;
};

export function SensitivityTable({ rows }: { rows: Cell[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Sensitivity (WACC x Terminal Growth)</h3>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-slate-500">
            <th className="pb-2">WACC</th>
            <th className="pb-2">Terminal Growth</th>
            <th className="pb-2">Fair Value/Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.wacc}-${row.terminalGrowth}`} className="border-t border-slate-100">
              <td className="py-2">{(row.wacc * 100).toFixed(2)}%</td>
              <td className="py-2">{(row.terminalGrowth * 100).toFixed(2)}%</td>
              <td className="py-2">${row.fairValuePerShare.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
