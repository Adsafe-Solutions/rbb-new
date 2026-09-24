/* Checks the LIVE Razorpay Checkout script against what the donation
   page's CSP allows (Document 22, scripts/security-policy.mjs RAZORPAY).
   Needs the network; not part of the build. Run before launch and when
   Checkout misbehaves:

     npm run check:razorpay

   - Both <style> blocks Checkout writes into the page must still be
     present, byte for byte — their hashes are what the CSP allows.
   - Every *.razorpay.com origin the script mentions is listed, marked
     allowed or not. Not every mentioned origin is loaded by the PARENT
     page (most are used inside Razorpay's own frame), so an unlisted one
     is a prompt to re-run the browser check in docs/DONATIONS.md, not an
     instruction to add it. */
import { RAZORPAY } from "./security-policy.mjs";
import { CHECKOUT_SRC } from "../src/lib/donations.js";

const response = await fetch(CHECKOUT_SRC);
if (!response.ok) {
  console.error(`✗ could not fetch ${CHECKOUT_SRC} (${response.status})`);
  process.exit(1);
}
const source = await response.text();
let ok = true;
RAZORPAY.styleElements.forEach((text, i) => {
  const found = source.includes(text);
  ok &&= found;
  console.log(`${found ? "✓" : "✗"} style block ${i + 1} ${found ? "unchanged" : "CHANGED — update RAZORPAY.styleElements after a browser check"}`);
});
const allowed = new Set([...RAZORPAY.script, ...RAZORPAY.frame, ...RAZORPAY.connect]);
const origins = [...new Set(source.match(/https:\/\/[a-z0-9.-]*razorpay\.com/g) ?? [])].sort();
for (const o of origins) console.log(`  ${allowed.has(o) ? "allowed    " : "not allowed"} ${o}`);
process.exit(ok ? 0 : 1);
