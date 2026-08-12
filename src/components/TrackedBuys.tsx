import { CheckCircle2, Clock3, History } from "lucide-react";
import type { MarketItem, TrackedBuy } from "../types/market";
import { cleanName, formatCoins } from "../lib/format";

type TrackedBuysProps = {
  buys: TrackedBuy[];
  products: MarketItem[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<TrackedBuy>) => void;
};

const getBuyMetrics = (buy: TrackedBuy, products: MarketItem[]) => {
  const market = products.find((item) => item.id === buy.item);
  const feePercent = buy.feePercent ?? 1.25;
  const targetSellPrice = buy.targetSellPrice ?? buy.buyPrice * (1 + buy.targetPercent / 100);
  const currentSell = market?.sellOrderPrice ?? buy.buyPrice;
  const netSell = currentSell * (1 - feePercent / 100);
  const totalCost = buy.buyPrice * buy.quantity;
  const netReturn = netSell * buy.quantity;
  const grossProfit = (currentSell - buy.buyPrice) * buy.quantity;
  const netProfit = (netSell - buy.buyPrice) * buy.quantity;
  const roi = buy.buyPrice ? ((netSell - buy.buyPrice) / buy.buyPrice) * 100 : 0;
  const targetGap = Math.max(0, targetSellPrice - netSell);
  const status = buy.status === "sold" ? "sold" : netSell >= targetSellPrice ? "ready" : "watching";

  return { currentSell, netSell, totalCost, netReturn, grossProfit, netProfit, roi, targetSellPrice, targetGap, feePercent, status };
};

const getStatusLabel = (status: string) => {
  if (status === "ready") return "ready to sell";
  if (status === "sold") return "sold";
  return "watching";
};

export function TrackedBuys({ buys, products, onRemove, onUpdate }: TrackedBuysProps) {
  return (
    <div className="panel">
      <div className="panelHeader compact">
        <h3>Tracked Buys</h3>
        <History size={18} />
      </div>
      <div className="trackedList">
        {buys.length ? (
          buys.map((buy) => {
            const metrics = getBuyMetrics(buy, products);
            return (
              <div className={`trackedItem ${metrics.status}`} key={buy.id}>
                {metrics.status === "ready" ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}
                <div className="trackedBody">
                  <div className="trackedTitle">
                    <strong>{cleanName(buy.item)}</strong>
                    <span>{getStatusLabel(metrics.status)}</span>
                  </div>
                  <div className="trackedInputs">
                    <label>
                      Qty
                      <input
                        type="number"
                        min={1}
                        value={buy.quantity}
                        onChange={(event) => onUpdate(buy.id, { quantity: Number(event.target.value) })}
                      />
                    </label>
                    <label>
                      Buy order
                      <input
                        type="number"
                        min={0}
                        value={Math.round(buy.buyPrice)}
                        onChange={(event) =>
                          onUpdate(buy.id, {
                            buyPrice: Number(event.target.value),
                            targetSellPrice: Number(event.target.value) * (1 + buy.targetPercent / 100),
                          })
                        }
                      />
                    </label>
                    <label>
                      Target
                      <input
                        type="number"
                        min={0}
                        value={Math.round(metrics.targetSellPrice)}
                        onChange={(event) => onUpdate(buy.id, { targetSellPrice: Number(event.target.value) })}
                      />
                    </label>
                    <label>
                      Fee %
                      <input
                        type="number"
                        min={0}
                        step={0.25}
                        value={metrics.feePercent}
                        onChange={(event) => onUpdate(buy.id, { feePercent: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                  <div className="trackedMetrics">
                    <span>Sell order {formatCoins(metrics.currentSell)}</span>
                    <span>Net each {formatCoins(metrics.netSell)}</span>
                    <span>Target {formatCoins(metrics.targetSellPrice)}</span>
                    <span>Gap {formatCoins(metrics.targetGap)}</span>
                    <span>Cost {formatCoins(metrics.totalCost)}</span>
                    <span>Net return {formatCoins(metrics.netReturn)}</span>
                    <span>Fees {metrics.feePercent.toFixed(2)}%</span>
                    <span className={metrics.netProfit >= 0 ? "positive" : "negative"}>
                      Net P/L {formatCoins(metrics.netProfit)}
                    </span>
                    <span>ROI {metrics.roi.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="trackedActions">
                  <button
                    aria-label="Mark tracked buy sold"
                    onClick={() => onUpdate(buy.id, { status: buy.status === "sold" ? "watching" : "sold" })}
                  >
                    {buy.status === "sold" ? "watch" : "sold"}
                  </button>
                  <button aria-label="Remove tracked buy" onClick={() => onRemove(buy.id)}>
                    x
                  </button>
                </div>
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
