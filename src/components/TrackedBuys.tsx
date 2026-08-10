import { Clock3, History } from "lucide-react";
import type { MarketItem, TrackedBuy } from "../types/market";
import { cleanName, formatCoins } from "../lib/format";

type TrackedBuysProps = {
  buys: TrackedBuy[];
  products: MarketItem[];
  onRemove: (id: string) => void;
};

export function TrackedBuys({ buys, products, onRemove }: TrackedBuysProps) {
  return (
    <div className="panel">
      <div className="panelHeader compact">
        <h3>Tracked Buys</h3>
        <History size={18} />
      </div>
      <div className="trackedList">
        {buys.length ? (
          buys.map((buy) => {
            const market = products.find((item) => item.id === buy.item);
            const current = market?.sellPrice ?? buy.buyPrice;
            const profit = (current - buy.buyPrice) * buy.quantity;
            return (
              <div className="trackedItem" key={buy.id}>
                <Clock3 size={16} />
                <div>
                  <strong>{cleanName(buy.item)}</strong>
                  <span>
                    Bought {buy.quantity} at {formatCoins(buy.buyPrice)} - P/L {formatCoins(profit)}
                  </span>
                </div>
                <button aria-label="Remove tracked buy" onClick={() => onRemove(buy.id)}>
                  x
                </button>
              </div>
            );
          })
        ) : (
          <p className="empty">Click Bought now on an item to start watching its profit zone.</p>
        )}
      </div>
    </div>
  );
}
