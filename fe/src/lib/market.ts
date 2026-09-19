import type {
  Auction,
  AuctionSignal,
  BazaarProduct,
  FlipFilters,
  MarketSettings,
  MarketAlert,
  MarketItem,
  TrackedBuy,
} from "../types/market";
import { cleanName, formatCoins } from "./format";

const getEnchantmentLevel = (productId: string) => {
  if (!productId.startsWith("ENCHANTMENT_")) return null;
  const match = productId.match(/_(\d+)$/);
  return match ? Number(match[1]) : null;
};

export const toMarketItems = (bazaar: Record<string, BazaarProduct>): MarketItem[] =>
  Object.values(bazaar)
    .map((product) => {
      const quick = product.quick_status;
      const enchantmentLevel = getEnchantmentLevel(product.product_id);
      const buyOrderPrice = quick.sellPrice;
      const sellOrderPrice = quick.buyPrice;
      const spread = sellOrderPrice - buyOrderPrice;
      const spreadPercent = buyOrderPrice ? (spread / buyOrderPrice) * 100 : 0;
      const volume = quick.buyMovingWeek + quick.sellMovingWeek;
      const sideFlow = Math.min(quick.buyMovingWeek, quick.sellMovingWeek);
      const flowBalance = sideFlow / Math.max(quick.buyMovingWeek, quick.sellMovingWeek, 1);
      const orderDepth = Math.min(quick.buyOrders, quick.sellOrders);
      const weeklyCoins = ((sellOrderPrice + buyOrderPrice) / 2) * volume;
      const suggestedUnits = Math.max(1, Math.ceil(1_000_000 / Math.max(spread, 1)));
      const suggestedProfit = spread * suggestedUnits;
      const priceWeight = Math.log10(Math.max(buyOrderPrice, 1));
      const flowScore = Math.log10(Math.max(sideFlow, 1)) * Math.log10(Math.max(orderDepth, 1));
      const queueHealthScore = flowScore * Math.max(flowBalance, 0.05);
      const practicalScore = spread > 0 ? spread * Math.max(spreadPercent, 0) * priceWeight * queueHealthScore : 0;

      return {
        id: product.product_id,
        name: cleanName(product.product_id),
        enchantmentLevel,
        isIgnoredEnchantment: enchantmentLevel !== null && enchantmentLevel > 1,
        buyPrice: sellOrderPrice,
        sellPrice: buyOrderPrice,
        buyOrderPrice,
        sellOrderPrice,
        instantBuyPrice: sellOrderPrice,
        instantSellPrice: buyOrderPrice,
        volume,
        buyMovingWeek: quick.buyMovingWeek,
        sellMovingWeek: quick.sellMovingWeek,
        sideFlow,
        flowBalance,
        weeklyCoins,
        spread,
        spreadPercent,
        orderFlipSpread: spread,
        orderFlipPercent: spreadPercent,
        practicalScore,
        flowScore,
        queueHealthScore,
        suggestedUnits,
        suggestedProfit,
        orders: quick.buyOrders + quick.sellOrders,
        buyOrders: quick.buyOrders,
        sellOrders: quick.sellOrders,
        orderDepth,
      };
    })
    .sort((a, b) => b.volume - a.volume);

