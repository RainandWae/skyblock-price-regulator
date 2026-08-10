import { CircleDollarSign, ShoppingCart } from "lucide-react";
import type { MarketItem } from "../types/market";
import { formatCoins } from "../lib/format";
import { MiniChart } from "./MiniChart";

type ItemDetailProps = {
  item?: MarketItem;
  history: number[];
  quantity: number;
  targetPercent: number;
  onQuantityChange: (quantity: number) => void;
  onTargetPercentChange: (targetPercent: number) => void;
  onRecordBuy: () => void;
};

export function ItemDetail({
  item,
  history,
  quantity,
  targetPercent,
  onQuantityChange,
  onTargetPercentChange,
  onRecordBuy,
}: ItemDetailProps) {
  return (
    <aside className="detailPanel">
      <div className="detailHeader">
        <CircleDollarSign size={22} />
        <div>
          <h3>{item?.name ?? "No item selected"}</h3>
          <p>{item?.id ?? "Refresh market data to begin"}</p>
        </div>
      </div>
      <MiniChart points={history.length > 1 ? history : [0, item?.buyPrice ?? 0]} tone="blue" />
      <div className="metrics">
        <span>Instant buy <strong>{formatCoins(item?.buyPrice ?? 0)}</strong></span>
        <span>Instant sell <strong>{formatCoins(item?.sellPrice ?? 0)}</strong></span>
        <span>Spread <strong>{formatCoins(item?.spread ?? 0)}</strong></span>
      </div>
      <div className="buyBox">
        <label>
          Quantity
          <input type="number" min={1} value={quantity} onChange={(event) => onQuantityChange(Number(event.target.value))} />
        </label>
        <label>
          Target %
          <input type="number" min={1} value={targetPercent} onChange={(event) => onTargetPercentChange(Number(event.target.value))} />
        </label>
        <button onClick={onRecordBuy}>
          <ShoppingCart size={17} />
          Bought now
        </button>
      </div>
    </aside>
  );
}
