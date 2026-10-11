/* Givebutter's widget library — loaded ONCE per page lifetime, and only
   when a page actually shows a Givebutter widget (the widget component
   calls this from an effect, never during render).

   Once means once: every caller shares one promise, and a script already
   in the document (from an earlier route, or a module reloaded by the dev
   server) is reused rather than added again. The library registers the
   <givebutter-*> custom elements; an element rendered before or after it
   arrives is upgraded either way, so route changes need nothing extra.

   During the build's pre-render there is no document: this does nothing,
   and the widget element is emitted as plain markup. */

const LIBRARY = "https://widgets.givebutter.com/latest.umd.cjs";
const MARKER = "data-givebutter-library";
const ACCOUNT_ID = /^[A-Za-z0-9]{8,32}$/;

export const isGivebutterAccountId = (value) => typeof value === "string" && ACCOUNT_ID.test(value);

let loading = null;

export function loadGivebutter(accountId) {
  if (typeof document === "undefined") return Promise.resolve(false);
  if (!isGivebutterAccountId(accountId)) return Promise.reject(new Error("Givebutter account id is missing or malformed"));
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[${MARKER}]`);
    if (existing && window.Givebutter) return resolve(true);
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => resolve(true), { once: true });
    script.addEventListener(
      "error",
      () => {
        loading = null;
        script.remove();
        reject(new Error("The Givebutter widget library could not be loaded"));
      },
      { once: true }
    );
    if (!existing) {
      script.async = true;
      /* `p=other` is the installation-platform hint Givebutter's dashboard
         generates for a custom site. */
      script.src = `${LIBRARY}?acct=${encodeURIComponent(accountId)}&p=other`;
      script.setAttribute(MARKER, "");
      document.head.appendChild(script);
    }
  });
  return loading;
}
