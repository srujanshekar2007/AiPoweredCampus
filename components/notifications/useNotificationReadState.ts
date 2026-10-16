"use client";

import { useCallback, useSyncExternalStore } from "react";

const readEventName = "ecotwin-notifications-read";

export function useNotificationReadThrough(scope: string): string | null {
  const key = `ecotwin-notifications-read:${scope}`;
  const subscribe = useCallback((callback: () => void) => {
    const handleStorage = (event: StorageEvent) => { if (event.key === key) callback(); };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(readEventName, callback);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(readEventName, callback);
    };
  }, [key]);
  const getSnapshot = useCallback(() => window.localStorage.getItem(key), [key]);
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export function markNotificationEventsRead(scope: string, readThrough: string): void {
  window.localStorage.setItem(`ecotwin-notifications-read:${scope}`, readThrough);
  window.dispatchEvent(new Event(readEventName));
}
