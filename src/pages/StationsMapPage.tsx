import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ErrorEvent as MlErrorEvent, Map as MlMap, Marker } from 'maplibre-gl';
import { useApp } from '../state/store';
import { NETWORK_VIEW, STATIONS, type Station } from '../data/stations';
import type { Scenario } from '../sim/types';
import '../styles/map.css';

const CARTO_DARK = {
  version: 8 as const,
  sources: {
    carto: {
      type: 'raster' as const,
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [{ id: 'basemap', type: 'raster' as const, source: 'carto' }],
};

/**
 * Stations map — the network on a dark basemap, stations as brass ring markers,
 * an inline side panel as the accessible path (list → details → simulator).
 * maplibre-gl loads lazily; the page renders its panel before tiles arrive.
 */
export function StationsMapPage() {
  const { t } = useTranslation();
  const lang = useApp((s) => s.lang);
  const setScenario = useApp((s) => s.setScenario);
  const setPage = useApp((s) => s.setPage);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Station | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let map: MlMap | null = null;
    (async () => {
      try {
        const maplibregl = await import('maplibre-gl');
        const { default: workerUrl } = await import(
          'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
        );
        maplibregl.setWorkerUrl(workerUrl);
        await import('maplibre-gl/dist/maplibre-gl.css');
        if (disposed || containerRef.current === null) return;
        const created: MlMap = new maplibregl.Map({
          container: containerRef.current,
          style: CARTO_DARK,
          center: NETWORK_VIEW.center,
          zoom: NETWORK_VIEW.zoom,
          attributionControl: false,
          preserveDrawingBuffer: true,
        });
        map = created;
        created.on('error', (e: MlErrorEvent) => {
          if (!disposed) setMapError(e?.error?.message ?? 'tiles unavailable');
        });
        created.on('load', () => {
          if (disposed) return;
          for (const station of STATIONS) {
            const el = document.createElement('div');
            el.className = 'st-marker';
            el.setAttribute('aria-hidden', 'true');
            const dot = document.createElement('span');
            dot.className = 'st-dot';
            el.appendChild(dot);
            const marker = new maplibregl.Marker({ element: el })
              .setLngLat([station.lng, station.lat])
              .addTo(created);
            el.addEventListener('click', () => setSelected(station));
            markersRef.current.push(marker);
          }
        });
      } catch (err) {
        if (!disposed) setMapError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      disposed = true;
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      map?.remove();
      map = null;
    };
  }, []);

  const openInSimulator = async (station: Station) => {
    setOpeningId(station.id);
    try {
      const res = await fetch(`./scenarios/${station.scenarioId}.json`);
      if (!res.ok) throw new Error(`scenario ${station.scenarioId} not found`);
      const scenario = (await res.json()) as Scenario;
      setScenario(scenario);
      setPage('simulator');
    } catch (err) {
      setMapError(err instanceof Error ? err.message : String(err));
    } finally {
      setOpeningId(null);
    }
  };

  const kindLabel = (kind: Station['kind']) =>
    t(`map.kind.${kind}`);

  return (
    <div className="map-page">
      <aside className="map-panel" aria-label={t('map.listTitle')}>
        <h2 className="map-title">{t('map.title')}</h2>
        <p className="map-sub muted">{t('map.subtitle')}</p>
        <ul className="st-list">
          {STATIONS.map((s) => (
            <li key={s.id}>
              <button
                className={`st-row ${selected?.id === s.id ? 'sel' : ''}`}
                onClick={() => setSelected(s)}
                aria-pressed={selected?.id === s.id}
              >
                <span className="st-row-dot" data-kind={s.kind} />
                <span className="st-row-name">{lang === 'ar' ? s.nameAr : s.nameEn}</span>
                <span className="st-row-kind muted">{kindLabel(s.kind)}</span>
              </button>
            </li>
          ))}
        </ul>
        {selected !== null && (
          <section className="st-detail" aria-label={t('map.detailTitle')}>
            <h3 className="st-detail-name">{lang === 'ar' ? selected.nameAr : selected.nameEn}</h3>
            <dl className="st-facts">
              <div>
                <dt>{t('map.factKind')}</dt>
                <dd>{kindLabel(selected.kind)}</dd>
              </div>
              <div>
                <dt>{t('map.factScenario')}</dt>
                <dd className="mono">{selected.scenarioId}</dd>
              </div>
              <div>
                <dt>{t('map.factFlow')}</dt>
                <dd className="mono">{selected.nominal.flowM3s} {t('map.unitFlow')}</dd>
              </div>
              {selected.nominal.headM > 0 && (
                <div>
                  <dt>{t('map.factHead')}</dt>
                  <dd className="mono">{selected.nominal.headM} {t('map.unitHead')}</dd>
                </div>
              )}
              <div>
                <dt>{t('map.factLevel')}</dt>
                <dd className="mono">{selected.nominal.levelM} {t('map.unitHead')}</dd>
              </div>
            </dl>
            <button
              className="primary st-open"
              disabled={openingId !== null}
              onClick={() => void openInSimulator(selected)}
            >
              {openingId === selected.id ? t('map.opening') : t('map.openInSimulator')}
            </button>
          </section>
        )}
        {mapError !== null && (
          <p className="map-error" role="status">{t('map.errorNote')}: <span className="mono small">{mapError}</span></p>
        )}
      </aside>
      <div className="map-stage">
        <div ref={containerRef} className="map-canvas" />
        <noscript>{t('map.errorNote')}</noscript>
      </div>
    </div>
  );
}
