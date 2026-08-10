import { useEffect, useRef, useState } from "react";
import type { FlipFilters as FlipFiltersType, FlipPreset } from "../types/market";
import { formatCoins } from "../lib/format";
import { getCompactNumberWarning, parseCompactNumberInput } from "../lib/quantity";

type FlipFiltersProps = {
  filters: FlipFiltersType;
  resultCount: number;
  totalCount: number;
  onChange: (filters: FlipFiltersType) => void;
};

const presets: Array<{ id: FlipPreset; label: string }> = [
  { id: "balanced", label: "Balanced" },
  { id: "expensive", label: "Expensive" },
  { id: "low-count", label: "Low count" },
  { id: "liquid", label: "Liquid" },
];

const formatInputNumber = (value: number) => value.toLocaleString("en-US");

type CompactFilterFieldProps = {
  label: string;
  value: number;
  summary: string;
  allowZero?: boolean;
  onChange: (value: number) => void;
};

function CompactFilterField({ label, value, summary, allowZero = true, onChange }: CompactFilterFieldProps) {
  const [rawValue, setRawValue] = useState(formatInputNumber(value));
  const [wasChecked, setWasChecked] = useState(false);
  const lastValueRef = useRef(value);
  const warning = getCompactNumberWarning(rawValue, label, { allowZero });
  const isInvalid = wasChecked && warning !== "";

  useEffect(() => {
    if (lastValueRef.current !== value) {
      const parsedRawValue = parseCompactNumberInput(rawValue);
      lastValueRef.current = value;
      if (parsedRawValue === value) return;

      setRawValue(formatInputNumber(value));
      setWasChecked(false);
    }
  }, [rawValue, value]);

  const handleChange = (nextValue: string) => {
    setRawValue(nextValue);
    const parsedValue = parseCompactNumberInput(nextValue);
    const nextWarning = getCompactNumberWarning(nextValue, label, { allowZero });
    if (nextWarning === "" && Number.isFinite(parsedValue)) {
      onChange(parsedValue);
    }
  };

  return (
    <label className={isInvalid ? "invalid" : ""}>
      <span className="fieldTitle">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={rawValue}
        onBlur={() => {
          setWasChecked(true);
          const parsedValue = parseCompactNumberInput(rawValue);
          if (getCompactNumberWarning(rawValue, label, { allowZero }) === "" && Number.isFinite(parsedValue)) {
            setRawValue(formatInputNumber(parsedValue));
          }
        }}
        onChange={(event) => handleChange(event.target.value)}
      />
      <span>{summary}</span>
      {isInvalid ? <span className="fieldWarning">{warning}</span> : null}
    </label>
  );
}

export function FlipFilters({ filters, resultCount, totalCount, onChange }: FlipFiltersProps) {
  const update = (updates: Partial<FlipFiltersType>) => onChange({ ...filters, ...updates });

  return (
    <div className="filterPanel">
      <div className="filterSummary">
        <strong>{resultCount}</strong>
        <span>of {totalCount} Bazaar items match</span>
        <span>Level 2+ enchants ignored</span>
      </div>
      <div className="presetGroup" aria-label="Flip filter preset">
        {presets.map((preset) => (
          <button
            className={filters.preset === preset.id ? "active" : ""}
            key={preset.id}
            onClick={() => update({ preset: preset.id })}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <span className="filterHint">k, m, b, t accepted</span>
      <div className="filterGrid">
        <CompactFilterField
          label="Min sell"
          value={filters.minSellPrice}
          summary={formatCoins(filters.minSellPrice)}
          onChange={(minSellPrice) => update({ minSellPrice })}
        />
        <CompactFilterField
          label="Min profit"
          value={filters.minSpread}
          summary={formatCoins(filters.minSpread)}
          onChange={(minSpread) => update({ minSpread })}
        />
        <CompactFilterField
          label="Weekly coins"
          value={filters.minWeeklyCoins}
          summary={formatCoins(filters.minWeeklyCoins)}
          onChange={(minWeeklyCoins) => update({ minWeeklyCoins })}
        />
        <label>
          Max margin
          <input
            type="number"
            min={1}
            step={5}
            value={filters.maxMarginPercent}
            onChange={(event) => update({ maxMarginPercent: Number(event.target.value) })}
          />
          <span>{filters.maxMarginPercent}% cap</span>
        </label>
        <CompactFilterField
          label="Side flow"
          value={filters.minSideFlow}
          summary={`${filters.minSideFlow.toLocaleString()} each side`}
          onChange={(minSideFlow) => update({ minSideFlow })}
        />
        <CompactFilterField
          label="Order depth"
          value={filters.minOrderDepth}
          summary={`${filters.minOrderDepth.toLocaleString()} each side`}
          onChange={(minOrderDepth) => update({ minOrderDepth })}
        />
        <label>
          Balance
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={filters.minFlowBalance}
            onChange={(event) => update({ minFlowBalance: Number(event.target.value) })}
          />
          <span>{Math.round(filters.minFlowBalance * 100)}% min</span>
        </label>
        <CompactFilterField
          label="Max units"
          value={filters.maxSuggestedUnits}
          summary={`${filters.maxSuggestedUnits.toLocaleString()} items`}
          allowZero={false}
          onChange={(maxSuggestedUnits) => update({ maxSuggestedUnits })}
        />
      </div>
    </div>
  );
}
