import { Bell, ChartLine, Gauge } from "lucide-react";

type HeroPanelProps = {
  status: string;
  lastUpdated: number | null;
  productCount: number;
  auctionSignalCount: number;
  alertCount: number;
};

export function HeroPanel({ status, lastUpdated, productCount, auctionSignalCount, alertCount }: HeroPanelProps) {
  return (
    <section className="heroPanel">
      <div>
        <p className="statusLine">
          <span className={`statusDot ${status === "Live" ? "live" : ""}`} />
          {status}
          {lastUpdated ? ` - ${new Date(lastUpdated).toLocaleTimeString()}` : ""}
        </p>
        <h2>Watch Bazaar prices, spot unusual margins, and track when your buys reach profit.</h2>
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
