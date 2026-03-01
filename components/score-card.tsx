export function ScoreCard({ score }: { score: number }) {
  const tone = score >= 75 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-rose-600";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">Financial Health Score</p>
      <p className={`mt-2 text-4xl font-semibold ${tone}`}>{score}</p>
      <p className="text-xs text-slate-500">Deterministic weighted model (0-100)</p>
    </div>
  );
}
