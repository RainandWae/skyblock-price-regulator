import type {
  Auction,
  AuctionSignal,
  BazaarProduct,
  FlipFilters,
  MarketAlert,
  MarketItem,
  TrackedBuy,
} from "../types/market";
import { cleanName, formatCoins } from "./format";

export const toMarketItems = (bazaar: Record<string, BazaarProduct>): MarketItem[] =>
  Object.values(bazaar)
    .map((product) => {
      const quick = product.quick_status;
      const spread = quick.buyPrice - quick.sellPrice;
      const spreadPercent = quick.sellPrice ? (spread / quick.sellPrice) * 100 : 0;
      const volume = quick.buyMovingWeek + quick.sellMovingWeek;
      const weeklyCoins = ((quick.buyPrice + quick.sellPrice) / 2) * volume;
      const suggestedUnits = Math.max(1, Math.ceil(1_000_000 / Math.max(spread, 1)));
      const suggestedProfit = spread * suggestedUnits;
      const priceWeight = Math.log10(Math.max(quick.sellPrice, 1));
      const liquidityWeight = Math.log10(Math.max(volume, 1));
      const practicalScore = spread > 0 ? spread * Math.max(spreadPercent, 0) * priceWeight * liquidityWeight : 0;

      return {
        id: product.product_id,
        name: cleanName(product.product_id),
        buyPrice: quick.buyPrice,
        sellPrice: quick.sellPrice,
        volume,
        weeklyCoins,
        spread,
        spreadPercent,
        practicalScore,
        suggestedUnits,
        suggestedProfit,
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

export const getMarketAlerts = (products: MarketItem[], tracked: TrackedBuy[], signalProducts = products): MarketAlert[] => {
  const marketAlerts = signalProducts
    .filter((item) => {
      const isExpensiveEnough = item.sellPrice >= 25_000;
      const hasMeaningfulSpread = item.spread >= 2_500;
      const hasUsefulMargin = item.spreadPercent >= 1.2 && item.spreadPercent <= 45;
      const hasLiquidity = item.volume >= 250 && item.orders >= 8 && item.weeklyCoins >= 50_000_000;
      const needsReasonableUnits = item.suggestedUnits <= 400;
      return isExpensiveEnough && hasMeaningfulSpread && hasUsefulMargin && hasLiquidity && needsReasonableUnits;
    })
    .sort((a, b) => b.practicalScore - a.practicalScore)
    .slice(0, 10)
    .map((item) => ({
      id: `spread-${item.id}`,
      item: item.name,
      type: "spread" as const,
      severity: item.suggestedProfit >= 2_000_000 ? ("hot" as const) : ("good" as const),
      message: `${formatCoins(item.spread)} spread, ${item.spreadPercent.toFixed(1)}% margin, about ${item.suggestedUnits} units for ${formatCoins(item.suggestedProfit)} gross`,
    }));

  const watchAlerts = signalProducts
    .filter((item) => item.sellPrice >= 1_000_000 && item.spreadPercent >= 0.8 && item.spread >= 25_000 && item.volume >= 40)
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 3)
    .map((item) => ({
      id: `watch-${item.id}`,
      item: item.name,
      type: "watch" as const,
      severity: "watch" as const,
      message: `Expensive item watch: ${formatCoins(item.spread)} spread on ${formatCoins(item.sellPrice)} sell price`,
    }));

  const profitAlerts = tracked.flatMap((buy) => {
    const market = products.find((item) => item.id === buy.item || item.name.toLowerCase() === buy.item.toLowerCase());
    if (!market) return [];
    const feePercent = buy.feePercent ?? 1.25;
    const target = buy.targetSellPrice ?? buy.buyPrice * (1 + buy.targetPercent / 100);
    const netSell = market.sellPrice * (1 - feePercent / 100);
    if (netSell < target) return [];
    return [
      {
        id: `profit-${buy.id}`,
        item: cleanName(buy.item),
        type: "profit" as const,
        severity: "hot" as const,
        message: `Profit zone hit: ${formatCoins(netSell)} net sell after ${feePercent}% fees`,
      },
    ];
  });

  return [...profitAlerts, ...marketAlerts, ...watchAlerts];
};

export const getPresetFilters = (preset: FlipFilters["preset"]): FlipFilters => {
  const presets: Record<FlipFilters["preset"], FlipFilters> = {
    balanced: {
      preset,
      minSellPrice: 25_000,
      minSpread: 2_500,
      minWeeklyCoins: 50_000_000,
      maxSuggestedUnits: 400,
    },
    expensive: {
      preset,
      minSellPrice: 1_000_000,
      minSpread: 25_000,
      minWeeklyCoins: 30_000_000,
      maxSuggestedUnits: 80,
    },
    "low-count": {
      preset,
      minSellPrice: 100_000,
      minSpread: 10_000,
      minWeeklyCoins: 20_000_000,
      maxSuggestedUnits: 50,
    },
    liquid: {
      preset,
      minSellPrice: 10_000,
      minSpread: 1_500,
      minWeeklyCoins: 250_000_000,
      maxSuggestedUnits: 600,
    },
  };

  return presets[preset];
};

export const applyFlipFilters = (items: MarketItem[], filters: FlipFilters) =>
  items
    .filter((item) => {
      const meetsPrice = item.sellPrice >= filters.minSellPrice;
      const meetsSpread = item.spread >= filters.minSpread;
      const meetsCoins = item.weeklyCoins >= filters.minWeeklyCoins;
      const meetsUnits = item.suggestedUnits <= filters.maxSuggestedUnits;
      return meetsPrice && meetsSpread && meetsCoins && meetsUnits;
    })
    .sort((a, b) => b.practicalScore - a.practicalScore);
