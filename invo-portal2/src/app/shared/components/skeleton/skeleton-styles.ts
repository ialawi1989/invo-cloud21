/**
 * Shared shimmer styles for every skeleton primitive. Imported into each
 * component's `styles` so the look (colour, radius, animation) lives in one
 * place. Respects `prefers-reduced-motion`.
 */
export const SKELETON_STYLES = `
  :host { display: block; }
  .sk {
    display: block;
    background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 40%, #f1f5f9 80%);
    background-size: 200% 100%;
    border-radius: 6px;
    animation: sk-shimmer 1.3s linear infinite;
  }
  .sk--circle { border-radius: 50%; }
  @keyframes sk-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .sk { animation: none; }
  }
`;
