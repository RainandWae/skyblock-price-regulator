import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchItemHistory, fetchMarketData } from "./api/market";
import { AlertsPanel } from "./components/AlertsPanel";
import { AuctionScanner } from "./components/AuctionScanner";
import { BazaarTable } from "./components/BazaarTable";
import { FlipFilters } from "./components/FlipFilters";
import { HeroPanel } from "./components/HeroPanel";
import { ItemDetail } from "./components/ItemDetail";
import { SettingsPanel } from "./components/SettingsPanel";
import { TopBar } from "./components/TopBar";
import { TrackedBuys } from "./components/TrackedBuys";
import { applyFlipFilters, getAuctionSignals, getMarketAlerts, getPresetFilters, toMarketItems } from "./lib/market";
import { parseQuantityInput } from "./lib/quantity";
import { loadJson } from "./lib/storage";
import type {
  Auction,
  BazaarHistoryPoint,
  BazaarProduct,
  FlipFilters as FlipFiltersType,
  MarketSettings,
  TrackedBuy,
} from "./types/market";

const TRACKED_KEY = "sbr:tracked-buys";
const SETTINGS_KEY = "sbr:settings";
const defaultSettings: MarketSettings = {
  refreshIntervalSeconds: 60,
  defaultFeePercent: 1.25,
  defaultTargetPercent: 8,
  minProfit: 0,
  ignoreHighLevelEnchantments: true,
  ignoreAuctionBooks: true,
};

export default function App() {
  const [bazaar, setBazaar] = useState<Record<string, BazaarProduct>>({});
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [historyPoints, setHistoryPoints] = useState<BazaarHistoryPoint[]>([]);
  const [tracked, setTracked] = useState<TrackedBuy[]>(() => loadJson(TRACKED_KEY, []));
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState("BOOSTER_COOKIE");
  const [quantity, setQuantity] = useState("1");
  const [settings, setSettings] = useState<MarketSettings>(() => ({ ...defaultSettings, ...loadJson(SETTINGS_KEY, {}) }));
  const [targetPercent, setTargetPercent] = useState(String(settings.defaultTargetPercent));
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
    }, settings.refreshIntervalSeconds * 1000);
    return () => window.clearInterval(intervalId);
  }, [fetchMarket, settings.refreshIntervalSeconds]);

  useEffect(() => {
    localStorage.setItem(TRACKED_KEY, JSON.stringify(tracked));
  }, [tracked]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!selectedItem) return;
    fetchItemHistory(selectedItem)
      .then(setHistoryPoints)
      .catch(() => setHistoryPoints([]));
  }, [selectedItem, lastUpdated]);

  const products = useMemo(() => toMarketItems(bazaar), [bazaar]);
  const filtered = applyFlipFilters(products, filters, settings).filter((item) =>
    `${item.name} ${item.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  const selected = products.find((item) => item.id === selectedItem) ?? filtered[0] ?? products[0];
  const auctionSignals = useMemo(() => getAuctionSignals(auctions, settings), [auctions, settings]);
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
        feePercent: settings.defaultFeePercent,
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
        ignoreHighLevelEnchantments={settings.ignoreHighLevelEnchantments}
        onChange={(nextFilters) => {
          const presetChanged = nextFilters.preset !== filters.preset;
          setFilters(presetChanged ? getPresetFilters(nextFilters.preset) : nextFilters);
        }}
      />

      <SettingsPanel settings={settings} onChange={setSettings} />

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
