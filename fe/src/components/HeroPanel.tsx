import { useEffect, useState } from "react";
import { Bell, ChartLine, Gauge } from "lucide-react";

type HeroPanelProps = {
  status: string;
  lastUpdated: number | null;
  productCount: number;
  auctionSignalCount: number;
  alertCount: number;
};

const formatUpdatedAgo = (elapsedMs: number) => {
  const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  if (elapsedSeconds < 5) return "just now";
  if (elapsedSeconds < 60) return `${elapsedSeconds}s ago`;
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  return `${elapsedHours}h ago`;
};

export function HeroPanel({ status, lastUpdated, productCount, auctionSignalCount, alertCount }: HeroPanelProps) {
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const statusText =
    status === "Live" && lastUpdated
      ? `Live data - updated ${formatUpdatedAgo(currentTime - lastUpdated)}`
      : status;

  return (
    <section className="heroPanel">
      <div>
        <p className="statusLine">
          <span className={`statusDot ${status === "Live" ? "live" : ""}`} />
          {statusText}
        </p>
        <h2>Order-flip watchlist with liquidity-aware Bazaar signals.</h2>
      </div>
      <div className="heroStats">
        <div>
          <ChartLine size={18} />
          <strong>{productCount}</strong>
          <span>Bazaar items</span>
        </div>
        <div>
          <Gauge size={18} />
          <strong>{auctionSignalCount}</strong>
          <span>AH signals</span>
        </div>
        <div>
          <Bell size={18} />
          <strong>{alertCount}</strong>
          <span>Alerts</span>
        </div>
      </div>
    </section>
  );
}
