/* Money — the donation form's amount arithmetic (components/
   DonationForm). Plain data and functions, no imports, so a payment
   provider's server code can share it later.

   ⚠ NO FLOATING POINT. Amounts live as integers in the currency's
   smallest unit ("minor units" — paise, cents). A human amount ("500",
   "500.50") is turned into minor units ONCE, by string arithmetic, and
   formatted back the same way. 0.1 + 0.2 never happens here.

   Nothing in this file chooses a currency or an amount. */

/* "1500" / "1500.5" / "1,500.50" → minor units (integer), or null if it
   is not a plain positive amount with at most `exponent` decimals.
   Commas are accepted as thousands separators only. */
export function toMinorUnits(input, exponent) {
  if (typeof input !== "string" && typeof input !== "number") return null;
  const text = String(input).trim().replace(/,(?=\d{3}(\D|$))/g, "");
  const match = /^(\d{1,12})(?:\.(\d+))?$/.exec(text);
  if (!match) return null;
  const [, whole, fraction = ""] = match;
  if (fraction.length > exponent) return null;
  const minor = Number(whole + fraction.padEnd(exponent, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

/* Minor units → "1500.50" (a decimal string, no grouping, no symbol). */
export function toDecimalString(minor, exponent) {
  if (!Number.isSafeInteger(minor) || minor < 0) return null;
  if (exponent === 0) return String(minor);
  const digits = String(minor).padStart(exponent + 1, "0");
  return `${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`;
}
