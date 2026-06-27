import { useI18n, type Locale } from "../i18n/context";
import { FlagEn, FlagEs } from "./FlagIcon";

const LANGUAGE_OPTIONS: Record<
  Locale,
  { nextLocale: Locale; label: string; Flag: typeof FlagEs }
> = {
  es: { nextLocale: "en", label: "English", Flag: FlagEn },
  en: { nextLocale: "es", label: "Español", Flag: FlagEs },
};

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const { nextLocale, label, Flag } = LANGUAGE_OPTIONS[locale];
  const accessibleLabel = t("layout.changeLanguage", { language: label });

  return (
    <button
      type="button"
      onClick={() => setLocale(nextLocale)}
      title={accessibleLabel}
      aria-label={accessibleLabel}
      className="rounded-md border border-soc-border bg-soc-panel2/50 p-1 transition-colors hover:border-soc-muted"
    >
      <Flag className="h-3.5 w-5 overflow-hidden rounded-sm" />
    </button>
  );
}
