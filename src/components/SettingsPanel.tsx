import { Settings } from "lucide-react";
import type { MarketSettings } from "../types/market";

type SettingsPanelProps = {
  settings: MarketSettings;
  onChange: (settings: MarketSettings) => void;
};

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const update = (updates: Partial<MarketSettings>) => onChange({ ...settings, ...updates });

  return (
    <div className="settingsPanel">
      <div className="settingsHeader">
        <div>
          <h3>Settings</h3>
          <span>Saved on this browser</span>
        </div>
        <Settings size={18} />
      </div>
      <div className="settingsGrid">
        <label>
          Refresh seconds
          <input
            min={30}
            step={15}
            type="number"
            value={settings.refreshIntervalSeconds}
            onChange={(event) => update({ refreshIntervalSeconds: Math.max(30, Number(event.target.value) || 30) })}
          />
        </label>
        <label>
          Default fee %
          <input
            min={0}
            step={0.25}
            type="number"
            value={settings.defaultFeePercent}
            onChange={(event) => update({ defaultFeePercent: Math.max(0, Number(event.target.value) || 0) })}
          />
        </label>
        <label>
          Default target %
          <input
            min={1}
            step={1}
            type="number"
            value={settings.defaultTargetPercent}
            onChange={(event) => update({ defaultTargetPercent: Math.max(1, Number(event.target.value) || 1) })}
          />
        </label>
        <label>
          Min profit
          <input
            min={0}
            step={2_500}
            type="number"
            value={settings.minProfit}
            onChange={(event) => update({ minProfit: Math.max(0, Number(event.target.value) || 0) })}
          />
        </label>
        <label className="settingToggle">
          <input
            checked={settings.ignoreHighLevelEnchantments}
            type="checkbox"
            onChange={(event) => update({ ignoreHighLevelEnchantments: event.target.checked })}
          />
          Ignore level 2+ enchants
        </label>
        <label className="settingToggle">
          <input
            checked={settings.ignoreAuctionBooks}
            type="checkbox"
            onChange={(event) => update({ ignoreAuctionBooks: event.target.checked })}
          />
          Ignore AH books
        </label>
      </div>
    </div>
  );
}
