import type { Auction, AuctionSignal, BazaarProduct, MarketAlert, MarketItem, TrackedBuy } from "../types/market";
import { cleanName, formatCoins } from "./format";

export const toMarketItems = (bazaar: Record<string, BazaarProduct>): MarketItem[] =>
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
    .sort((a, b) => b.volume - a.volume);

export const getAuctionSignals = (auctions: Auction[]): AuctionSignal[] => {
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
};

export const getMarketAlerts = (products: MarketItem[], tracked: TrackedBuy[]): MarketAlert[] => {
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
};
