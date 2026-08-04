import { Block } from './block.types';
import { BlockStyle, Direction } from './style.types';

export type PaperSize = 'A3' | 'A4' | 'A5' | 'Letter' | 'Legal' | 'Thermal80' | 'Thermal58' | 'Custom';
export type Orientation = 'portrait' | 'landscape';

export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PageSetup {
  size: PaperSize;
  orientation: Orientation;
  /** When size === 'Custom'. mm. */
  customWidth?: number;
  customHeight?: number;
  margins: PageMargins;
  background?: string;
  /**
   * When false, the page-header section is rendered only on the first page.
   * Default true (header on every page). Independent of `first-page-header`,
   * which always overrides on page 1 when present.
   */
  repeatHeader?: boolean;
  /**
   * When false, the page-footer section is rendered only on the LAST page.
   * Non-last pages instead show a small "continued…" indicator at the bottom
   * so the reader knows the document continues. Default true (footer on every
   * page). Independent of `last-page-footer`, which is always appended to
   * the final page when present.
   */
  repeatFooter?: boolean;
  watermark?: {
    text?: string;
    image?: string;
    opacity?: number;
    rotation?: number;
  };
}

/** A logical region on the page. */
export type SectionType =
  | 'page-header' // repeats every page
  | 'page-footer' // repeats every page
  | 'first-page-header'
  | 'last-page-footer'
  | 'body';

export interface Section {
  id: string;
  type: SectionType;
  height?: number; // mm — auto if omitted (body uses remaining)
  blocks: Block[];
  style?: BlockStyle;
}

/** A reusable component (header, footer, table preset, address card). */
export interface ReusableComponent {
  id: string;
  name: string;
  blocks: Block[];
}

/** Tenant theme: brand colors, fonts, logo.
 *
 * Color slots are paired so presets can guarantee contrast:
 *   - `primaryColor` carries `onPrimaryColor` as the text/icon color used on
 *     top of it (table header text, badges).
 *   - `textColor` and `mutedColor` are intended for use on `surfaceColor` /
 *     page background.
 *
 * Renderers store snapshot hex values on each block, but `applyThemePreset`
 * remaps any block color matching a previous slot to the corresponding new
 * slot — so an on-theme design rebrands in one click without changing the
 * contrast pairings. */
export interface TenantTheme {
  id: string;
  primaryColor?: string;
  /** Text color for content rendered on top of `primaryColor`. Default: white. */
  onPrimaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  textColor?: string;
  mutedColor?: string;
  /** Card / section-band background that contrasts with the page background. */
  surfaceColor?: string;
  fontFamily?: string;
  arabicFontFamily?: string;
  logoUrl?: string;
  /** Custom CSS prepended to HTML render. */
  customCss?: string;
}

/** Top-level template document persisted to the backend. */
export interface ReportTemplate {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  page: PageSetup;
  direction: Direction;
  /** Locale for number/date formatting in expressions. */
  locale: string;
  /** Default language for bilingual templates. */
  language: 'en' | 'ar' | string;
  theme?: TenantTheme;
  defaultStyle?: BlockStyle;
  sections: Section[];
  components?: ReusableComponent[];
  /** Sample data attached to template for live preview. */
  sampleData?: Record<string, unknown>;
}
