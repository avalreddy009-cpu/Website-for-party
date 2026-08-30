const NUMERALS: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** Used for the header's "MMXXVI" year stamp — no point hardcoding a year. */
export function toRoman(value: number): string {
  let remaining = Math.max(0, Math.floor(value));
  let out = "";
  for (const [amount, symbol] of NUMERALS) {
    while (remaining >= amount) {
      out += symbol;
      remaining -= amount;
    }
  }
  return out;
}
