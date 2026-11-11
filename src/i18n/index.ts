import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ar from './ar.json';

export { en, ar };

export const LANGS = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
] as const;

export type LangCode = (typeof LANGS)[number]['code'];

void i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

export default i18next;

/** Recursively collect all leaf keys of a nested dictionary. */
export function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

export function assertKeyParity(): { missingInAr: string[]; missingInEn: string[]; empty: string[] } {
  const enKeys = flattenKeys(en as Record<string, unknown>);
  const arKeys = flattenKeys(ar as Record<string, unknown>);
  const enSet = new Set(enKeys);
  const arSet = new Set(arKeys);
  const missingInAr = enKeys.filter((k) => !arSet.has(k));
  const missingInEn = arKeys.filter((k) => !enSet.has(k));
  const empty: string[] = [];
  for (const k of enKeys) {
    const v = lookup(en as Record<string, unknown>, k);
    if (typeof v === 'string' && v.trim() === '') empty.push(`en:${k}`);
  }
  for (const k of arKeys) {
    const v = lookup(ar as Record<string, unknown>, k);
    if (typeof v === 'string' && v.trim() === '') empty.push(`ar:${k}`);
  }
  return { missingInAr, missingInEn, empty };
}

function lookup(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (cur && typeof cur === 'object') cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return cur;
}
