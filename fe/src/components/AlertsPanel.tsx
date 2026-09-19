import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import type { MarketAlert } from "../types/market";

type AlertsPanelProps = {
  alerts: MarketAlert[];
};

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  return (
    <div className="panel">
      <div className="panelHeader compact">
        <h3>Alerts</h3>
        <AlertTriangle size={18} />
      </div>
      <div className="alertList">
        {alerts.length ? (
          alerts.map((alert) => (
            <div className={`alert ${alert.severity}`} key={alert.id}>
              {alert.type === "profit" ? <TrendingUp size={17} /> : <TrendingDown size={17} />}
              <div>
                <strong>{alert.item}</strong>
                <span>{alert.message}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="empty">No alerts yet. Refresh again after a few snapshots or track a buy.</p>
        )}
      </div>
    </div>
  );
}
