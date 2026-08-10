import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchItemHistory, fetchMarketData } from "./api/market";
import { AlertsPanel } from "./components/AlertsPanel";
import { AuctionScanner } from "./components/AuctionScanner";
import { BazaarTable } from "./components/BazaarTable";
import { FlipFilters } from "./components/FlipFilters";
import { HeroPanel } from "./components/HeroPanel";
import { ItemDetail } from "./components/ItemDetail";
import { TopBar } from "./components/TopBar";
import { TrackedBuys } from "./components/TrackedBuys";
import { applyFlipFilters, getAuctionSignals, getMarketAlerts, getPresetFilters, toMarketItems } from "./lib/market";
import { parseQuantityInput } from "./lib/quantity";
import { loadJson } from "./lib/storage";
import type { Auction, BazaarHistoryPoint, BazaarProduct, FlipFilters as FlipFiltersType, TrackedBuy } from "./types/market";

const TRACKED_KEY = "sbr:tracked-buys";
const MARKET_REFRESH_INTERVAL_MS = 60_000;

export default function App() {
  const [bazaar, setBazaar] = useState<Record<string, BazaarProduct>>({});
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [historyPoints, setHistoryPoints] = useState<BazaarHistoryPoint[]>([]);
  const [tracked, setTracked] = useState<TrackedBuy[]>(() => loadJson(TRACKED_KEY, []));
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState("BOOSTER_COOKIE");
  const [quantity, setQuantity] = useState("1");
  const [targetPercent, setTargetPercent] = useState("8");
  const [filters, setFilters] = useState<FlipFiltersType>(() => getPresetFilters("balanced"));
  const [status, setStatus] = useState("Ready");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const fetchMarket = useCallback(async () => {
    setStatus("Refreshing market data");
    const market = await fetchMarketData();
    setBazaar(market.products);
    setAuctions(market.auctions);
    setLastUpdated(Date.now());
    setStatus("Live");
  }, []);

  useEffect(() => {
    fetchMarket().catch((error) => setStatus(error.message));
    const intervalId = window.setInterval(() => {
      fetchMarket().catch((error) => setStatus(error.message));
    }, MARKET_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [fetchMarket]);

  useEffect(() => {
    localStorage.setItem(TRACKED_KEY, JSON.stringify(tracked));
  }, [tracked]);

  useEffect(() => {
    if (!selectedItem) return;
    fetchItemHistory(selectedItem)
      .then(setHistoryPoints)
      .catch(() => setHistoryPoints([]));
  }, [selectedItem, lastUpdated]);

  const products = useMemo(() => toMarketItems(bazaar), [bazaar]);
  const filtered = applyFlipFilters(products, filters).filter((item) =>
    `${item.name} ${item.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  const selected = products.find((item) => item.id === selectedItem) ?? filtered[0] ?? products[0];
  const auctionSignals = useMemo(() => getAuctionSignals(auctions), [auctions]);
  const alerts = useMemo(() => getMarketAlerts(products, tracked, filtered), [products, tracked, filtered]);

  const recordBuy = () => {
    if (!selected) return;
    const parsedQuantity = parseQuantityInput(quantity);
    const parsedTargetPercent = Number(targetPercent);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) return;
    if (!Number.isFinite(parsedTargetPercent) || parsedTargetPercent <= 0) return;

    setTracked((current) => [
      {
        id: crypto.randomUUID(),
        item: selected.id,
        market: "bazaar",
        quantity: parsedQuantity,
        buyPrice: selected.buyOrderPrice,
        targetPercent: parsedTargetPercent,
        feePercent: 1.25,
        targetSellPrice: selected.buyOrderPrice * (1 + parsedTargetPercent / 100),
        status: "watching",
        boughtAt: Date.now(),
      },
      ...current,
    ]);
  };

  return (
    <main>
      <TopBar onRefresh={() => fetchMarket().catch((error) => setStatus(error.message))} />

      <HeroPanel
        status={status}
        lastUpdated={lastUpdated}
        productCount={products.length}
        auctionSignalCount={auctionSignals.length}
        alertCount={alerts.length}
      />

      <section className="layout">
        <ItemDetail
          item={selected}
          history={historyPoints}
          quantity={quantity}
          targetPercent={targetPercent}
          onQuantityChange={setQuantity}
          onTargetPercentChange={setTargetPercent}
          onRecordBuy={recordBuy}
        />
        <BazaarTable
          items={filtered}
          selectedId={selected?.id}
          query={query}
          onQueryChange={setQuery}
          onSelect={setSelectedItem}
        />
      </section>

      <FlipFilters
        filters={filters}
        resultCount={filtered.length}
        totalCount={products.length}
        onChange={(nextFilters) => {
          const presetChanged = nextFilters.preset !== filters.preset;
          setFilters(presetChanged ? getPresetFilters(nextFilters.preset) : nextFilters);
        }}
      />

      <section className="lowerGrid">
        <AlertsPanel alerts={alerts} />
        <AuctionScanner signals={auctionSignals} />
        <TrackedBuys
          buys={tracked}
          products={products}
          onRemove={(id) => setTracked((currentBuys) => currentBuys.filter((item) => item.id !== id))}
          onUpdate={(id, updates) =>
            setTracked((currentBuys) =>
              currentBuys.map((item) => (item.id === id ? { ...item, ...updates } : item)),
            )
          }
        />
      </section>
    </main>
  );
}
