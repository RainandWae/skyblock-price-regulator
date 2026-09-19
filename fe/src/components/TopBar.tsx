import { RefreshCw, SlidersHorizontal } from "lucide-react";

type TopBarProps = {
  onRefresh: () => void;
};

export function TopBar({ onRefresh }: TopBarProps) {
  return (
    <section className="topbar">
      <div className="brandLockup">
        <div className="brandMark" aria-hidden="true">
          <span className="brandCoin">S</span>
          <SlidersHorizontal size={15} strokeWidth={2.4} />
        </div>
        <h1>SkyBlock Price Regulator</h1>
      </div>
      <button className="iconButton" onClick={onRefresh} aria-label="Refresh market">
        <RefreshCw size={18} />
      </button>
    </section>
  );
}
