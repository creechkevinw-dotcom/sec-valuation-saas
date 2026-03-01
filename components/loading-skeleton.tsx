export function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
      <div className="h-56 animate-pulse rounded-xl bg-slate-200" />
    </div>
  );
}
