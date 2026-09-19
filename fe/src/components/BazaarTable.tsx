import { Search } from "lucide-react";
import type { MarketItem } from "../types/market";
import { formatCoins } from "../lib/format";

type BazaarTableProps = {
  items: MarketItem[];
  selectedId?: string;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (id: string) => void;
};

export function BazaarTable({ items, selectedId, query, onQueryChange, onSelect }: BazaarTableProps) {
  return (
    <div className="marketPanel">
      <div className="panelHeader">
        <div>
          <h3>Bazaar Market</h3>
          <p>High volume items sorted by weekly movement.</p>
        </div>
        <label className="searchBox">
          <Search size={16} />
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search item" />
        </label>
      </div>
      <div className="table">
        <div className="tableHeader" aria-hidden="true">
          <span>Item</span>
          <span>Buy order</span>
          <span>Sell order</span>
          <span>Profit</span>
        </div>
        {items.slice(0, 14).map((item) => (
          <button className={`row ${selectedId === item.id ? "selected" : ""}`} key={item.id} onClick={() => onSelect(item.id)}>
            <span className="itemCell">
              <strong>{item.name}</strong>
              <small>
                {formatCoins(item.weeklyCoins)} weekly - {item.sideFlow.toLocaleString()} flow - {Math.round(item.flowBalance * 100)}% balance
              </small>
            </span>
            <span>{formatCoins(item.buyOrderPrice)}</span>
            <span>{formatCoins(item.sellOrderPrice)}</span>
            <span className={item.spread >= 2_500 ? "positive" : ""}>
              {formatCoins(item.orderFlipSpread)}
              <small>{item.orderFlipPercent.toFixed(1)}%</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
