/**
 * Format a number as Indian currency shorthand.
 * ≥1L → ₹X.XL, ≥1k → ₹X.Xk, else ₹X
 */
export function fmt(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

/**
 * Format a number as full Indian currency, no rounding to L/k shorthand.
 * e.g. 123456 → ₹1,23,456
 */
export function fmtFull(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/**
 * Clamp a number between min and max.
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
