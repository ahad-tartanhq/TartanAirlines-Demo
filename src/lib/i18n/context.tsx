import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { type Lang, LANG_FONT, isRtl, languagesForCountry } from "./config";
import { dictionaries } from "./dictionaries";

type Vars = Record<string, string | number>;

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  country: string;
  setCountry: (c: string) => void;
  dir: "ltr" | "rtl";
  t: (key: string, vars?: Vars) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

const STORAGE_KEY = "tartan.lang";

function interpolate(str: string, vars?: Vars): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState("India");
  const [lang, setLangState] = useState<Lang>("en");

  // Restore persisted language on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved && saved in dictionaries) setLangState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  // Changing country resets to English unless the current language is offered there.
  const setCountry = useCallback(
    (c: string) => {
      setCountryState(c);
      setLangState((cur) => (languagesForCountry(c).includes(cur) ? cur : "en"));
    },
    [],
  );

  const dir: "ltr" | "rtl" = isRtl(lang) ? "rtl" : "ltr";

  const t = useCallback(
    (key: string, vars?: Vars) => {
      const dict = dictionaries[lang] ?? dictionaries.en;
      const raw = dict[key] ?? dictionaries.en[key] ?? key;
      return interpolate(raw, vars);
    },
    [lang],
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, country, setCountry, dir, t }),
    [lang, setLang, country, setCountry, dir, t],
  );

  return (
    <I18nContext.Provider value={value}>
      <div dir={dir} style={LANG_FONT[lang] ? { fontFamily: LANG_FONT[lang] } : undefined}>
        {children}
      </div>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useT() {
  return useI18n().t;
}
