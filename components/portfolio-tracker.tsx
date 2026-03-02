"use client";

import { useEffect, useMemo, useState } from "react";

type Portfolio = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type Position = {
  id: string;
  portfolio_id: string;
  ticker: string;
  quantity: number;
  cost_basis: number;
  opened_at: string | null;
  created_at: string;
  updated_at: string;
};

type PricePoint = {
  price: number;
  dayChange: number;
  dayChangePct: number;
};

function money(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function signed(value: number, digits = 2) {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

export function PortfolioTracker() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<string>("");
  const [positions, setPositions] = useState<Position[]>([]);
  const [prices, setPrices] = useState<Record<string, PricePoint | null>>({});

  const [loadingPortfolios, setLoadingPortfolios] = useState(true);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [portfolioName, setPortfolioName] = useState("");
  const [newTicker, setNewTicker] = useState("");
  const [newQuantity, setNewQuantity] = useState("10");
  const [newCostBasis, setNewCostBasis] = useState("100");
  const [newOpenedAt, setNewOpenedAt] = useState("");

  const activePortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.id === activePortfolioId) ?? null,
    [activePortfolioId, portfolios],
  );

  async function loadPortfolios() {
    setLoadingPortfolios(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio");
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "Failed to load portfolios.");
        setPortfolios([]);
        setActivePortfolioId("");
        return;
      }

      const list = (payload.portfolios ?? []) as Portfolio[];
      setPortfolios(list);
      if (list.length > 0) {
        setActivePortfolioId((prior) => (prior && list.some((p) => p.id === prior) ? prior : list[0].id));
      } else {
        setActivePortfolioId("");
      }
    } catch {
      setError("Network error while loading portfolios.");
      setPortfolios([]);
      setActivePortfolioId("");
    } finally {
      setLoadingPortfolios(false);
    }
  }

  async function loadPositions(portfolioId: string) {
    if (!portfolioId) {
      setPositions([]);
      setPrices({});
      return;
    }

    setLoadingPositions(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolio/positions?portfolioId=${encodeURIComponent(portfolioId)}`);
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "Failed to load positions.");
        setPositions([]);
        return;
      }

      setPositions((payload.positions ?? []) as Position[]);
    } catch {
      setError("Network error while loading positions.");
      setPositions([]);
    } finally {
      setLoadingPositions(false);
    }
  }

  async function loadPricesForPositions(rows: Position[]) {
    const tickers = Array.from(new Set(rows.map((row) => row.ticker)));
    if (tickers.length === 0) {
      setPrices({});
      return;
    }

    setLoadingPrices(true);
    try {
      const res = await fetch(`/api/portfolio/prices?tickers=${encodeURIComponent(tickers.join(","))}`);
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "Failed to load live prices.");
        setPrices({});
      } else {
        setPrices(payload.prices ?? {});
      }
    } catch {
      setError("Network error while loading live prices.");
      setPrices({});
    } finally {
      setLoadingPrices(false);
    }
  }

  useEffect(() => {
    void loadPortfolios();
  }, []);

  useEffect(() => {
    if (!activePortfolioId) return;
    void loadPositions(activePortfolioId);
  }, [activePortfolioId]);

  useEffect(() => {
    void loadPricesForPositions(positions);
  }, [positions]);

  const totals = useMemo(() => {
    return positions.reduce(
      (acc, row) => {
        const cost = row.quantity * row.cost_basis;
        const live = prices[row.ticker]?.price ?? null;
        const marketValue = live != null ? row.quantity * live : null;
        const pnl = marketValue != null ? marketValue - cost : null;

        acc.costBasis += cost;
        if (marketValue != null) acc.marketValue += marketValue;
        if (pnl != null) acc.pnl += pnl;
        return acc;
      },
      { costBasis: 0, marketValue: 0, pnl: 0 },
    );
  }, [positions, prices]);

  async function createPortfolio() {
    if (!portfolioName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: portfolioName.trim() }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "Failed to create portfolio.");
        return;
      }
      setPortfolioName("");
      await loadPortfolios();
      if (payload.portfolio?.id) {
        setActivePortfolioId(payload.portfolio.id);
      }
    } catch {
      setError("Network error while creating portfolio.");
    } finally {
      setBusy(false);
    }
  }

  async function deletePortfolio(portfolioId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioId }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "Failed to delete portfolio.");
        return;
      }
      await loadPortfolios();
      setPositions([]);
      setPrices({});
    } catch {
      setError("Network error while deleting portfolio.");
    } finally {
      setBusy(false);
    }
  }

  async function addPosition() {
    if (!activePortfolioId) return;
    const ticker = newTicker.trim().toUpperCase();
    const quantity = Number(newQuantity);
    const costBasis = Number(newCostBasis);
    if (!ticker || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(costBasis) || costBasis < 0) {
      setError("Enter a valid ticker, quantity, and cost basis.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId: activePortfolioId,
          ticker,
          quantity,
          costBasis,
          openedAt: newOpenedAt || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "Failed to add position.");
        return;
      }
      setNewTicker("");
      setNewQuantity("10");
      setNewCostBasis("100");
      setNewOpenedAt("");
      await loadPositions(activePortfolioId);
    } catch {
      setError("Network error while adding position.");
    } finally {
      setBusy(false);
    }
  }

  async function removePosition(positionId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio/positions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "Failed to remove position.");
        return;
      }
      await loadPositions(activePortfolioId);
    } catch {
      setError("Network error while removing position.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Portfolio Tracking</h2>
          <p className="text-sm text-slate-600">Track positions, live market value, and unrealized P/L.</p>
        </div>
        <div className="flex gap-2">
          <input
            value={portfolioName}
            onChange={(event) => setPortfolioName(event.target.value)}
            placeholder="New portfolio name"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={createPortfolio}
            disabled={busy}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Create
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {loadingPortfolios ? (
        <p className="text-sm text-slate-500">Loading portfolios...</p>
      ) : portfolios.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          No portfolios yet. Create your first portfolio to start tracking positions.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {portfolios.map((portfolio) => {
              const active = portfolio.id === activePortfolioId;
              return (
                <div key={portfolio.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActivePortfolioId(portfolio.id)}
                    className={`rounded-md px-3 py-2 text-sm font-semibold ${
                      active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {portfolio.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePortfolio(portfolio.id)}
                    disabled={busy}
                    className="rounded-md border border-slate-300 px-2 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>

          {activePortfolio ? (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs uppercase text-slate-500">Cost Basis</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{money(totals.costBasis)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs uppercase text-slate-500">Market Value</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {loadingPrices ? "Updating..." : money(totals.marketValue)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs uppercase text-slate-500">Unrealized P/L</p>
                <p className={`mt-1 text-xl font-semibold ${totals.pnl >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {money(totals.pnl)}
                </p>
              </div>
            </div>
          ) : null}

          {activePortfolio ? (
            <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-5">
              <input
                value={newTicker}
                onChange={(event) => setNewTicker(event.target.value.toUpperCase())}
                placeholder="Ticker"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <input
                value={newQuantity}
                onChange={(event) => setNewQuantity(event.target.value)}
                placeholder="Quantity"
                inputMode="decimal"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <input
                value={newCostBasis}
                onChange={(event) => setNewCostBasis(event.target.value)}
                placeholder="Cost Basis"
                inputMode="decimal"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={newOpenedAt}
                onChange={(event) => setNewOpenedAt(event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={addPosition}
                disabled={busy}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Add Position
              </button>
            </div>
          ) : null}

          {loadingPositions ? (
            <p className="text-sm text-slate-500">Loading positions...</p>
          ) : positions.length === 0 ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No positions yet. Add your first ticker above.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Ticker</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Cost Basis</th>
                    <th className="px-3 py-2">Live Price</th>
                    <th className="px-3 py-2">Day %</th>
                    <th className="px-3 py-2">Market Value</th>
                    <th className="px-3 py-2">Unrealized P/L</th>
                    <th className="px-3 py-2">Opened</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((row) => {
                    const quote = prices[row.ticker];
                    const marketValue = quote ? quote.price * row.quantity : null;
                    const cost = row.quantity * row.cost_basis;
                    const pnl = marketValue != null ? marketValue - cost : null;
                    return (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-900">{row.ticker}</td>
                        <td className="px-3 py-2">{Number(row.quantity).toFixed(2)}</td>
                        <td className="px-3 py-2">{money(Number(row.cost_basis))}</td>
                        <td className="px-3 py-2">{quote ? money(quote.price) : "-"}</td>
                        <td
                          className={`px-3 py-2 ${
                            quote && quote.dayChangePct < 0 ? "text-rose-700" : "text-emerald-700"
                          }`}
                        >
                          {quote ? `${signed(quote.dayChangePct)}%` : "-"}
                        </td>
                        <td className="px-3 py-2">{marketValue != null ? money(marketValue) : "-"}</td>
                        <td className={`px-3 py-2 ${pnl != null && pnl < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                          {pnl != null ? money(pnl) : "-"}
                        </td>
                        <td className="px-3 py-2">{row.opened_at ?? "-"}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => removePosition(row.id)}
                            disabled={busy}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-rose-700 disabled:opacity-60"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
