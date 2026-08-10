import { RefreshCw } from "lucide-react";

type TopBarProps = {
  onRefresh: () => void;
};

export function TopBar({ onRefresh }: TopBarProps) {
  return (
    <section className="topbar">
      <div>
        <h1>SkyBlock Price Regulator</h1>
      </div>
      <button className="iconButton" onClick={onRefresh} aria-label="Refresh market">
        <RefreshCw size={18} />
      </button>
    </section>
  );
}
