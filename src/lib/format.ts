export const formatCoins = (value: number) =>
  Number.isFinite(value)
    ? value >= 1_000_000
      ? `${(value / 1_000_000).toFixed(2)}m`
      : value >= 1_000
        ? `${(value / 1_000).toFixed(1)}k`
        : value.toFixed(value >= 100 ? 0 : 1)
    : "-";

export const cleanName = (id: string) =>
  id
    .replace(/^ENCHANTMENT_/, "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
