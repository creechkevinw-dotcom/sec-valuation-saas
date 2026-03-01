export default function PricingPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16">
      <h1 className="text-4xl font-semibold text-slate-900">Pricing</h1>
      <p className="mt-3 text-slate-600">Simple launch pricing with deterministic valuation tools.</p>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Free</h2>
          <p className="mt-2 text-3xl font-semibold">$0</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>3 valuations per month</li>
            <li>Dashboard history</li>
            <li>Base/Bull/Bear DCF output</li>
          </ul>
        </section>

        <section className="rounded-xl border border-sky-200 bg-sky-50 p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Pro</h2>
          <p className="mt-2 text-3xl font-semibold">$29/mo</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>Unlimited valuations</li>
            <li>PDF export</li>
            <li>Priority support</li>
          </ul>
          <button
            type="button"
            className="mt-6 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Upgrade (Stripe MVP Hook)
          </button>
        </section>
      </div>
    </main>
  );
}
