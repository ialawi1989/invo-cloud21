# invo-portal2 - project notes

## UI style

- **No coloured accent line on the edge of a card.** Do not add a thick left (or right) border, or a `::before` / `border-inline-start` stripe, to mark a card's status or type (e.g. the amber bar on the notification cards). Show status with a badge, an icon or text instead. Cards keep a plain 1px neutral border.

- **Document paper keeps the legacy look.** The paper content of documents (`shared/components/document-paper`, Classic mode) must match the legacy `unified-paper` exactly: its font (Amiri), card-style totals and payment boxes, badges and positions. Do not restyle it with portal chrome or `.app-product-badge*` chips. This applies to the paper only, not to the page around it.
