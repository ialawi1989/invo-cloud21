/**
 * Candidate icons per Mobile-Icon-Bar item slug (faithful port of the legacy
 * `getIconsList()`). Several slugs offer multiple styles (outline vs. filled),
 * which is what makes the icon changeable. Shared between the config page (icon
 * picker) and the navigation list (live preview card).
 */
const stroke = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

export const ICON_SETS: Record<string, string[]> = {
  search:       [`<svg width="24" height="24" viewBox="0 0 24 24" ${stroke}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`],
  toTop:        [`<svg width="24" height="24" viewBox="0 0 24 24" ${stroke}><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>`],
  '/':          [`<svg width="24" height="24" viewBox="0 0 24 24" ${stroke}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`],
  categories:   [`<svg width="24" height="24" viewBox="0 0 24 24" ${stroke}><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`],
  wishlist:     [
    `<svg width="24" height="24" viewBox="0 0 24 24" ${stroke}><path d="m19 14 1.5-1.5c2-2 2-5 0-7s-5-2-7 0l-1.5 1.5L10.5 5.5c-2-2-5-2-7 0s-2 5 0 7L5 14l7 7 7-7z"/></svg>`,
    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="2" d="M11.083 5.104c.35-.8 1.485-.8 1.834 0l1.752 4.022a1 1 0 0 0 .84.597l4.463.342c.9.069 1.255 1.2.556 1.771l-3.33 2.723a1 1 0 0 0-.337 1.016l1.03 4.119c.214.858-.71 1.552-1.474 1.106l-3.913-2.281a1 1 0 0 0-1.008 0L7.583 20.8c-.764.446-1.688-.248-1.474-1.106l1.03-4.119A1 1 0 0 0 6.8 14.56l-3.33-2.723c-.698-.571-.342-1.702.557-1.771l4.462-.342a1 1 0 0 0 .84-.597l1.753-4.022Z"/></svg>`,
  ],
  cart:         [
    `<svg width="24" height="24" viewBox="0 0 24 24" ${stroke}><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>`,
    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10V6a3 3 0 0 1 3-3v0a3 3 0 0 1 3 3v4m3-2 .917 11.923A1 1 0 0 1 17.92 21H6.08a1 1 0 0 1-.997-1.077L6 8h12Z"/></svg>`,
  ],
  account:      [`<svg width="24" height="24" viewBox="0 0 24 24" ${stroke}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`],
  menu:         [
    `<svg width="24" height="24" viewBox="0 0 24 24" ${stroke}><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,
    `<svg width="24" height="24" viewBox="0 0 24 24" ${stroke}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M9 8h10M9 12h10M9 16h10M4.99 8H5m-.02 4h.01m0 4H5"/></svg>`,
  ],
  toggleMenu:   [`<svg width="24" height="24" viewBox="0 0 24 24" ${stroke}><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/></svg>`],
  compare:      [`<svg width="24" height="24" viewBox="0 0 24 24" ${stroke}><circle cx="6" cy="6" r="3"/><path d="M6 9v12"/><circle cx="18" cy="18" r="3"/><path d="M18 15V3"/></svg>`],
  shop:         [`<svg width="24" height="24" viewBox="0 0 24 24" ${stroke}><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>`],
  'my-orders':  [
    `<svg width="24" height="24" viewBox="0 0 24 24" ${stroke}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 13h3.439a.991.991 0 0 1 .908.6 3.978 3.978 0 0 0 7.306 0 .99.99 0 0 1 .908-.6H20M4 13v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6M4 13l2-9h12l2 9"/></svg>`,
  ],
  appointments: [
    `<svg width="24" height="24" viewBox="0 0 24 24" ${stroke}><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`,
    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 4h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3m0 3h6m-3 5h3m-6 0h.01M12 16h3m-6 0h.01M10 3v4h4V3h-4Z"/></svg>`,
  ],
  default:      [`<svg width="24" height="24" viewBox="0 0 24 24" ${stroke}><circle cx="12" cy="12" r="9"/></svg>`],
};

/** Candidate icons for an item slug (the user picks one). */
export function iconsForSlug(slug: string): string[] {
  return ICON_SETS[slug] ?? ICON_SETS['default'];
}