export const getAuctionSignals = (auctions: Auction[], settings?: Pick<MarketSettings, "ignoreAuctionBooks">): AuctionSignal[] => {
  const groups = new Map<string, Auction[]>();
  const ignoredNamePatterns = [
    /enchanted book/i,
    /\brune\b/i,
    /\bskin\b/i,
    /cake soul/i,
    /furniture/i,
    /new year cake/i,
  ];

  for (const auction of auctions) {
    const key = auction.item_name.replace(/§./g, "");
    const shouldIgnoreBook = settings?.ignoreAuctionBooks && /enchanted book/i.test(key);
    const shouldIgnoreNoise = ignoredNamePatterns.slice(1).some((pattern) => pattern.test(key));
    if (!auction.bin || shouldIgnoreBook || shouldIgnoreNoise) continue;
    if (auction.starting_bid < 100_000) continue;
    groups.set(key, [...(groups.get(key) ?? []), auction]);
  }

  return [...groups.entries()]
    .map(([name, list]) => {
      const sorted = [...list].sort((a, b) => a.starting_bid - b.starting_bid);
      const lowest = sorted[0]?.starting_bid ?? 0;
      const secondLowest = sorted[1]?.starting_bid ?? lowest;
      const median = sorted[Math.floor(sorted.length / 2)]?.starting_bid ?? lowest;
      const gap = median - lowest;
      const discountPercent = median ? (gap / median) * 100 : 0;
      const undercutRisk = secondLowest > lowest ? Math.min((secondLowest - lowest) / Math.max(gap, 1), 1) : 0.15;
      const liquidityScore = Math.log10(list.length + 1);
      const score = gap * Math.max(discountPercent, 0) * liquidityScore * undercutRisk;
      return { name, count: list.length, lowest, secondLowest, median, gap, discountPercent, score };
    })
    .filter((item) => item.count >= 4 && item.gap >= 50_000 && item.discountPercent >= 6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
};

export const getMarketAlerts = (products: MarketItem[], tracked: TrackedBuy[], signalProducts = products): MarketAlert[] => {
  const visibleSignals = signalProducts.filter((item) => !item.isIgnoredEnchantment);
  const marketAlerts = visibleSignals
    .filter((item) => {
      const isExpensiveEnough = item.buyOrderPrice >= 25_000;
      const hasMeaningfulSpread = item.spread >= 2_500;
      const hasUsefulMargin = item.spreadPercent >= 1.2 && item.spreadPercent <= 45;
      const hasLiquidity = item.sideFlow >= 1_000 && item.flowBalance >= 0.2 && item.orderDepth >= 5 && item.weeklyCoins >= 75_000_000;
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
      message: `${formatCoins(item.orderFlipSpread)} order spread, ${item.orderFlipPercent.toFixed(1)}% margin, about ${item.suggestedUnits} units for ${formatCoins(item.suggestedProfit)} gross`,
    }));

  const watchAlerts = visibleSignals
    .filter((item) => item.buyOrderPrice >= 1_000_000 && item.orderFlipPercent >= 0.8 && item.orderFlipSpread >= 25_000 && item.volume >= 40)
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 3)
    .map((item) => ({
      id: `watch-${item.id}`,
      item: item.name,
      type: "watch" as const,
      severity: "watch" as const,
      message: `Expensive item watch: ${formatCoins(item.orderFlipSpread)} order spread on ${formatCoins(item.sellOrderPrice)} sell order`,
    }));

  const profitAlerts = tracked.flatMap((buy) => {
    const market = products.find((item) => item.id === buy.item || item.name.toLowerCase() === buy.item.toLowerCase());
    if (!market) return [];
    const feePercent = buy.feePercent ?? 1.25;
    const target = buy.targetSellPrice ?? buy.buyPrice * (1 + buy.targetPercent / 100);
    const netSell = market.sellOrderPrice * (1 - feePercent / 100);
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
      maxMarginPercent: 90,
      minWeeklyCoins: 100_000_000,
      minSideFlow: 2_500,
      minFlowBalance: 0.28,
      minOrderDepth: 6,
      maxSuggestedUnits: 400,
    },
    expensive: {
      preset,
      minSellPrice: 1_000_000,
      minSpread: 25_000,
      maxMarginPercent: 80,
      minWeeklyCoins: 30_000_000,
      minSideFlow: 120,
      minFlowBalance: 0.12,
      minOrderDepth: 2,
      maxSuggestedUnits: 80,
    },
    "low-count": {
      preset,
      minSellPrice: 100_000,
      minSpread: 10_000,
      maxMarginPercent: 140,
      minWeeklyCoins: 20_000_000,
      minSideFlow: 250,
      minFlowBalance: 0.18,
      minOrderDepth: 2,
      maxSuggestedUnits: 50,
    },
    liquid: {
      preset,
      minSellPrice: 10_000,
      minSpread: 1_500,
      maxMarginPercent: 60,
      minWeeklyCoins: 250_000_000,
      minSideFlow: 20_000,
      minFlowBalance: 0.35,
      minOrderDepth: 10,
      maxSuggestedUnits: 600,
    },
  };

  return presets[preset];
};

export const applyFlipFilters = (
  items: MarketItem[],
  filters: FlipFilters,
  settings?: Pick<MarketSettings, "ignoreHighLevelEnchantments" | "minProfit">,
) =>
  items
    .filter((item) => {
      const ignoresItem = settings?.ignoreHighLevelEnchantments !== false && item.isIgnoredEnchantment;
      const meetsPrice = item.buyOrderPrice >= filters.minSellPrice;
      const meetsSpread = item.spread >= filters.minSpread;
      const meetsProfit = item.suggestedProfit >= (settings?.minProfit ?? 0);
      const meetsMargin = item.orderFlipPercent <= filters.maxMarginPercent;
      const meetsCoins = item.weeklyCoins >= filters.minWeeklyCoins;
      const meetsFlow = item.sideFlow >= filters.minSideFlow;
      const meetsBalance = item.flowBalance >= filters.minFlowBalance;
      const meetsDepth = item.orderDepth >= filters.minOrderDepth;
      const meetsUnits = item.suggestedUnits <= filters.maxSuggestedUnits;
      return !ignoresItem && meetsPrice && meetsSpread && meetsProfit && meetsMargin && meetsCoins && meetsFlow && meetsBalance && meetsDepth && meetsUnits;
    })
    .sort((a, b) => b.practicalScore - a.practicalScore);
