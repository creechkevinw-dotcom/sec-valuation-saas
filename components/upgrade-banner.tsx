import Link from "next/link";

export function UpgradeBanner({ remaining }: { remaining: number }) {
  if (remaining > 1) {
    return null;
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">Free-tier limit approaching</p>
      <p className="mt-1">You have {remaining} valuation left this month.</p>
      <Link href="/pricing" className="mt-2 inline-block font-semibold underline">
        Upgrade to Pro
      </Link>
    </div>
  );
}
