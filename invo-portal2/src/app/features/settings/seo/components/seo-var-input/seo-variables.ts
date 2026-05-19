/**
 * Variable catalog surfaced by the "+ Add Variable" dropdown on
 * every customize-defaults template input (title tag, meta
 * description, og:*, x:*). Grouped to match the Invo-style picker:
 *
 *   • SEO variables       — interpolated to other fields the user
 *                           already set on the same page-type
 *                           defaults (title/meta/og-*).
 *   • Site variables      — site-level metadata (name, etc.).
 *   • Business variables  — company info from the dashboard.
 *   • Business location   — address fields.
 *
 * Tokens use the same `{{ varName }}` shape the SEO renderer
 * already supports (see `previewTitle` in the editor modal and
 * `resolvedTitle` in the page-type list — they substitute
 * `{{ pageName }}` / `{{ siteName }}` today). New tokens listed here
 * extend that vocabulary; the storefront renderer is the single
 * place that resolves them at request time.
 */

export interface SeoVariableGroup {
  /** i18n key for the group section header. */
  labelKey:  string;
  variables: SeoVariable[];
}

export interface SeoVariable {
  /** Insertable token (without the `{{ }}` wrapping — the picker
   *  adds those on insert). Mirrors the existing `{{ pageName }}`
   *  shape used in default templates. */
  token:    string;
  /** i18n key for the row label shown in the dropdown. */
  labelKey: string;
  /** Optional i18n key for a secondary subtitle (Invo's picker
   *  shows e.g. "Set in SEO basics section" under each entry to
   *  hint where the value originates). */
  hintKey?: string;
}

export const SEO_VARIABLE_GROUPS: readonly SeoVariableGroup[] = [
  {
    labelKey: 'SEO.VARS.GROUP.SEO',
    variables: [
      { token: 'pageName',
        labelKey: 'SEO.VARS.PAGE_NAME',
        hintKey:  'SEO.VARS.HINT_PAGE' },
      { token: 'titleTag',
        labelKey: 'SEO.VARS.TITLE_TAG',
        hintKey:  'SEO.VARS.HINT_BASICS' },
      { token: 'metaDescription',
        labelKey: 'SEO.VARS.META_DESC',
        hintKey:  'SEO.VARS.HINT_BASICS' },
      { token: 'ogTitle',
        labelKey: 'SEO.VARS.OG_TITLE',
        hintKey:  'SEO.VARS.HINT_SOCIAL' },
      { token: 'ogDescription',
        labelKey: 'SEO.VARS.OG_DESC',
        hintKey:  'SEO.VARS.HINT_SOCIAL' },
      { token: 'ogImage',
        labelKey: 'SEO.VARS.OG_IMAGE',
        hintKey:  'SEO.VARS.HINT_SOCIAL' },
    ],
  },
  {
    labelKey: 'SEO.VARS.GROUP.SITE',
    variables: [
      { token: 'siteName',
        labelKey: 'SEO.VARS.SITE_NAME',
        hintKey:  'SEO.VARS.HINT_DASHBOARD' },
      { token: 'siteUrl',
        labelKey: 'SEO.VARS.SITE_URL',
        hintKey:  'SEO.VARS.HINT_DASHBOARD' },
    ],
  },
  {
    labelKey: 'SEO.VARS.GROUP.BUSINESS',
    variables: [
      { token: 'businessName',
        labelKey: 'SEO.VARS.BIZ_NAME',
        hintKey:  'SEO.VARS.HINT_GENERAL' },
      { token: 'businessDescription',
        labelKey: 'SEO.VARS.BIZ_DESC',
        hintKey:  'SEO.VARS.HINT_GENERAL' },
    ],
  },
  {
    labelKey: 'SEO.VARS.GROUP.LOCATION',
    variables: [
      { token: 'businessCountry',  labelKey: 'SEO.VARS.LOC_COUNTRY' },
      { token: 'businessState',    labelKey: 'SEO.VARS.LOC_STATE'   },
      { token: 'businessCity',     labelKey: 'SEO.VARS.LOC_CITY'    },
      { token: 'businessStreet',   labelKey: 'SEO.VARS.LOC_STREET'  },
      { token: 'businessAddress',  labelKey: 'SEO.VARS.LOC_DESC'    },
    ],
  },
];
