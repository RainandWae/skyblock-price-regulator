import { Gauge } from "lucide-react";
import type { AuctionSignal } from "../types/market";
import { formatCoins } from "../lib/format";

type AuctionScannerProps = {
  signals: AuctionSignal[];
};

export function AuctionScanner({ signals }: AuctionScannerProps) {
  return (
    <div className="panel">
      <div className="panelHeader compact">
        <h3>Auction House Scanner</h3>
        <Gauge size={18} />
      </div>
      <div className="auctionList">
        {signals.map((item) => (
          <div className="auctionItem" key={item.name}>
            <div>
              <strong>{item.name}</strong>
              <span>
                {item.count} active BINs - {item.discountPercent.toFixed(1)}% below median
              </span>
            </div>
            <div>
              <b>{formatCoins(item.lowest)}</b>
              <span>{formatCoins(item.gap)} gap - next {formatCoins(item.secondLowest)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
