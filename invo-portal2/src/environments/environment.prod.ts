// Re-export from the single canonical environment file. The
// dev-vs-prod URL switch lives in `environment.ts` and runs at
// runtime based on `window.location.hostname`, so Angular's
// build-time file replacement is intentionally a no-op here —
// keeping one source of truth for all URLs.
export { environment } from './environment';
