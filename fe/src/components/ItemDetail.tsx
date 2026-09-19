import { useEffect, useState } from "react";
import { AlertTriangle, Check, CircleDollarSign, ShoppingCart } from "lucide-react";
import type { BazaarHistoryPoint, MarketItem } from "../types/market";
import { formatCoins } from "../lib/format";
import { getQuantityWarning } from "../lib/quantity";
import { MarketChart } from "./MarketChart";

type ItemDetailProps = {
  item?: MarketItem;
  history: BazaarHistoryPoint[];
  quantity: string;
  targetPercent: string;
  onQuantityChange: (quantity: string) => void;
  onTargetPercentChange: (targetPercent: string) => void;
  onRecordBuy: () => void;
};

type FieldName = "quantity" | "targetPercent";

const startsWithLeadingZero = (value: string) => /^0\d/.test(value.trim());

const isValidPercentField = (value: string) => {
  const parsedValue = Number(value);
  return value.trim() !== "" && !startsWithLeadingZero(value) && Number.isFinite(parsedValue) && parsedValue > 0;
};

const getPercentWarning = (value: string, label: string) => {
  if (value.trim() === "") return `${label} is required`;
  if (startsWithLeadingZero(value)) return `${label} cannot start with 0`;
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return `${label} must be above 0`;
  return "";
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
  const [isConfirmingBuy, setIsConfirmingBuy] = useState(false);
  const [warnedFields, setWarnedFields] = useState<Record<FieldName, boolean>>({
    quantity: false,
    targetPercent: false,
  });
  const quantityWarning = getQuantityWarning(quantity);
  const targetPercentWarning = getPercentWarning(targetPercent, "Target percentage");
  const quantityInvalid = quantityWarning !== "";
  const targetPercentInvalid = !isValidPercentField(targetPercent);

  useEffect(() => {
    if (!isConfirmingBuy) return;
    const timeoutId = window.setTimeout(() => setIsConfirmingBuy(false), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [isConfirmingBuy]);

  const handleRecordBuy = () => {
    if (isConfirmingBuy || !item) return;
    if (quantityInvalid || targetPercentInvalid) {
      setWarnedFields({
        quantity: quantityInvalid,
        targetPercent: targetPercentInvalid,
      });
      return;
    }

    onRecordBuy();
    setIsConfirmingBuy(true);
  };

  const markFieldChecked = (field: FieldName) => {
    setWarnedFields((current) => ({ ...current, [field]: true }));
  };

  return (
    <aside className="detailPanel">
      <div className="detailHeader">
        <CircleDollarSign size={22} />
        <div>
          <h3>{item?.name ?? "No item selected"}</h3>
          <p>{item?.id ?? "Refresh market data to begin"}</p>
        </div>
      </div>
      <MarketChart item={item} history={history} />
      <div className="metrics">
        <span>Buy order <strong>{formatCoins(item?.buyOrderPrice ?? 0)}</strong></span>
        <span>Sell order <strong>{formatCoins(item?.sellOrderPrice ?? 0)}</strong></span>
        <span>Order spread <strong>{formatCoins(item?.orderFlipSpread ?? 0)}</strong></span>
      </div>
      <div className="buyBox">
        <label className={warnedFields.quantity && quantityInvalid ? "invalid" : ""}>
          <span className="fieldTitle">
            Quantity
            {warnedFields.quantity && quantityInvalid ? <AlertTriangle size={14} aria-label={quantityWarning} /> : null}
          </span>
          <span className="fieldHint">k, m, b, t accepted</span>
          {warnedFields.quantity && quantityInvalid ? <span className="fieldWarning">{quantityWarning}</span> : null}
          <input
            type="text"
            inputMode="decimal"
            value={quantity}
            onBlur={() => markFieldChecked("quantity")}
            onChange={(event) => onQuantityChange(event.target.value)}
          />
        </label>
        <label className={warnedFields.targetPercent && targetPercentInvalid ? "invalid" : ""}>
          <span className="fieldTitle">
            Target %
            {warnedFields.targetPercent && targetPercentInvalid ? (
              <AlertTriangle size={14} aria-label={targetPercentWarning} />
            ) : null}
          </span>
          {warnedFields.targetPercent && targetPercentInvalid ? (
            <span className="fieldWarning">{targetPercentWarning}</span>
          ) : null}
          <input
            type="number"
            min={1}
            value={targetPercent}
            onBlur={() => markFieldChecked("targetPercent")}
            onChange={(event) => onTargetPercentChange(event.target.value)}
          />
        </label>
        <button className={isConfirmingBuy ? "confirmed" : ""} disabled={isConfirmingBuy || !item} onClick={handleRecordBuy}>
          {isConfirmingBuy ? <Check size={17} /> : <ShoppingCart size={17} />}
          {isConfirmingBuy ? "Added to tracking" : "Bought now"}
        </button>
      </div>
    </aside>
  );
}
