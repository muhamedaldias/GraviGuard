// Unit conversion and locale-aware formatting helpers.
// SI is authoritative internally; US units are a display concern only.

export type UnitSystem = 'SI' | 'US';
export type DigitStyle = 'western' | 'arabic-indic';

export const M3S_TO_GPM = 15850.32314;
export const M3S_TO_M3H = 3600;
export const M_TO_FT = 3.280839895;
export const PA_TO_PSI = 0.000145037738;
export const PA_TO_BAR = 1e-5;
export const KPA_TO_PSI = 0.145037738;
export const KW_TO_HP = 1.34102209;

export function headMToFt(m: number): number {
  return m * M_TO_FT;
}
export function pressurePaToPsi(pa: number): number {
  return pa * PA_TO_PSI;
}
export function pressurePaToBar(pa: number): number {
  return pa * PA_TO_BAR;
}
export function pressurePaToKpa(pa: number): number {
  return pa / 1000;
}
export function flowM3sToGpm(m3s: number): number {
  return m3s * M3S_TO_GPM;
}
export function flowM3sToM3h(m3s: number): number {
  return m3s * M3S_TO_M3H;
}
export function powerKwToHp(kw: number): number {
  return kw * KW_TO_HP;
}
export function cToF(c: number): number {
  return c * 9 / 5 + 32;
}

export type QuantityKind = 'head' | 'pressure' | 'flow' | 'power' | 'temp' | 'volume' | 'speed' | 'ratio' | 'time';

export interface Formatted {
  value: string;
  unit: string;
}

const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toArabicIndicDigits(input: string): string {
  return input.replace(/[0-9]/g, (d) => ARABIC_INDIC[Number(d)]);
}

export function formatNumber(
  value: number,
  opts: { decimals?: number; locale?: string; digitStyle?: DigitStyle; grouping?: boolean } = {},
): string {
  const { decimals = 2, locale = 'en-US', digitStyle = 'western', grouping = true } = opts;
  if (!Number.isFinite(value)) return '—';
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouping,
  }).format(value);
  return digitStyle === 'arabic-indic' ? toArabicIndicDigits(formatted) : formatted;
}

/** Format a physical quantity in the requested unit system. */
export function formatQuantity(
  siValue: number,
  kind: QuantityKind,
  system: UnitSystem,
  locale = 'en-US',
  digitStyle: DigitStyle = 'western',
  decimals?: number,
): Formatted {
  switch (kind) {
    case 'head': {
      const v = system === 'SI' ? siValue : headMToFt(siValue);
      return { value: formatNumber(v, { decimals: decimals ?? 2, locale, digitStyle }), unit: system === 'SI' ? 'm' : 'ft' };
    }
    case 'pressure': {
      if (system === 'SI') {
        const abs = Math.abs(siValue);
        if (abs >= 100000) {
          return { value: formatNumber(siValue / 1000, { decimals: decimals ?? 2, locale, digitStyle }), unit: 'kPa' };
        }
        return { value: formatNumber(siValue / 1000, { decimals: decimals ?? 2, locale, digitStyle }), unit: 'kPa' };
      }
      return { value: formatNumber(pressurePaToPsi(siValue), { decimals: decimals ?? 2, locale, digitStyle }), unit: 'psi' };
    }
    case 'flow': {
      const v = system === 'SI' ? flowM3sToM3h(siValue) : flowM3sToGpm(siValue);
      return { value: formatNumber(v, { decimals: decimals ?? 1, locale, digitStyle }), unit: system === 'SI' ? 'm³/h' : 'gpm' };
    }
    case 'power': {
      const v = system === 'SI' ? siValue : powerKwToHp(siValue);
      return { value: formatNumber(v, { decimals: decimals ?? 1, locale, digitStyle }), unit: system === 'SI' ? 'kW' : 'hp' };
    }
    case 'temp': {
      const v = system === 'SI' ? siValue : cToF(siValue);
      return { value: formatNumber(v, { decimals: decimals ?? 1, locale, digitStyle }), unit: system === 'SI' ? '°C' : '°F' };
    }
    case 'volume': {
      const v = system === 'SI' ? siValue : siValue * 35.3147;
      return { value: formatNumber(v, { decimals: decimals ?? 1, locale, digitStyle }), unit: system === 'SI' ? 'm³' : 'ft³' };
    }
    case 'speed': {
      return { value: formatNumber(siValue, { decimals: decimals ?? 0, locale, digitStyle }), unit: 'rpm' };
    }
    case 'ratio': {
      return { value: formatNumber(siValue, { decimals: decimals ?? 2, locale, digitStyle }), unit: '—' };
    }
    case 'time': {
      return { value: formatNumber(siValue, { decimals: decimals ?? 1, locale, digitStyle }), unit: 's' };
    }
  }
}

/** Display a pressure as bar when SI (engineering convention), psi when US. */
export function formatPressureBar(siValue: number, system: UnitSystem, locale = 'en-US', digitStyle: DigitStyle = 'western'): Formatted {
  if (system === 'SI') {
    return { value: formatNumber(pressurePaToBar(siValue), { decimals: 3, locale, digitStyle }), unit: 'bar' };
  }
  return { value: formatNumber(pressurePaToPsi(siValue), { decimals: 2, locale, digitStyle }), unit: 'psi' };
}
