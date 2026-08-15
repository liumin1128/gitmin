import { EN_TRANSLATIONS } from './locales/en';
import { ZH_CN_TRANSLATIONS } from './locales/zh-cn';

export type Locale = 'en' | 'zh-cn';
export type TranslationKey = keyof typeof EN_TRANSLATIONS;
export type TranslationParams = Readonly<Record<string, string | number>>;

const TRANSLATIONS: Record<Locale, Record<TranslationKey, string>> = {
  en: EN_TRANSLATIONS,
  'zh-cn': ZH_CN_TRANSLATIONS,
};

let currentLocale: Locale = 'en';

export function resolveLocale(language: string | undefined): Locale {
  const normalized = language?.trim().toLowerCase().replaceAll('_', '-') ?? '';
  if (
    normalized === 'zh' ||
    normalized === 'zh-cn' ||
    normalized === 'zh-sg' ||
    normalized.startsWith('zh-hans')
  ) {
    return 'zh-cn';
  }
  return 'en';
}

export function configureLocale(language: string | undefined): Locale {
  currentLocale = resolveLocale(language);
  return currentLocale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function localeLanguageTag(locale: Locale = currentLocale): string {
  return locale === 'zh-cn' ? 'zh-CN' : 'en-US';
}

export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: TranslationParams
): string {
  const template = TRANSLATIONS[locale][key] ?? EN_TRANSLATIONS[key];
  if (!params) return template;
  return template.replace(/\{([a-zA-Z][\w]*)\}/g, (placeholder, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : String(value);
  });
}

export function t(key: TranslationKey, params?: TranslationParams): string {
  return translate(currentLocale, key, params);
}
