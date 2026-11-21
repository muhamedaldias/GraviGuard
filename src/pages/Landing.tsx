import { useTranslation } from 'react-i18next';
import { useApp } from '../state/store';
import { SyntheticBadge } from '../components/Badges';
import { STATIONS } from '../data/stations';
import './landing.css';

/** Nominal display values when the engine has not ticked yet. */
const NOMINAL = { q: 0.142, npsha: 6.4, npsh3: 5.56, level: 3.2 };

function Gauge({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="gauge">
      <svg className="gauge-dial" viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r="22" className="gauge-track" />
        <circle cx="28" cy="28" r="22" className="gauge-tick" />
        <line x1="28" y1="28" x2="28" y2="10" className="gauge-needle" />
        <circle cx="28" cy="28" r="2.5" className="gauge-hub" />
      </svg>
      <span className="gauge-read">
        <span className="mono">{value}</span>
        {unit ? <span className="gauge-unit">{unit}</span> : null}
      </span>
      <span className="gauge-label">{label}</span>
    </div>
  );
}

/** The signature: a live P&ID-style schematic — reservoir → gravity line → lift station → network. */
function SchematicHero({ q, margin }: { q: string; margin: string }) {
  const { t } = useTranslation();
  return (
    <figure className="schematic" aria-label={t('landing.schematicLabel')}>
      <svg viewBox="0 0 560 340" role="img" className="schematic-svg">
        {/* source reservoir */}
        <rect x="24" y="28" width="118" height="92" rx="6" className="s-line" />
        <rect x="26" y="94" width="114" height="24" className="s-fill" />
        <path d="M28 92 h112" className="s-line s-thin" />
        <path d="M28 92 q28 -8 56 0 t56 0" className="s-water" />
        {/* gravity trunk */}
        <path d="M142 106 h58 v44 h86" className="s-line s-draw d1" />
        <path d="M142 106 h58 v44 h86" className="s-flowline" />
        {/* lift station */}
        <circle cx="330" cy="162" r="27" className="s-line s-draw d2" />
        <circle cx="330" cy="162" r="12" className="s-thin" />
        <path d="M330 150 v24 M318 162 h24" className="s-thin" />
        {/* discharge to network */}
        <path d="M356 150 l64 -52 h86" className="s-line s-draw d3" />
        <path d="M356 150 l64 -52 h86" className="s-flowline" />
        {/* distribution fork */}
        <path d="M506 98 v34 M506 116 h30" className="s-line s-draw d4" />
        {/* level sensing tap */}
        <path d="M142 60 h20 v-16" className="s-thin s-draw d1" />
        {/* gauges */}
        <g transform="translate(46,214)">
          <circle r="24" className="s-line" />
          <line x1="0" y1="0" x2="15" y2="-14" className="s-needle" />
          <text y="44" className="s-gtext">{q}</text>
          <text y="60" className="s-gunit">Q · m³/s</text>
        </g>
        <g transform="translate(146,214)">
          <circle r="24" className="s-line" />
          <line x1="0" y1="0" x2="11" y2="-17" className="s-needle brass" />
          <text y="44" className="s-gtext">{margin}</text>
          <text y="60" className="s-gunit">Δ NPSH · m</text>
        </g>
        {/* legend labels, sentence case */}
        <text x="24" y="136" className="s-ltext">{t('landing.legendSource')}</text>
        <text x="216" y="136" className="s-ltext">{t('landing.legendGravity')}</text>
        <text x="304" y="206" className="s-ltext">{t('landing.legendLift')}</text>
        <text x="446" y="140" className="s-ltext">{t('landing.legendNetwork')}</text>
      </svg>
    </figure>
  );
}

export function Landing() {
  const { t } = useTranslation();
  const setPage = useApp((s) => s.setPage);
  const snapshot = useApp((s) => s.snapshot);

  const q = (snapshot?.Q ?? NOMINAL.q).toFixed(3);
  const margin = ((snapshot?.NPSHa ?? NOMINAL.npsha) - (snapshot?.NPSH3 ?? NOMINAL.npsh3)).toFixed(2);
  const marginState = Number(margin) > 0.6 ? 'var(--ok)' : Number(margin) > 0.3 ? 'var(--brass)' : 'var(--alarm)';
  const level = (snapshot?.sensors.level ?? NOMINAL.level).toFixed(2);

  const seq = [
    { t: t('landing.seq1t'), b: t('landing.seq1b') },
    { t: t('landing.seq2t'), b: t('landing.seq2b') },
    { t: t('landing.seq3t'), b: t('landing.seq3b') },
  ];
  const cred = [
    t('landing.cred1'),
    t('landing.cred2'),
    t('landing.cred3'),
    t('landing.cred4'),
  ];

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-copy">
          <h1 className="hero-title">{t('landing.heroTitle')}</h1>
          <p className="hero-sub">{t('landing.heroSub')}</p>
          <div className="hero-actions">
            <button className="primary hero-cta" onClick={() => setPage('simulator')}>
              {t('landing.cta')}
            </button>
            <button className="hero-cta ghost" onClick={() => setPage('scenarios')}>
              {t('landing.cta2')}
            </button>
          </div>
        </div>
        <SchematicHero q={q} margin={margin} />
      </section>

      <section className="rail" aria-label={t('landing.railLabel')}>
        <div className="rail-mod grow-1">
          <span className="rail-value mono">{STATIONS.length}</span>
          <span className="rail-label">{t('landing.railStations')}</span>
        </div>
        <div className="rail-mod grow-2">
          <span className="rail-value mono">
            {q} <span className="rail-unit">{t('landing.railUnitFlow')}</span>
          </span>
          <span className="rail-label">{t('landing.railFlow')}</span>
        </div>
        <div className="rail-mod grow-2">
          <span className="rail-value mono">
            {margin} <span className="rail-unit">{t('landing.railUnitMargin')}</span>
          </span>
          <span className="rail-label">
            <span className="rail-dot" style={{ background: marginState }} />
            {t('landing.railMargin')}
          </span>
        </div>
        <div className="rail-mod grow-1">
          <span className="rail-value mono">
            {level} <span className="rail-unit">m</span>
          </span>
          <span className="rail-label">{t('landing.railLevel')}</span>
        </div>
      </section>

      <section className="seq">
        <h2 className="seq-title">{t('landing.seqTitle')}</h2>
        <ol className="seq-row">
          {seq.map((s, i) => (
            <li key={s.t} className="seq-item">
              <span className="seq-n mono">{i + 1}</span>
              <h3 className="seq-h">{s.t}</h3>
              <p className="seq-b">{s.b}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="cred">
        <h2 className="cred-title">{t('landing.credTitle')}</h2>
        <ul className="cred-list">
          {cred.map((c) => (
            <li key={c} className="cred-item">{c}</li>
          ))}
        </ul>
      </section>

      <footer className="foot">
        <span>{t('common.appName')}</span>
        <span className="muted">{t('common.tagline')}</span>
        <span className="muted mono small">{t('common.model')}</span>
        <SyntheticBadge />
      </footer>
    </div>
  );
}
