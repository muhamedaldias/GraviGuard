// Vite ?url import for the maplibre worker chunk (see StationsMapPage).
declare module 'maplibre-gl/dist/maplibre-gl-worker.mjs?url' {
  const workerUrl: string;
  export default workerUrl;
}
