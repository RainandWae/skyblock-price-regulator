import type { Auction, BazaarHistoryPoint, BazaarProduct } from "../types/market";

export const fetchMarketData = async () => {
  const [bazaarResponse, auctionResponse] = await Promise.all([
    fetch("/api/bazaar"),
    fetch("/api/auctions?page=0"),
  ]);

  if (!bazaarResponse.ok) throw new Error(`Bazaar request failed: ${bazaarResponse.status}`);
  if (!auctionResponse.ok) throw new Error(`Auction request failed: ${auctionResponse.status}`);

  const bazaarData = await bazaarResponse.json();
  const auctionData = await auctionResponse.json();

  return {
    products: bazaarData.products as Record<string, BazaarProduct>,
    auctions: (auctionData.auctions as Auction[]).filter((auction) => auction.bin).slice(0, 500),
  };
};

export const fetchItemHistory = async (productId: string): Promise<BazaarHistoryPoint[]> => {
  const response = await fetch(`/api/history/${encodeURIComponent(productId)}`);
  if (!response.ok) throw new Error("History request failed");
  const data = await response.json();
  return data.points ?? [];
};
