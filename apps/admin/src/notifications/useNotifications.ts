import { useCallback, useEffect, useRef, useState } from "react";
import { notificationsApi } from "./client";
import type { Notifications } from "./model";

/* Refreshed every minute while the tab is visible, when the window regains
   focus, and when the dropdown opens. A failed check keeps the last answer
   (a brief network problem should not empty the bell). */
const EVERY_MS = 60_000;

export function useNotifications() {
  const [data, setData] = useState<Notifications | null>(null);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      setData(await notificationsApi.get());
    } catch {
      // Keep what we had.
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => document.visibilityState === "visible" && void refresh(), EVERY_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  return { data, refresh };
}
