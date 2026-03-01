"use client";

import { useEffect, useState } from "react";

export function WatchlistSaveButton({ ticker }: { ticker: string }) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/watchlist");
        const payload = await res.json();
        if (!res.ok) {
          if (mounted) {
            setError(payload.error ?? "Unable to load watchlist state.");
          }
          return;
        }
        const found = (payload.items ?? []).some((item: { ticker: string }) => item.ticker === ticker);
        if (mounted) {
          setSaved(found);
        }
      } catch {
        if (mounted) {
          setError("Unable to load watchlist state.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [ticker]);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (!saved) {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker }),
        });
        const payload = await res.json();
        if (!res.ok) {
          setError(payload.error ?? "Failed to save watchlist item.");
          return;
        }
        setSaved(true);
      } else {
        const res = await fetch("/api/watchlist", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker }),
        });
        const payload = await res.json();
        if (!res.ok) {
          setError(payload.error ?? "Failed to remove watchlist item.");
          return;
        }
        setSaved(false);
      }
    } catch {
      setError("Network error updating watchlist.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={loading || busy}
        className={`rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
          saved ? "border border-slate-300 bg-white text-slate-700" : "bg-sky-600 text-white"
        }`}
      >
        {loading ? "Loading..." : busy ? "Saving..." : saved ? "Saved to Watchlist" : "Save to Watchlist"}
      </button>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
