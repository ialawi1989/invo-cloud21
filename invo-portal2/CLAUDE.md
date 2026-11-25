# invo-portal2 - project notes

## UI style

- **No coloured accent line on the edge of a card.** Do not add a thick left (or right) border, or a `::before` / `border-inline-start` stripe, to mark a card's status or type (e.g. the amber bar on the notification cards). Show status with a badge, an icon or text instead. Cards keep a plain 1px neutral border.

- **Document paper keeps the legacy look.** The paper content of documents (`shared/components/document-paper`, Classic mode) must match the legacy `unified-paper` exactly: its font (Amiri), card-style totals and payment boxes, badges and positions. Do not restyle it with portal chrome or `.app-product-badge*` chips. This applies to the paper only, not to the page around it.

## Reports

- **Regenerate the report search keys whenever you add or change a report.** After adding a report, or changing the headings / column labels of a report that has its own body (`customBody` in `features/reports/models/report-catalog.ts`, or its component's template/code), run `node scripts/gen-report-search-keys.mjs` yourself, without being asked, and keep the updated `features/reports/models/report-body-search-keys.ts` in the change. It is generated: never edit it by hand. It is what lets the Reports catalog search find a report by what is inside it (e.g. "Sales By Category" finds Sales Summary). Flat and comparison reports are indexed live and need nothing.
