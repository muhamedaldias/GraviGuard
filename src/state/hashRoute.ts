import { useEffect } from 'react';
import type { PageId } from './store';

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

/**
 * Mirrors the zustand page state to the URL hash: deep-linkable pages, working
 * back/forward, no router dependency. Store stays the single source of truth.
 */
export function useHashRoute(
  page: PageId,
  setPage: (p: PageId) => void,
): void {
  // On mount + browser navigation: hash -> store.
  useEffect(() => {
    const apply = () => {
      const parsed = parseHash(window.location.hash);
      if (parsed !== null && parsed !== page) setPage(parsed);
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- page is read for the no-op guard only
  }, []);

  // Store -> hash (skips identical writes to avoid history spam).
  useEffect(() => {
    const next = formatHash(page);
    if (window.location.hash !== next) {
      window.location.hash = next;
    }
  }, [page]);
}
