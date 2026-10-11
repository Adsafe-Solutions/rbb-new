import type { Ref, RefCallback } from "react";

/** Join class names, skipping falsy values. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** One ref callback that feeds several refs. */
export function mergeRefs<T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {
  return (value) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(value);
      else if (ref) (ref as { current: T | null }).current = value;
    }
  };
}

/** The elements inside `root` that Tab can reach. */
export function focusableWithin(root: HTMLElement): HTMLElement[] {
  const selector = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((el) => !el.closest("[hidden]"));
}
