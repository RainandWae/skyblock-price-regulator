import {
  AlertTriangle,
  Bell,
  ChartLine,
  CircleDollarSign,
  Clock3,
  Gauge,
  History,
  RefreshCw,
  Search,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type BazaarProduct = {
  product_id: string;
  quick_status: {
    productId: string;
    sellPrice: number;
    sellVolume: number;
    sellMovingWeek: number;
    sellOrders: number;
    buyPrice: number;
    buyVolume: number;
    buyMovingWeek: number;
    buyOrders: number;
  };
};

type Auction = {
  uuid: string;
  item_name: string;
  tier: string;
  category: string;
  starting_bid: number;
  highest_bid_amount: number;
  bin?: boolean;
  end: number;
};

type BazaarSnapshot = {
  at: number;
  products: Record<string, BazaarProduct>;
};

type TrackedBuy = {
  id: string;
  item: string;
  market: "bazaar" | "auction";
  quantity: number;
  buyPrice: number;
  targetPercent: number;
  boughtAt: number;
};

type Alert = {
  id: string;
  item: string;
  type: "high" | "low" | "spread" | "profit";
  message: string;
  severity: "hot" | "good" | "watch";
};

const BAZAAR_URL = "/api/bazaar";
const AUCTIONS_URL = "/api/auctions?page=0";
const HISTORY_KEY = "sbr:bazaar-history";
const TRACKED_KEY = "sbr:tracked-buys";

const formatCoins = (value: number) =>
  Number.isFinite(value)
    ? value >= 1_000_000
      ? `${(value / 1_000_000).toFixed(2)}m`
      : value >= 1_000
        ? `${(value / 1_000).toFixed(1)}k`
        : value.toFixed(value >= 100 ? 0 : 1)
    : "-";

const cleanName = (id: string) =>
  id
    .replace(/^ENCHANTMENT_/, "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const loadJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

function MiniChart({ points, tone }: { points: number[]; tone: "green" | "red" | "blue" }) {
  const path = useMemo(() => {
    if (points.length < 2) return "";
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    return points
      .map((point, index) => {
        const x = (index / (points.length - 1)) * 100;
        const y = 92 - ((point - min) / span) * 78;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }, [points]);

  return (
    <svg className="miniChart" viewBox="0 0 100 100" role="img" aria-label="Price trend chart">
      <path className="gridLine" d="M 0 25 L 100 25 M 0 50 L 100 50 M 0 75 L 100 75" />
      <path className={`chartLine ${tone}`} d={path} />
    </svg>
  );
}

export default function App() {
  const [bazaar, setBazaar] = useState<Record<string, BazaarProduct>>({});
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [history, setHistory] = useState<BazaarSnapshot[]>(() => loadJson(HISTORY_KEY, []));
  const [tracked, setTracked] = useState<TrackedBuy[]>(() => loadJson(TRACKED_KEY, []));
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState("BOOSTER_COOKIE");
  const [quantity, setQuantity] = useState(1);
  const [targetPercent, setTargetPercent] = useState(8);
  const [status, setStatus] = useState("Ready");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const fetchMarket = async () => {
    setStatus("Refreshing market data");
    const [bazaarResponse, auctionResponse] = await Promise.all([fetch(BAZAAR_URL), fetch(AUCTIONS_URL)]);
    if (!bazaarResponse.ok) throw new Error(`Bazaar request failed: ${bazaarResponse.status}`);
    if (!auctionResponse.ok) throw new Error(`Auction request failed: ${auctionResponse.status}`);
    const bazaarData = await bazaarResponse.json();
    const auctionData = await auctionResponse.json();
    const products = bazaarData.products as Record<string, BazaarProduct>;
    const snapshot = { at: Date.now(), products };
    const nextHistory = [...history, snapshot].slice(-120);
    setBazaar(products);
    setAuctions((auctionData.auctions as Auction[]).filter((auction) => auction.bin).slice(0, 500));
    setHistory(nextHistory);
    setLastUpdated(Date.now());
    setStatus("Live");
    localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  };

  useEffect(() => {
    fetchMarket().catch((error) => setStatus(error.message));
  }, []);

  useEffect(() => {
    localStorage.setItem(TRACKED_KEY, JSON.stringify(tracked));
  }, [tracked]);

  const products = useMemo(
    () =>
      Object.values(bazaar)
        .map((product) => {
          const quick = product.quick_status;
          const spread = quick.buyPrice - quick.sellPrice;
          const spreadPercent = quick.sellPrice ? (spread / quick.sellPrice) * 100 : 0;
          return {
            id: product.product_id,
            name: cleanName(product.product_id),
            buyPrice: quick.buyPrice,
            sellPrice: quick.sellPrice,
            volume: quick.buyMovingWeek + quick.sellMovingWeek,
            spread,
            spreadPercent,
            orders: quick.buyOrders + quick.sellOrders,
          };
        })
        .sort((a, b) => b.volume - a.volume),
    [bazaar],
  );

  const filtered = products.filter((item) => `${item.name} ${item.id}`.toLowerCase().includes(query.toLowerCase()));
  const selected = products.find((item) => item.id === selectedItem) ?? filtered[0] ?? products[0];
  const selectedHistory = history
    .map((snapshot) => snapshot.products[selected?.id ?? ""]?.quick_status?.buyPrice)
    .filter((value): value is number => Number.isFinite(value));

  const auctionGroups = useMemo(() => {
    const groups = new Map<string, Auction[]>();
    for (const auction of auctions) {
      const key = auction.item_name.replace(/§./g, "");
      groups.set(key, [...(groups.get(key) ?? []), auction]);
    }
    return [...groups.entries()]
      .map(([name, list]) => {
        const sorted = list.sort((a, b) => a.starting_bid - b.starting_bid);
        const lowest = sorted[0]?.starting_bid ?? 0;
        const median = sorted[Math.floor(sorted.length / 2)]?.starting_bid ?? lowest;
        return { name, count: list.length, lowest, median, gap: median - lowest };
      })
      .filter((item) => item.count >= 3 && item.gap > 0)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 8);
  }, [auctions]);

  const alerts = useMemo<Alert[]>(() => {
    const marketAlerts = products
      .filter((item) => item.volume > 50_000 && item.spreadPercent > 4)
      .slice(0, 8)
      .map((item) => ({
        id: `spread-${item.id}`,
        item: item.name,
        type: "spread" as const,
        severity: "good" as const,
        message: `${formatCoins(item.spread)} coin spread, ${item.spreadPercent.toFixed(1)}% margin`,
      }));

    const profitAlerts = tracked.flatMap((buy) => {
      const market = products.find((item) => item.id === buy.item || item.name.toLowerCase() === buy.item.toLowerCase());
      if (!market) return [];
      const target = buy.buyPrice * (1 + buy.targetPercent / 100);
      if (market.sellPrice < target) return [];
      return [
        {
          id: `profit-${buy.id}`,
          item: cleanName(buy.item),
          type: "profit" as const,
          severity: "hot" as const,
          message: `Profit zone hit: ${formatCoins(market.sellPrice)} current sell price`,
        },
      ];
    });

    return [...profitAlerts, ...marketAlerts];
  }, [products, tracked]);

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
        boughtAt: Date.now(),
      },
      ...current,
    ]);
  };

  return (
    <main>
      <section className="topbar">
        <div>
          <p className="eyebrow">Hypixel SkyBlock market app</p>
          <h1>SkyBlock Price Regulator</h1>
        </div>
        <button className="iconButton" onClick={() => fetchMarket().catch((error) => setStatus(error.message))} aria-label="Refresh market">
          <RefreshCw size={18} />
        </button>
      </section>

      <section className="heroPanel">
        <div>
          <p className="statusLine">
            <span className={`statusDot ${status === "Live" ? "live" : ""}`} />
            {status}
            {lastUpdated ? ` · ${new Date(lastUpdated).toLocaleTimeString()}` : ""}
          </p>
          <h2>Watch Bazaar prices, spot unusual margins, and track when your buys reach profit.</h2>
        </div>
        <div className="heroStats">
          <div>
            <ChartLine size={18} />
            <strong>{products.length}</strong>
            <span>Bazaar items</span>
          </div>
          <div>
            <Gauge size={18} />
            <strong>{auctionGroups.length}</strong>
            <span>AH signals</span>
          </div>
          <div>
            <Bell size={18} />
            <strong>{alerts.length}</strong>
            <span>Alerts</span>
          </div>
        </div>
      </section>

      <section className="layout">
        <div className="marketPanel">
          <div className="panelHeader">
            <div>
              <h3>Bazaar Market</h3>
              <p>High volume items sorted by weekly movement.</p>
            </div>
            <label className="searchBox">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search item" />
            </label>
          </div>
          <div className="table">
            {filtered.slice(0, 14).map((item) => (
              <button className={`row ${selected?.id === item.id ? "selected" : ""}`} key={item.id} onClick={() => setSelectedItem(item.id)}>
                <span>{item.name}</span>
                <span>{formatCoins(item.buyPrice)}</span>
                <span>{formatCoins(item.sellPrice)}</span>
                <span className={item.spreadPercent > 4 ? "positive" : ""}>{item.spreadPercent.toFixed(1)}%</span>
              </button>
            ))}
          </div>
        </div>

        <aside className="detailPanel">
          <div className="detailHeader">
            <CircleDollarSign size={22} />
            <div>
              <h3>{selected?.name ?? "No item selected"}</h3>
              <p>{selected?.id ?? "Refresh market data to begin"}</p>
            </div>
          </div>
          <MiniChart points={selectedHistory.length > 1 ? selectedHistory : [0, selected?.buyPrice ?? 0]} tone="blue" />
          <div className="metrics">
            <span>Instant buy <strong>{formatCoins(selected?.buyPrice ?? 0)}</strong></span>
            <span>Instant sell <strong>{formatCoins(selected?.sellPrice ?? 0)}</strong></span>
            <span>Spread <strong>{formatCoins(selected?.spread ?? 0)}</strong></span>
          </div>
          <div className="buyBox">
            <label>
              Quantity
              <input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
            </label>
            <label>
              Target %
              <input type="number" min={1} value={targetPercent} onChange={(event) => setTargetPercent(Number(event.target.value))} />
            </label>
            <button onClick={recordBuy}>
              <ShoppingCart size={17} />
              Bought now
            </button>
          </div>
        </aside>
      </section>

      <section className="lowerGrid">
        <div className="panel">
          <div className="panelHeader compact">
            <h3>Alerts</h3>
            <AlertTriangle size={18} />
          </div>
          <div className="alertList">
            {alerts.length ? (
              alerts.map((alert) => (
                <div className={`alert ${alert.severity}`} key={alert.id}>
                  {alert.type === "profit" ? <TrendingUp size={17} /> : <TrendingDown size={17} />}
                  <div>
                    <strong>{alert.item}</strong>
                    <span>{alert.message}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty">No alerts yet. Refresh again after a few snapshots or track a buy.</p>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader compact">
            <h3>Auction House Scanner</h3>
            <Gauge size={18} />
          </div>
          <div className="auctionList">
            {auctionGroups.map((item) => (
              <div className="auctionItem" key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.count} active BINs</span>
                </div>
                <div>
                  <b>{formatCoins(item.lowest)}</b>
                  <span>{formatCoins(item.gap)} under median</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader compact">
            <h3>Tracked Buys</h3>
            <History size={18} />
          </div>
          <div className="trackedList">
            {tracked.length ? (
              tracked.map((buy) => {
                const market = products.find((item) => item.id === buy.item);
                const current = market?.sellPrice ?? buy.buyPrice;
                const profit = (current - buy.buyPrice) * buy.quantity;
                return (
                  <div className="trackedItem" key={buy.id}>
                    <Clock3 size={16} />
                    <div>
                      <strong>{cleanName(buy.item)}</strong>
                      <span>
                        Bought {buy.quantity} at {formatCoins(buy.buyPrice)} · P/L {formatCoins(profit)}
                      </span>
                    </div>
                    <button aria-label="Remove tracked buy" onClick={() => setTracked((currentBuys) => currentBuys.filter((item) => item.id !== buy.id))}>
                      ×
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="empty">Click Bought now on an item to start watching its profit zone.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
