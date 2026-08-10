import type { FlipFilters as FlipFiltersType, FlipPreset } from "../types/market";
import { formatCoins } from "../lib/format";

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

export function FlipFilters({ filters, resultCount, totalCount, onChange }: FlipFiltersProps) {
  const update = (updates: Partial<FlipFiltersType>) => onChange({ ...filters, ...updates });

  return (
    <div className="filterPanel">
      <div className="filterSummary">
        <strong>{resultCount}</strong>
        <span>of {totalCount} Bazaar items match</span>
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
      <div className="filterGrid">
        <label>
          Min sell
          <input
            type="number"
            min={0}
            step={25_000}
            value={filters.minSellPrice}
            onChange={(event) => update({ minSellPrice: Number(event.target.value) })}
          />
          <span>{formatCoins(filters.minSellPrice)}</span>
        </label>
        <label>
          Min profit
          <input
            type="number"
            min={0}
            step={2_500}
            value={filters.minSpread}
            onChange={(event) => update({ minSpread: Number(event.target.value) })}
          />
          <span>{formatCoins(filters.minSpread)}</span>
        </label>
        <label>
          Weekly coins
          <input
            type="number"
            min={0}
            step={10_000_000}
            value={filters.minWeeklyCoins}
            onChange={(event) => update({ minWeeklyCoins: Number(event.target.value) })}
          />
          <span>{formatCoins(filters.minWeeklyCoins)}</span>
        </label>
        <label>
          Max units
          <input
            type="number"
            min={1}
            value={filters.maxSuggestedUnits}
            onChange={(event) => update({ maxSuggestedUnits: Number(event.target.value) })}
          />
          <span>{filters.maxSuggestedUnits} items</span>
        </label>
      </div>
    </div>
  );
}
