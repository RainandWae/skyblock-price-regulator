import { useEffect, useMemo, useState } from "react";
import { fetchItemHistory, fetchMarketData } from "./api/market";
import { AlertsPanel } from "./components/AlertsPanel";
import { AuctionScanner } from "./components/AuctionScanner";
import { BazaarTable } from "./components/BazaarTable";
import { HeroPanel } from "./components/HeroPanel";
import { ItemDetail } from "./components/ItemDetail";
import { TopBar } from "./components/TopBar";
import { TrackedBuys } from "./components/TrackedBuys";
import { getAuctionSignals, getMarketAlerts, toMarketItems } from "./lib/market";
import { loadJson } from "./lib/storage";
import type { Auction, BazaarHistoryPoint, BazaarProduct, TrackedBuy } from "./types/market";

const TRACKED_KEY = "sbr:tracked-buys";

export default function App() {
  const [bazaar, setBazaar] = useState<Record<string, BazaarProduct>>({});
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [historyPoints, setHistoryPoints] = useState<BazaarHistoryPoint[]>([]);
  const [tracked, setTracked] = useState<TrackedBuy[]>(() => loadJson(TRACKED_KEY, []));
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState("BOOSTER_COOKIE");
  const [quantity, setQuantity] = useState(1);
  const [targetPercent, setTargetPercent] = useState(8);
  const [status, setStatus] = useState("Ready");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const fetchMarket = async () => {
    setStatus("Refreshing market data");
    const market = await fetchMarketData();
    setBazaar(market.products);
    setAuctions(market.auctions);
    setLastUpdated(Date.now());
    setStatus("Live");
  };

  useEffect(() => {
    fetchMarket().catch((error) => setStatus(error.message));
  }, []);

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
  const filtered = products.filter((item) => `${item.name} ${item.id}`.toLowerCase().includes(query.toLowerCase()));
  const selected = products.find((item) => item.id === selectedItem) ?? filtered[0] ?? products[0];
  const selectedHistory = historyPoints.map((point) => point.buyPrice).filter((value) => Number.isFinite(value));
  const auctionSignals = useMemo(() => getAuctionSignals(auctions), [auctions]);
  const alerts = useMemo(() => getMarketAlerts(products, tracked), [products, tracked]);

  const recordBuy = () => {
    if (!selected) return;
    setTracked((current) => [
      {
        id: crypto.randomUUID(),
        item: selected.id,
        market: "bazaar",
        quantity,
        buyPrice: selected.buyPrice,
        targetPercent,
        feePercent: 1.25,
        targetSellPrice: selected.buyPrice * (1 + targetPercent / 100),
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
        <BazaarTable
          items={filtered}
          selectedId={selected?.id}
          query={query}
          onQueryChange={setQuery}
          onSelect={setSelectedItem}
        />
        <ItemDetail
          item={selected}
          history={selectedHistory}
          quantity={quantity}
          targetPercent={targetPercent}
          onQuantityChange={setQuantity}
          onTargetPercentChange={setTargetPercent}
          onRecordBuy={recordBuy}
        />
      </section>

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
