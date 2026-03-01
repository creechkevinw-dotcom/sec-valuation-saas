"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TickerInputForm() {
  const [ticker, setTicker] = useState("MSFT");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });

      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "Unable to run valuation.");
        return;
      }

      router.push(`/valuation/${payload.valuationId}`);
    } catch {
      setError("Network error while creating valuation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <label htmlFor="ticker" className="block text-sm font-medium text-slate-700">
        Ticker Symbol
      </label>
      <input
        id="ticker"
        value={ticker}
        onChange={(e) => setTicker(e.target.value.toUpperCase())}
        placeholder="AAPL"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-sky-500"
      />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Running Valuation..." : "Run Valuation"}
      </button>
    </form>
  );
}
