import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../state/store';
import { runScenario, scenarioPassBadge, type ScenarioRun } from '../sim/scenario';
import type { Scenario } from '../sim/types';
import { Badge } from '../components/Badges';

const SKIP = new Set(['S14', 'S15', 'S11']);

export function ScenariosPage() {
  const { t } = useTranslation();
  const lang = useApp((s) => s.lang);
  const scenario = useApp((s) => s.scenario);
  const setScenario = useApp((s) => s.setScenario);
  const setPage = useApp((s) => s.setPage);
  const [list, setList] = useState<Scenario[]>([]);
  const [results, setResults] = useState<ScenarioRun[] | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    fetch('./scenarios/index.json')
      .then((r) => r.json())
      .then((ids: string[]) => Promise.all(ids.map((id) => fetch(`./scenarios/${id}.json`).then((r) => r.json()))))
      .then(setList)
      .catch(() => setList([]));
  }, []);

  const runAll = useCallback(async () => {
    setRunning(true);
    setResults(null);
    const out: ScenarioRun[] = [];
    const runnable = list.filter((s) => !SKIP.has(s.id));
    for (let i = 0; i < runnable.length; i++) {
      const runs = runScenario(runnable[i], { recordInterval: 2 });
      out.push(...runs);
      setProgress((i + 1) / runnable.length);
      setResults([...out]);
      await new Promise((r) => setTimeout(r, 0));
    }
    setRunning(false);
  }, [list]);

  const passed = results?.filter((r) => r.passed).length ?? 0;

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="panel row" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('scenarios.title')}</h2>
        <button className="primary" onClick={runAll} disabled={running}>
          {running ? t('common.loading') : t('common.runAll')}
        </button>
        {results && (
          <Badge tone={passed === results.length ? 'safe' : 'critical'}>
            {passed}/{results.length} {t('common.pass')}
          </Badge>
        )}
        {running && (
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3 }}>
              <div style={{ height: 6, width: `${(progress * 100).toFixed(0)}%`, background: 'var(--accent)', borderRadius: 3 }} />
            </div>
          </div>
        )}
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify({ results }, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'gurue-scenario-report.json';
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          {t('scenarios.report')} JSON
        </button>
      </div>

      <div className="grid-2">
        {list.map((sc) => {
          const run = results?.find((r) => r.scenarioId === sc.id);
          const badge = run ? scenarioPassBadge(run) : null;
          return (
            <div key={sc.id} className="panel" style={{ borderColor: scenario?.id === sc.id ? 'var(--accent)' : undefined }}>
              <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                <span className="mono" style={{ color: 'var(--accent)' }}>{sc.id}</span>
                <strong>{lang === 'ar' ? sc.nameAr : sc.name}</strong>
                <span style={{ marginInlineStart: 'auto' }}>
                  {badge === 'pass' && <Badge tone="safe">{t('common.pass')}</Badge>}
                  {badge === 'fail' && <Badge tone="critical">{t('common.fail')}</Badge>}
                  {badge === 'partial' && <Badge tone="watch">{t('common.partial')}</Badge>}
                </span>
              </div>
              <p className="small muted" style={{ margin: '6px 0' }}>
                {lang === 'ar' ? sc.descriptionAr : sc.description}
              </p>
              <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                <Badge>{sc.mode}</Badge>
                <Badge>{sc.duration} s</Badge>
                <Badge>{t('common.seed')} {sc.seed}</Badge>
                {sc.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
              </div>
              {run && (
                <div className="small" style={{ marginTop: 6 }}>
                  {run.assertions.map((a) => (
                    <div key={a.id} style={{ color: a.passed ? 'var(--safe)' : 'var(--critical)' }}>
                      {a.passed ? '✓' : '✗'} {a.expected} — {a.actual}
                    </div>
                  ))}
                </div>
              )}
              <div className="row" style={{ gap: 6, marginTop: 8 }}>
                <button onClick={() => { setScenario(sc); setPage('simulator'); }}>
                  {t('common.run')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
