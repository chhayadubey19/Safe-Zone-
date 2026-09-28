"use client";

/**
 * Language state hook — EN / हिं toggle without an i18n library.
 *
 * The language lives in localStorage (lib/i18n saveLang/loadLang); React
 * subscribes to it as an external store (useSyncExternalStore), so every
 * mounted consumer re-renders when any instance toggles — no context tree.
 *
 * Hydration safety: the server snapshot is always "en"; after hydration the
 * client snapshot (localStorage) takes over — React handles the transition
 * without a markup mismatch.
 */

import { useCallback, useSyncExternalStore } from "react";
import { LANG_CHANGE_EVENT, loadLang, saveLang, type Lang } from "@/lib/i18n";

function subscribe(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener(LANG_CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(LANG_CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

// Snapshot reads are cheap (one localStorage get + string compare).
const getSnapshot = (): Lang => loadLang();
const getServerSnapshot = (): Lang => "en";

export function useLang(): { lang: Lang; setLang: (lang: Lang) => void } {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLang = useCallback((next: Lang) => {
    saveLang(next);
    window.dispatchEvent(new Event(LANG_CHANGE_EVENT));
  }, []);

  return { lang, setLang };
}
