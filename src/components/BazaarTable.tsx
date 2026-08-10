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
          <span>Buy</span>
          <span>Sell</span>
          <span>Margin</span>
        </div>
        {items.slice(0, 14).map((item) => (
          <button className={`row ${selectedId === item.id ? "selected" : ""}`} key={item.id} onClick={() => onSelect(item.id)}>
            <span>{item.name}</span>
            <span>{formatCoins(item.buyPrice)}</span>
            <span>{formatCoins(item.sellPrice)}</span>
            <span className={item.spreadPercent > 4 ? "positive" : ""}>{item.spreadPercent.toFixed(1)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}
