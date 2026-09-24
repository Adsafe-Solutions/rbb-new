/* Money — Document 22 §5. Shared by the browser (the amount selector) and
   the donation server (server/donations/), so both read an amount the
   same way. Plain data and functions, no imports: it must load in the
   serverless runtime as-is.

   ⚠ NO FLOATING POINT. Amounts live as integers in the currency's
   smallest unit ("minor units" — paise, cents), which is what Razorpay
   takes. A human amount ("500", "500.50") is turned into minor units
   ONCE, by string arithmetic, and formatted back the same way. 0.1 + 0.2
   never happens here.

   Nothing in this file chooses a currency or an amount: both come from
   the server's configuration (DONATION_CURRENCY, DONATION_*_AMOUNT). */

const CODE = /^[A-Z]{3}$/;

/* Is this an ISO 4217 code the runtime knows? Razorpay's own list of
   supported currencies is narrower — the currency RBB approves must be
   checked against its account (docs/DONATIONS.md). */
export function isCurrencyCode(code) {
  if (typeof code !== "string" || !CODE.test(code)) return false;
  try {
    return typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("currency").includes(code)
      : Boolean(new Intl.NumberFormat("en", { style: "currency", currency: code }));
  } catch {
    return false;
  }
}

/* Digits after the decimal point: 2 for most currencies, 0 for a few
   (JPY), 3 for others (KWD). From the runtime's ISO data. */
export function currencyExponent(code) {
  return new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions()
    .maximumFractionDigits;
}

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

/* Minor units → display text in the approved currency ("₹1,500.00",
   "INR 1,500.00"…). Intl formats the decimal STRING, so no float is ever
   made. `display: "code"` keeps the ISO code, for plain-text email. */
export function formatMoney(minor, currency, { locale = "en", display = "symbol" } = {}) {
  const exponent = currencyExponent(currency);
  const decimal = toDecimalString(minor, exponent);
  if (decimal === null) return "";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: display,
    minimumFractionDigits: exponent,
  }).format(decimal);
}
