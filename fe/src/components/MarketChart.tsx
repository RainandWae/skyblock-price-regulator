import { useMemo, useState } from "react";
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
const ranges = [
  { label: "1h", ms: 60 * 60_000 },
  { label: "6h", ms: 6 * 60 * 60_000 },
  { label: "24h", ms: 24 * 60 * 60_000 },
  { label: "All", ms: Number.POSITIVE_INFINITY },
];

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

const formatTime = (value: number) =>
  new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

export function MarketChart({ item, history }: MarketChartProps) {
  const [selectedRange, setSelectedRange] = useState(ranges[2]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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
    const newestAt = points[points.length - 1]?.at ?? Date.now();
    const rangedPoints = Number.isFinite(selectedRange.ms)
      ? points.filter((point) => point.at >= newestAt - selectedRange.ms)
      : points;
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
    const visiblePoints = rangedPoints.length > 1 ? rangedPoints : points.length > 1 ? points.slice(-80) : fallback;
    const values = visiblePoints.flatMap((point) => [point.buyOrderPrice, point.sellOrderPrice]);
    const bounds = getChartBounds(values.length ? values : [0, 1]);
    const chartMin = bounds.min;
    const chartMax = bounds.max;
    const span = chartMax - chartMin || 1;
    const buyAverage = average(visiblePoints.map((point) => point.buyOrderPrice));
    const sellAverage = average(visiblePoints.map((point) => point.sellOrderPrice));
    const spreadAverage = sellAverage - buyAverage;
    const gridValues = [chartMax, chartMin + span * 0.66, chartMin + span * 0.33, chartMin];
    const renderedPoints = visiblePoints.map((point, index) => ({
      ...point,
      x: plotLeft + (index / Math.max(visiblePoints.length - 1, 1)) * plotWidth,
      buyY: 84 - ((point.buyOrderPrice - chartMin) / span) * 68,
      sellY: 84 - ((point.sellOrderPrice - chartMin) / span) * 68,
    }));
    const timeLabels = visiblePoints.length
      ? [
          { label: formatTime(visiblePoints[0].at), x: plotLeft },
          { label: formatTime(visiblePoints[Math.floor((visiblePoints.length - 1) / 2)].at), x: plotLeft + plotWidth / 2 },
          { label: formatTime(visiblePoints[visiblePoints.length - 1]?.at ?? Date.now()), x: plotRight },
        ]
      : [];

    return {
      points: visiblePoints,
      renderedPoints,
      buyPath: makePath(visiblePoints, "buyOrderPrice", chartMin, span),
      sellPath: makePath(visiblePoints, "sellOrderPrice", chartMin, span),
      buyAverage,
      sellAverage,
      spreadAverage,
      gridValues,
      timeLabels,
    };
  }, [history, item, selectedRange]);

  const hoveredPoint = hoveredIndex === null ? null : chart.renderedPoints[hoveredIndex];

  return (
    <div className="marketChart">
      <div className="chartToolbar">
        <div>
          <span className="chartLabel">Bazaar order prices</span>
        </div>
        <div className="chartControls">
          <div className="chartRange" aria-label="Chart range">
            {ranges.map((range) => (
              <button
                className={selectedRange.label === range.label ? "active" : ""}
                key={range.label}
                onClick={() => {
                  setSelectedRange(range);
                  setHoveredIndex(null);
                }}
              >
                {range.label}
              </button>
            ))}
          </div>
          <div className="chartLegend">
            <span><i className="legendBuy" /> Buy order</span>
            <span><i className="legendSell" /> Sell order</span>
            <span><i className="legendGrid" /> Price grid</span>
          </div>
        </div>
      </div>
      <div className="chartCanvas">
        <svg
          viewBox={`0 0 ${chartWidth} 100`}
          role="img"
          aria-label="Buy order and sell order price chart"
          onMouseLeave={() => setHoveredIndex(null)}
          onMouseMove={(event) => {
            if (!chart.renderedPoints.length) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            const cursorX = ((event.clientX - bounds.left) / bounds.width) * chartWidth;
            const nearestIndex = chart.renderedPoints.reduce(
              (bestIndex, point, index) =>
                Math.abs(point.x - cursorX) < Math.abs(chart.renderedPoints[bestIndex].x - cursorX) ? index : bestIndex,
              0,
            );
            setHoveredIndex(nearestIndex);
          }}
        >
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
          {chart.timeLabels.map((label) => (
            <text className="timeLabel" key={`${label.label}-${label.x}`} x={label.x} y="94" textAnchor={label.x === plotLeft ? "start" : label.x === plotRight ? "end" : "middle"}>
              {label.label}
            </text>
          ))}
          <path className="chartLine sell" d={chart.sellPath} />
          <path className="chartLine buy" d={chart.buyPath} />
          {hoveredPoint ? (
            <g>
              <path className="hoverLine" d={`M ${hoveredPoint.x.toFixed(2)} 12 L ${hoveredPoint.x.toFixed(2)} 88`} />
              <circle className="hoverDot sell" cx={hoveredPoint.x} cy={hoveredPoint.sellY} r="1.4" />
              <circle className="hoverDot buy" cx={hoveredPoint.x} cy={hoveredPoint.buyY} r="1.4" />
            </g>
          ) : null}
        </svg>
        {hoveredPoint ? (
          <div className="chartTooltip">
            <strong>{formatTime(hoveredPoint.at)}</strong>
            <span>Buy {formatCoins(hoveredPoint.buyOrderPrice)}</span>
            <span>Sell {formatCoins(hoveredPoint.sellOrderPrice)}</span>
            <span>Spread {formatCoins(hoveredPoint.sellOrderPrice - hoveredPoint.buyOrderPrice)}</span>
          </div>
        ) : null}
      </div>
      <div className="chartFooter">
        <span>Avg buy order <strong>{formatCoins(chart.buyAverage)}</strong></span>
        <span>Avg sell order <strong>{formatCoins(chart.sellAverage)}</strong></span>
        <span>Avg spread <strong>{formatCoins(chart.spreadAverage)}</strong></span>
        <span>Points <strong>{chart.points.length}</strong></span>
      </div>
    </div>
  );
}
