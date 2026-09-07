export const formatCoins = (value: number) => {
  if (!Number.isFinite(value)) return "-";

  // Compare on the magnitude so losses format like gains. Comparing the raw
  // value sent every negative number to the last branch, so a 5m loss rendered
  // as "-5000000.0" instead of "-5.00m".
  const sign = value < 0 ? "-" : "";
  const magnitude = Math.abs(value);

  if (magnitude >= 1_000_000) return `${sign}${(magnitude / 1_000_000).toFixed(2)}m`;
  if (magnitude >= 1_000) return `${sign}${(magnitude / 1_000).toFixed(1)}k`;
  return `${sign}${magnitude.toFixed(magnitude >= 100 ? 0 : 1)}`;
};

export const cleanName = (id: string) =>
  id
    .replace(/^ENCHANTMENT_/, "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
