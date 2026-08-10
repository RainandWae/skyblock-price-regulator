import { useMemo } from "react";
import type { BazaarHistoryPoint, MarketItem } from "../types/market";
import { formatCoins } from "../lib/format";

type MarketChartProps = {
  item?: MarketItem;
  history: BazaarHistoryPoint[];
};

type ChartPoint = {
  at: number;
  buyOrderPrice: number;
  sellOrderPrice: number;
};

const chartWidth = 280;
const plotLeft = 34;
const plotRight = 274;
const plotWidth = plotRight - plotLeft;

const average = (values: number[]) =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;

const formatAxisCoins = (value: number) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(2)}m`
    : value >= 1_000
      ? `${(value / 1_000).toFixed(1)}k`
      : value.toFixed(0);

const getChartBounds = (values: number[]) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mid = (min + max) / 2 || 1;
  const observedRange = max - min;
  const minimumRange = mid * 0.08;
  const range = Math.max(observedRange, minimumRange, 1);
  const padding = range * 0.16;
  return {
    min: Math.max(0, min - padding),
    max: max + padding,
  };
};

const makePath = (points: ChartPoint[], key: "buyOrderPrice" | "sellOrderPrice", min: number, span: number) =>
  points
    .map((point, index) => {
      const x = plotLeft + (index / Math.max(points.length - 1, 1)) * plotWidth;
      const y = 84 - ((point[key] - min) / span) * 68;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

export function MarketChart({ item, history }: MarketChartProps) {
  const chart = useMemo(() => {
    const historyPoints = history.map((point) => ({
      at: point.at,
      buyOrderPrice: point.sellPrice,
      sellOrderPrice: point.buyPrice,
    }));

    const currentPoint = item
      ? [
          {
            at: Date.now(),
            buyOrderPrice: item.buyOrderPrice,
            sellOrderPrice: item.sellOrderPrice,
          },
        ]
      : [];

    const points = [...historyPoints, ...currentPoint].filter(
      (point) => Number.isFinite(point.buyOrderPrice) && Number.isFinite(point.sellOrderPrice),
    );
    const fallback = item
      ? [
          {
            at: Date.now() - 60_000,
            buyOrderPrice: item.buyOrderPrice * 0.998,
            sellOrderPrice: item.sellOrderPrice * 1.002,
          },
          { at: Date.now(), buyOrderPrice: item.buyOrderPrice, sellOrderPrice: item.sellOrderPrice },
        ]
      : [];
    const visiblePoints = points.length > 1 ? points.slice(-80) : fallback;
    const values = visiblePoints.flatMap((point) => [point.buyOrderPrice, point.sellOrderPrice]);
    const bounds = getChartBounds(values.length ? values : [0, 1]);
    const chartMin = bounds.min;
    const chartMax = bounds.max;
    const span = chartMax - chartMin || 1;
    const buyAverage = average(visiblePoints.map((point) => point.buyOrderPrice));
    const sellAverage = average(visiblePoints.map((point) => point.sellOrderPrice));
    const gridValues = [chartMax, chartMin + span * 0.66, chartMin + span * 0.33, chartMin];

    return {
      points: visiblePoints,
      buyPath: makePath(visiblePoints, "buyOrderPrice", chartMin, span),
      sellPath: makePath(visiblePoints, "sellOrderPrice", chartMin, span),
      buyAverage,
      sellAverage,
      gridValues,
    };
  }, [history, item]);

  return (
    <div className="marketChart">
      <div className="chartToolbar">
        <div>
          <span className="chartLabel">Bazaar order prices</span>
        </div>
        <div className="chartLegend">
          <span><i className="legendBuy" /> Buy order</span>
          <span><i className="legendSell" /> Sell order</span>
          <span><i className="legendGrid" /> Price grid</span>
        </div>
      </div>
      <div className="chartCanvas">
        <svg viewBox={`0 0 ${chartWidth} 100`} role="img" aria-label="Buy order and sell order price chart">
          {chart.gridValues.map((value, index) => {
            const y = 16 + index * 22.6;
            return (
              <g key={`${value}-${index}`}>
                <text className="axisLabel" x="3" y={y - 1}>
                  {formatAxisCoins(value)}
                </text>
                <path className="gridLine" d={`M ${plotLeft} ${y} L ${plotRight} ${y}`} />
              </g>
            );
          })}
          <path className="chartLine sell" d={chart.sellPath} />
          <path className="chartLine buy" d={chart.buyPath} />
        </svg>
      </div>
      <div className="chartFooter">
        <span>Avg buy order <strong>{formatCoins(chart.buyAverage)}</strong></span>
        <span>Avg sell order <strong>{formatCoins(chart.sellAverage)}</strong></span>
        <span>Points <strong>{chart.points.length}</strong></span>
      </div>
    </div>
  );
}
