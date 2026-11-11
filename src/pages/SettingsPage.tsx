import { useTranslation } from 'react-i18next';
import { useApp } from '../state/store';
import { LANGS } from '../i18n';
import type { DigitStyle } from '../sim/units';

export function SettingsPage() {
  const { t } = useTranslation();
  const lang = useApp((s) => s.lang);
  const setLang = useApp((s) => s.setLang);
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  const units = useApp((s) => s.units);
  const setUnits = useApp((s) => s.setUnits);
  const digits = useApp((s) => s.digits);
  const setDigits = useApp((s) => s.setDigits);
  const quality = useApp((s) => s.quality);
  const setQuality = useApp((s) => s.setQuality);
  const seed = useApp((s) => s.seed);
  const setSeed = useApp((s) => s.setSeed);

  return (
    <div className="col" style={{ gap: 12, maxWidth: 620 }}>
      <div className="panel">
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('settings.title')}</h2>
      </div>

      <div className="panel">
        <div className="panel-title">{t('settings.language')}</div>
        <div className="row" style={{ gap: 6 }}>
          {LANGS.map((l) => (
            <button key={l.code} onClick={() => setLang(l.code)} style={{ flex: 1, borderColor: lang === l.code ? 'var(--accent)' : undefined }}>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">{t('settings.digits')}</div>
        <div className="row" style={{ gap: 6 }}>
          {(['western', 'arabic-indic'] as DigitStyle[]).map((d) => (
            <button key={d} onClick={() => setDigits(d)} style={{ flex: 1, borderColor: digits === d ? 'var(--accent)' : undefined }}>
              {d === 'western' ? t('settings.western') : t('settings.arabicIndic')}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">{t('settings.units')} / {t('settings.theme')} / {t('settings.quality')}</div>
        <div className="row" style={{ gap: 6 }}>
          <button onClick={() => setUnits(units === 'SI' ? 'US' : 'SI')} style={{ flex: 1 }}>
            {t('settings.units')}: {units}
          </button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ flex: 1 }}>
            {t('settings.theme')}: {theme === 'dark' ? t('settings.dark') : t('settings.light')}
          </button>
          <button
            onClick={() => setQuality(quality === 'high' ? 'medium' : quality === 'medium' ? 'low' : 'high')}
            style={{ flex: 1 }}
          >
            {t('settings.quality')}: {t(`settings.${quality}`)}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">{t('common.seed')}</div>
        <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} style={{ width: 140 }} />
        <p className="small muted" style={{ marginTop: 6 }}>
          {t('common.synthetic')}
        </p>
      </div>

      <div className="panel">
        <div className="panel-title">{t('common.disclaimer')}</div>
        <p className="small muted">{t('methodology.synthetic')}</p>
      </div>
    </div>
  );
}
