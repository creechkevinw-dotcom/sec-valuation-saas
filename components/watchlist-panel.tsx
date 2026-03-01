"use client";

import { useEffect, useMemo, useState } from "react";

type WatchlistItem = {
  id: string;
  ticker: string;
  created_at: string;
};

export function WatchlistPanel() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticker, setTicker] = useState("");
  const [busy, setBusy] = useState(false);

  const itemSet = useMemo(() => new Set(items.map((i) => i.ticker)), [items]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/watchlist");
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "Failed to load watchlist.");
        setItems([]);
      } else {
        setItems(payload.items ?? []);
      }
    } catch {
      setError("Network error loading watchlist.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function addTicker() {
    const symbol = ticker.trim().toUpperCase();
    if (!symbol || itemSet.has(symbol)) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: symbol }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "Failed to add watchlist item.");
      } else {
        setTicker("");
        await load();
      }
    } catch {
      setError("Network error while adding ticker.");
    } finally {
      setBusy(false);
    }
  }

  async function removeTicker(symbol: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: symbol }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "Failed to remove watchlist item.");
      } else {
        await load();
      }
    } catch {
      setError("Network error while removing ticker.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">Watchlist</h3>

      <div className="mt-3 flex gap-2">
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="AAPL"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={addTicker}
          disabled={busy}
          className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          Add
        </button>
      </div>

      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}

      {loading ? (
        <p className="mt-3 text-sm text-slate-500">Loading watchlist...</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No watchlist items yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
              <span className="text-sm font-medium text-slate-800">{item.ticker}</span>
              <button
                type="button"
                onClick={() => removeTicker(item.ticker)}
                disabled={busy}
                className="text-xs font-semibold text-rose-600 disabled:opacity-60"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
