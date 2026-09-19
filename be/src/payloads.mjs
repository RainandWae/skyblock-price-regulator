import { encodeBody } from "./compress.mjs";

// Hypixel's naming is from the order book's point of view, not the trader's:
// quick_status.sellPrice is what you pay when your buy order fills, and
// buyPrice is what you receive when your sell offer fills. Resolving that here
// means the client never has to think about it again.
const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

export const trimBazaar = (upstream) => ({
  success: true,
  lastUpdated: upstream.lastUpdated ?? Date.now(),
  products: Object.fromEntries(
    Object.entries(upstream.products ?? {}).map(([id, product]) => {
      const quick = product.quick_status ?? {};
      return [
        id,
        {
          buyOrderPrice: round(quick.sellPrice),
          sellOrderPrice: round(quick.buyPrice),
          buyMovingWeek: Math.round(Number(quick.buyMovingWeek) || 0),
          sellMovingWeek: Math.round(Number(quick.sellMovingWeek) || 0),
          buyOrders: Math.round(Number(quick.buyOrders) || 0),
          sellOrders: Math.round(Number(quick.sellOrders) || 0),
        },
      ];
    }),
  ),
});

export const trimAuctions = (upstream) => ({
  success: true,
  lastUpdated: upstream.lastUpdated ?? Date.now(),
  page: upstream.page ?? 0,
  totalPages: upstream.totalPages ?? 0,
  totalAuctions: upstream.totalAuctions ?? 0,
  auctions: (upstream.auctions ?? [])
    .filter((auction) => auction.bin)
    // The colour codes are stripped here because every consumer stripped them
    // anyway, and they are about a fifth of the name bytes.
    .map((auction) => ({
      name: String(auction.item_name ?? "").replace(/§./g, ""),
      price: Math.round(Number(auction.starting_bid) || 0),
    })),
});

/**
 * Trims and encodes once per upstream payload, keyed on lastUpdated. Clients
 * polling between refreshes all get the same cached bytes.
 */
export const createPayloadCache = (trim) => {
  const cache = new Map();

  return (upstream, key = "default") => {
    const stamp = `${key}:${upstream.lastUpdated ?? 0}`;
    const cached = cache.get(key);
    if (cached?.stamp === stamp) return cached.encoded;

    const encoded = encodeBody(trim(upstream));
    cache.set(key, { stamp, encoded });
    return encoded;
  };
};
