export type BazaarProduct = {
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

export type Auction = {
  uuid: string;
  item_name: string;
  tier: string;
  category: string;
  starting_bid: number;
  highest_bid_amount: number;
  bin?: boolean;
  end: number;
};

export type BazaarHistoryPoint = {
  at: number;
  buyPrice: number;
  sellPrice: number;
  buyVolume: number;
  sellVolume: number;
};

export type TrackedBuy = {
  id: string;
  item: string;
  market: "bazaar" | "auction";
  quantity: number;
  buyPrice: number;
  targetPercent: number;
  boughtAt: number;
};

export type MarketItem = {
  id: string;
  name: string;
  buyPrice: number;
  sellPrice: number;
  volume: number;
  weeklyCoins: number;
  spread: number;
  spreadPercent: number;
  practicalScore: number;
  suggestedUnits: number;
  suggestedProfit: number;
  orders: number;
};

export type AuctionSignal = {
  name: string;
  count: number;
  lowest: number;
  median: number;
  gap: number;
};

export type MarketAlert = {
  id: string;
  item: string;
  type: "high" | "low" | "spread" | "profit" | "watch";
  message: string;
  severity: "hot" | "good" | "watch";
};
