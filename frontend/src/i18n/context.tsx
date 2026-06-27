import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { EventType } from "../types";
import { en, type TranslationDict } from "./en";
import { es } from "./es";

export type Locale = "en" | "es";

const STORAGE_KEY = "aligo-locale";

const dictionaries: Record<Locale, TranslationDict> = { en, es };

const ERROR_KEYS: Record<string, keyof TranslationDict["errors"]> = {
  "select at least one node to run the mission": "selectNodeToRun",
  "no nodes online": "noNodesOnline",
  "no target nodes online": "noTargetNodesOnline",
  "empty command": "emptyCommand",
  "Only offline nodes can be deleted from the registry.": "deleteOfflineOnly",
  "Invalid JSON — paste a full evidence bundle": "invalidJsonBundle",
  "Invalid JSON file": "invalidJsonFile",
  "no ledger events yet": "noLedgerEvents",
  "run a successful task first": "runSuccessfulTaskFirst",
  "No results yet — run a mission first": "noResultsYet",
  "No missions available": "noMissionsAvailable",
};

function detectLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "es") return stored;
  const lang = navigator.language.toLowerCase();
  return lang.startsWith("es") ? "es" : "en";
}

function getByPath(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    key in params ? String(params[key]) : `{{${key}}}`
  );
}

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  status: (value: string) => string;
  eventType: (value: EventType) => string;
  timeAgo: (iso: string | null) => string;
  formatTime: (iso: string | null) => string;
  translateError: (message: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const dict = dictionaries[locale];

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = dict.app.title;
  }, [locale, dict.app.title]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const value = getByPath(dict as unknown as Record<string, unknown>, key);
      return interpolate(value ?? key, params);
    },
    [dict]
  );

  const status = useCallback(
    (value: string) => {
      const label = getByPath(dict.status as unknown as Record<string, unknown>, value);
      return label ?? value.replace(/_/g, " ");
    },
    [dict]
  );

  const eventType = useCallback(
    (value: EventType) => {
      return dict.events[value] ?? value;
    },
    [dict]
  );

  const timeAgo = useCallback(
    (iso: string | null) => {
      if (!iso) return dict.common.dash;
      const then = new Date(iso).getTime();
      if (Number.isNaN(then)) return dict.common.dash;
      const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
      if (seconds < 5) return dict.time.justNow;
      if (seconds < 60) return interpolate(dict.time.secondsAgo, { n: seconds });
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return interpolate(dict.time.minutesAgo, { n: minutes });
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return interpolate(dict.time.hoursAgo, { n: hours });
      return interpolate(dict.time.daysAgo, { n: Math.floor(hours / 24) });
    },
    [dict]
  );

  const formatTime = useCallback(
    (iso: string | null) => {
      if (!iso) return dict.common.dash;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleTimeString(locale === "es" ? "es-ES" : "en-US");
    },
    [dict, locale]
  );

  const translateError = useCallback(
    (message: string) => {
      const exact = ERROR_KEYS[message];
      if (exact) return dict.errors[exact];

      if (message.includes("unknown plugin")) {
        const match = /unknown plugin '([^']+)'/.exec(message);
        if (match) {
          const allowed = message.split("Allowed: ")[1] ?? "";
          return interpolate(dict.errors.unknownPlugin, {
            plugin: match[1],
            allowed,
          });
        }
      }

      if (message.startsWith("Unknown command")) {
        return dict.errors.unknownCommand;
      }

      if (message.includes("blocked by policy") || message.includes("blocked")) {
        return dict.common.blockedByPolicy;
      }

      const statusMatch = /^(\d+):\s*(.+)$/.exec(message);
      if (statusMatch) {
        const detail = statusMatch[2];
        const detailKey = ERROR_KEYS[detail];
        if (detailKey) return `${statusMatch[1]}: ${dict.errors[detailKey]}`;
      }

      return message;
    },
    [dict]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      status,
      eventType,
      timeAgo,
      formatTime,
      translateError,
    }),
    [locale, setLocale, t, status, eventType, timeAgo, formatTime, translateError]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useT() {
  return useI18n().t;
}
