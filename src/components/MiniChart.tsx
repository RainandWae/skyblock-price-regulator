import { useMemo } from "react";

type MiniChartProps = {
  points: number[];
  tone: "green" | "red" | "blue";
};

export function MiniChart({ points, tone }: MiniChartProps) {
  const path = useMemo(() => {
    if (points.length < 2) return "";
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    return points
      .map((point, index) => {
        const x = (index / (points.length - 1)) * 100;
        const y = 92 - ((point - min) / span) * 78;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }, [points]);

  return (
    <svg className="miniChart" viewBox="0 0 100 100" role="img" aria-label="Price trend chart">
      <path className="gridLine" d="M 0 25 L 100 25 M 0 50 L 100 50 M 0 75 L 100 75" />
      <path className={`chartLine ${tone}`} d={path} />
    </svg>
  );
}
