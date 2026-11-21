import { useEffect } from 'react';
import { useApp, type PageId } from './store';

/** Every routable page id — keep in sync with the PageId union in store.ts. */
const ROUTE_PAGES: readonly PageId[] = [
  'landing',
  'simulator',
  'curves',
  'twin',
  'pump',
  'controller',
  'sensors',
  'transients',
  'sizing',
  'applicability',
  'montecarlo',
  'scenarios',
  'reports',
  'methodology',
  'tour',
  'settings',
];

/** '#/app/twin' -> 'twin'; '#/' or '' -> 'landing'; unknown -> null. */
export function parseHash(hash: string): PageId | null {
  const path = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (path === '') return 'landing';
  const seg = path.startsWith('app/') ? path.slice(4) : path;
  return (ROUTE_PAGES as readonly string[]).includes(seg) ? (seg as PageId) : null;
}

/** 'twin' -> '#/app/twin'; landing -> '#/'. */
export function formatHash(page: PageId): string {
  return page === 'landing' ? '#/' : `#/app/${page}`;
}

/** Initial page for the store: honor a deep link present at load time. */
export function initialPageFromHash(): PageId {
  if (typeof window === 'undefined') return 'landing';
  return parseHash(window.location.hash) ?? 'landing';
}

/**
 * Mirrors the zustand page state to the URL hash: deep-linkable pages, working
 * back/forward, no router dependency. Store stays the single source of truth;
 * the listener reads FRESH state (never a stale closure).
 */
export function useHashRoute(setPage: (p: PageId) => void): void {
  useEffect(() => {
    const apply = () => {
      const parsed = parseHash(window.location.hash);
      const current = useApp.getState().page;
      if (parsed !== null && parsed !== current) setPage(parsed);
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [setPage]);
}
