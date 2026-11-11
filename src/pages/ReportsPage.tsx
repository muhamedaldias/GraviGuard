import { useTranslation } from 'react-i18next';
import { useApp } from '../state/store';
import { formatNumber } from '../sim/units';

export function ReportsPage() {
  const { t } = useTranslation();
  const history = useApp((s) => s.history);
  const snapshot = useApp((s) => s.snapshot);
  const seed = useApp((s) => s.seed);
  const params = useApp((s) => s.params);
  const lang = useApp((s) => s.lang);
  const digits = useApp((s) => s.digits);
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';

  const download = (content: string, name: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const head = 't,R,NPSHa,NPSH3,Q,H,P_suction,P_discharge,T,Pv,level,tankH,theta,CI,damage,vibration,n,headDrop,state,ctrl,advisor,surge\n';
    const rows = history
      .map((h) =>
        [h.t, h.R, h.NPSHa, h.NPSH3, h.Q, h.H, h.P_suction, h.P_discharge, h.T, h.Pv, h.level, h.tankH, h.theta, h.CI, h.damage, h.vibration, h.n, h.headDrop, h.state, h.ctrl, h.advisor, h.surge].join(','),
      )
      .join('\n');
    download(head + rows, 'gurue-run.csv', 'text/csv');
  };

  const exportJson = () => {
    download(
      JSON.stringify({ seed, params, kpis: snapshot }, null, 2),
      'gurue-run.json',
      'application/json',
    );
  };

  const exportSvg = () => {
    const svg = document.querySelector('.chart-box svg');
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    download(clone.outerHTML, 'gurue-chart.svg', 'image/svg+xml');
  };

  const exportPng = async () => {
    const svg = document.querySelector('.chart-box svg');
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const xml = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    const svg64 = btoa(unescape(encodeURIComponent(xml)));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#0a0e14';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'gurue-chart.png';
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + svg64;
  };

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="panel">
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('reports.title')}</h2>
        <p className="muted small" style={{ margin: '4px 0 0' }}>{t('reports.disclaimer')}</p>
      </div>

      <div className="panel">
        <div className="panel-title">{t('reports.summary')}</div>
        <div className="grid-3">
          <div className="kpi"><span className="kpi-label">{t('common.seed')}</span><span className="kpi-value">{seed}</span></div>
          <div className="kpi"><span className="kpi-label">{t('common.simTime')}</span><span className="kpi-value">{formatNumber(snapshot?.t ?? 0, { decimals: 1, locale, digitStyle: digits })} s</span></div>
          <div className="kpi"><span className="kpi-label">{t('sim.margin')}</span><span className="kpi-value">{formatNumber(snapshot?.R ?? 0, { decimals: 2, locale, digitStyle: digits })}</span></div>
          <div className="kpi"><span className="kpi-label">{t('sim.npsha')}</span><span className="kpi-value">{formatNumber(snapshot?.NPSHa ?? 0, { decimals: 2, locale, digitStyle: digits })} m</span></div>
          <div className="kpi"><span className="kpi-label">{t('sim.damage')}</span><span className="kpi-value">{formatNumber(snapshot?.damage ?? 0, { decimals: 3, locale, digitStyle: digits })}</span></div>
          <div className="kpi"><span className="kpi-label">{t('sim.tank')}</span><span className="kpi-value">{formatNumber(snapshot?.tankH ?? 0, { decimals: 2, locale, digitStyle: digits })} m</span></div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">{t('common.export')}</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button onClick={exportCsv}>{t('reports.csv')}</button>
          <button onClick={exportJson}>{t('reports.json')}</button>
          <button onClick={exportSvg}>{t('reports.svg')}</button>
          <button onClick={exportPng}>{t('reports.png')}</button>
          <button onClick={() => window.print()}>{t('reports.pdf')}</button>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          {history.length} samples · {t('reports.disclaimer')}
        </p>
      </div>
    </div>
  );
}
