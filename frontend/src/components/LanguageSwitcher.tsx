import { useI18n, type Locale } from "../i18n/context";
import { FlagEn, FlagEs } from "./FlagIcon";

const OPTIONS: { locale: Locale; label: string; Flag: typeof FlagEs }[] = [
  { locale: "es", label: "Español", Flag: FlagEs },
  { locale: "en", label: "English", Flag: FlagEn },
];

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className="flex items-center gap-1.5"
      role="group"
      aria-label={t("layout.language")}
    >
      {OPTIONS.map(({ locale: loc, label, Flag }) => {
        const active = locale === loc;
        return (
          <button
            key={loc}
            type="button"
            onClick={() => setLocale(loc)}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={`rounded-md border p-1 transition-colors ${
              active
                ? "border-soc-brand bg-soc-brand/15 ring-1 ring-soc-brand/40"
                : "border-soc-border hover:border-soc-muted bg-soc-panel2/50"
            }`}
          >
            <Flag className="h-3.5 w-5 rounded-sm overflow-hidden" />
          </button>
        );
      })}
    </div>
  );
}
