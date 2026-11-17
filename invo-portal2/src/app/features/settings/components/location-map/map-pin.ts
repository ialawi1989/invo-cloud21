import * as L from 'leaflet';

/**
 * Inline SVG-based map pin — drawn as a Leaflet `divIcon` so we don't
 * depend on any external image (the bundled PNG icons get tripped up by
 * the bundler's URL resolution). 28×40, with the tip anchored at the
 * bottom-centre so the pin actually points at the picked coordinate.
 */
export const PIN_ICON = L.divIcon({
  className: 'loc-pin-icon',
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40" fill="none">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 12 24.5 13.2 25.97a1 1 0 0 0 1.6 0C16 38.5 28 23.5 28 14c0-7.73-6.27-14-14-14z"
            fill="#32acc1" stroke="#0e7490" stroke-width="1.5"/>
      <circle cx="14" cy="14" r="5" fill="#fff"/>
    </svg>
  `,
  iconSize:    [28, 40],
  iconAnchor:  [14, 40],
  popupAnchor: [0, -38],
});
