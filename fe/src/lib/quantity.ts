const quantityMultipliers: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
  t: 1_000_000_000_000,
};

export const startsWithZero = (value: string) => /^0\d/.test(value.trim());

export const parseCompactNumberInput = (value: string) => {
  const trimmedValue = value.trim().toLowerCase().replaceAll(",", "");
  const match = trimmedValue.match(/^(\d+(?:\.\d+)?)([kmbt])?$/);
  if (!match) return Number.NaN;

  const [, amount, suffix] = match;
  return Number(amount) * (suffix ? quantityMultipliers[suffix] : 1);
};

export const parseQuantityInput = parseCompactNumberInput;

export const getCompactNumberWarning = (value: string, label: string, options: { allowZero?: boolean } = {}) => {
  const trimmedValue = value.trim();

  if (trimmedValue === "") return `${label} is required`;
  if (startsWithZero(trimmedValue)) return `${label} cannot start with 0`;

  const parsedValue = parseCompactNumberInput(trimmedValue);
  if (!Number.isFinite(parsedValue) || parsedValue < 0 || (!options.allowZero && parsedValue === 0)) {
    return `Use a number like 10k, 1m, 24b, or 2t`;
  }

  return "";
};

export const getQuantityWarning = (value: string) => {
  return getCompactNumberWarning(value, "Quantity");
};
