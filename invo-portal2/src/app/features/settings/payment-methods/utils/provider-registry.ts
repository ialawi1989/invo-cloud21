// ─────────────────────────────────────────────────────────────────────────
// Online payment provider registry
// ─────────────────────────────────────────────────────────────────────────
// Drives the connect form (`/settings/payment-methods/connect/:slug`) for
// every online provider. Each entry specifies:
//
//   • `slug`        — URL segment + cache key (lowercase, no spaces).
//   • `displayName` — human label rendered in the page title.
//   • `backendName` — the literal string stored in the wire field
//                     `PaymentMethod.name` for this provider. The legacy
//                     constructor switches on this exact string when
//                     instantiating the right settings class.
//   • `setupDocUrl` — optional link to the provider's onboarding docs.
//   • `fields`      — credential inputs the form should render. Each
//                     field maps to a key under `method.settings`.
//   • `applePay`    — optional sub-section for providers that proxy
//                     Apple Pay (Tap, CrediMax). Renders as a second
//                     card; the keys live under
//                     `method.settings.applepaySettings`.
//   • `seedSettings` — function returning the initial `settings` object
//                     when creating a brand-new method for this provider.
//
// Adding a new provider = one entry here + i18n keys for its labels.
// The connect component is otherwise generic.
// ─────────────────────────────────────────────────────────────────────────

export interface ProviderFieldSpec {
  /** Dot-free key on `method.settings` (e.g. `merchantId`). */
  key:      string;
  labelKey: string;
  hintKey?: string;
  type:     'text' | 'password';
  required: boolean;
}

export interface ProviderApplePaySpec {
  fields: ProviderFieldSpec[];
}

/** Optional icon-picker entry — providers that ship multiple
 *  thumbnail variants (Tap: provider logo / debit / credit) let
 *  the user pick which one renders alongside the method. Value is
 *  written to `settings.icon` verbatim. */
export interface ProviderIconChoice {
  /** Stored verbatim in `settings.icon`. */
  value:  string;
  /** Image path served from `public/`. */
  logo:   string;
  labelKey?: string;
}

export interface ProviderSpec {
  slug:         string;
  displayName:  string;
  backendName:  string;
  /** Provider logo — relative path served from `public/images/`.
   *  Used by the list page (Online tab) as the row thumbnail and
   *  by the connect form's page header. */
  logo?:        string;
  setupDocUrl?: string;
  fields:       ProviderFieldSpec[];
  applePay?:    ProviderApplePaySpec;
  /** One-line description rendered under the provider name on the
   *  Connect tab's large card. i18n key, not raw text. */
  descriptionKey?: string;
  /** Optional defaults for the `settings` object on a fresh
   *  record — providers like BenefitPay store a constant `type`
   *  field that the backend keys off. */
  seedSettings?: () => Record<string, unknown>;
  /** Countries this provider serves. The list page filters the
   *  Online tab to providers whose `countries[]` includes the
   *  company's country, matching the legacy
   *  `setCountryValueForPaymentsConnect` mapping. */
  countries:    readonly string[];
  /** Render the "Enable Test Mode" toggle — flag stored at
   *  `settings.isTestModeEnabeled` (legacy typo kept intentionally
   *  so existing records round-trip). */
  testMode?:    boolean;
  /** Render an icon-picker between the account and the enable
   *  toggle. Each entry's `value` is written to `settings.icon`. */
  icons?:       readonly ProviderIconChoice[];
  /** Info-callout copy at the top of each card. Values are i18n
   *  keys whose translation may contain inline HTML (`<a>`, `<ul>`,
   *  `<li>`) — rendered via `[innerHTML]` so providers can ship
   *  rich setup instructions without bespoke components. */
  notes?:       { configKey?: string; applePayKey?: string };
  /** Render the three Apple-Pay file inputs (domain verification,
   *  private key, identity cert). The files are captured in the
   *  component but never sent on save — same as legacy. */
  applePayFiles?: boolean;
  /** Render the POS-availability toggle (`method.pos`). Legacy
   *  surfaces this on BenefitPay and the ECR family alongside the
   *  Enabled toggle. */
  posToggle?:   boolean;
  /** Render the Benefit-specific "Test Payment" card — note, test
   *  cards reference table, and a 4-row perform-test grid. The
   *  Perform buttons are no-op (matches the legacy stub). */
  benefitTestPayment?: boolean;
}

/* Shared field specs — `merchantId` and `apiPassword` recur across
 * many providers. Keep the strings here so a global label tweak
 * only edits one place. */
const FIELD = {
  merchantId: (required = true): ProviderFieldSpec => ({
    key: 'merchantId',
    labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.MERCHANT_ID',
    hintKey:  'PAYMENT_METHODS.CONNECT.FIELDS.MERCHANT_ID_HINT',
    type: 'text', required,
  }),
  apiPassword: (required = true): ProviderFieldSpec => ({
    key: 'apiPassword',
    labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.API_PASSWORD',
    hintKey:  'PAYMENT_METHODS.CONNECT.FIELDS.API_PASSWORD_HINT',
    type: 'password', required,
  }),
  secretKey: (required = true): ProviderFieldSpec => ({
    key: 'secretKey',
    labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.SECRET_KEY',
    hintKey:  'PAYMENT_METHODS.CONNECT.FIELDS.SECRET_KEY_HINT',
    type: 'password', required,
  }),
  publishableKey: (required = true): ProviderFieldSpec => ({
    key: 'publishableKey',
    labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.PUBLISHABLE_KEY',
    hintKey:  'PAYMENT_METHODS.CONNECT.FIELDS.PUBLISHABLE_KEY_HINT',
    type: 'text', required,
  }),
  appId: (required = true): ProviderFieldSpec => ({
    key: 'appId',
    labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.APP_ID',
    hintKey:  'PAYMENT_METHODS.CONNECT.FIELDS.APP_ID_HINT',
    type: 'text', required,
  }),
  token: (required = true): ProviderFieldSpec => ({
    key: 'token',
    labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.TOKEN',
    hintKey:  'PAYMENT_METHODS.CONNECT.FIELDS.TOKEN_HINT',
    type: 'password', required,
  }),
} as const;

/** Shared Apple-Pay-over-X sub-block (used by Tap and CrediMax).
 *  Stored under `settings.applepaySettings`. */
const APPLE_PAY_OVER_PROVIDER: ProviderApplePaySpec = {
  fields: [
    {
      key: 'merchantIdentifier',
      labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.APPLE_MERCHANT_IDENTIFIER',
      hintKey:  'PAYMENT_METHODS.CONNECT.FIELDS.APPLE_MERCHANT_IDENTIFIER_HINT',
      type: 'text', required: false,
    },
    // {
    //   key: 'applesecretKey',
    //   labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.APPLE_SECRET_KEY',
    //   hintKey:  'PAYMENT_METHODS.CONNECT.FIELDS.APPLE_SECRET_KEY_HINT',
    //   type: 'password', required: false,
    // },
  ],
};

/* Provider logos served from `public/images/payment-icons/`.
 * Copied verbatim from the legacy app's asset folder. */
const LOGO = (file: string) => `images/payment-icons/${file}`;

/** Build the standard 3-tile icon picker every gateway uses
 *  (default provider logo + generic debit + generic credit). */
const ICONS = (defaultLogo: string): ProviderIconChoice[] => [
  { value: 'default',     logo: defaultLogo,             labelKey: 'PAYMENT_METHODS.CONNECT.ICONS.DEFAULT' },
  { value: 'Debit Card',  logo: LOGO('card.svg'),        labelKey: 'PAYMENT_METHODS.CONNECT.ICONS.DEBIT_CARD' },
  { value: 'Credit Card', logo: LOGO('credit-card.svg'), labelKey: 'PAYMENT_METHODS.CONNECT.ICONS.CREDIT_CARD' },
];

/* Country list shortcuts — saved off in one place so each provider
 * row stays readable. Mirror the legacy
 * `setCountryValueForPaymentsConnect` mapping verbatim. */
const GCC_FULL = ['Bahrain', 'Kuwait', 'Oman', 'Qatar', 'Saudi Arabia', 'United Arab Emirates'] as const;
const BAHRAIN_ONLY = ['Bahrain'] as const;
const KUWAIT_ONLY  = ['Kuwait'] as const;
const OMAN_ONLY    = ['Oman'] as const;
const BAHRAIN_IRAQ = ['Bahrain', 'Iraq'] as const;

export const PROVIDERS: ProviderSpec[] = [
  {
    slug: 'afs',
    displayName: 'AFS',
    backendName: 'afs',
    logo: LOGO('afs.png'),
    setupDocUrl: 'https://www.afs.com.bh',
    fields: [FIELD.merchantId(), FIELD.apiPassword()],
    countries: BAHRAIN_ONLY,
    descriptionKey: 'PAYMENT_METHODS.PROVIDERS.AFS_DESC',
    icons: ICONS(LOGO('afs.png')),
    notes: { configKey: 'PAYMENT_METHODS.CONNECT.NOTES.AFS_CONFIG' },
  },
  {
    slug: 'benefit',
    displayName: 'Benefit',
    backendName: 'Benefit',
    logo: LOGO('benefit.png'),
    fields: [
      {
        key: 'transportalID',
        labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.TRANSPORTAL_ID',
        type: 'text', required: true,
      },
      {
        key: 'terminalResourseKey',
        labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.TERMINAL_RESOURCE_KEY',
        type: 'text', required: true,
      },
      {
        key: 'transportalPass',
        labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.TRANSPORTAL_PASS',
        type: 'password', required: true,
      },
    ],
    countries: BAHRAIN_ONLY,
    descriptionKey: 'PAYMENT_METHODS.PROVIDERS.BENEFIT_DESC',
    icons: ICONS(LOGO('benefit.png')),
    notes: { configKey: 'PAYMENT_METHODS.CONNECT.NOTES.BENEFIT_CONFIG' },
    benefitTestPayment: true,
  },
  {
    slug: 'benefitpay',
    displayName: 'BenefitPay',
    backendName: 'BenefitPay',
    logo: LOGO('BenefitPay.png'),
    fields: [FIELD.merchantId(), FIELD.appId(), FIELD.secretKey()],
    // The legacy `BenefitPay` constructor pins `type = "QR"` —
    // preserve that on a fresh record so the backend's matching
    // logic doesn't break.
    seedSettings: () => ({ type: 'QR' }),
    countries: BAHRAIN_ONLY,
    descriptionKey: 'PAYMENT_METHODS.PROVIDERS.BENEFITPAY_DESC',
    icons: ICONS(LOGO('BenefitPay.png')),
    notes: { configKey: 'PAYMENT_METHODS.CONNECT.NOTES.BENEFITPAY_CONFIG' },
    posToggle: true,
  },
  {
    slug: 'credimax',
    displayName: 'CrediMax',
    backendName: 'CrediMax',
    logo: LOGO('credimax.jpg'),
    fields: [FIELD.merchantId(), FIELD.apiPassword()],
    applePay: APPLE_PAY_OVER_PROVIDER,
    countries: BAHRAIN_ONLY,
    descriptionKey: 'PAYMENT_METHODS.PROVIDERS.CREDIMAX_DESC',
    icons: ICONS(LOGO('credimax.jpg')),
    testMode: true,
    applePayFiles: true,
    notes: {
      configKey:   'PAYMENT_METHODS.CONNECT.NOTES.CREDIMAX_CONFIG',
      applePayKey: 'PAYMENT_METHODS.CONNECT.NOTES.CREDIMAX_APPLE_PAY',
    },
  },
  {
    slug: 'credimax-ecr',
    displayName: 'CrediMax ECR',
    backendName: 'CrediMax ECR',
    logo: LOGO('ecr.jpg'),
    // The legacy `CrediMaxECRPayment` class has no credential
    // fields — it's a presence flag. We still render the
    // connect page so the user can pick an account + enable.
    fields: [],
    seedSettings: () => ({ type: 'ecr' }),
    countries: BAHRAIN_ONLY,
    descriptionKey: 'PAYMENT_METHODS.PROVIDERS.CREDIMAX_ECR_DESC',
    posToggle: true,
  },
  {
    slug: 'aps-ecr',
    displayName: 'APS ECR',
    backendName: 'APS ECR',
    logo: LOGO('aps.png'),
    fields: [FIELD.merchantId(false)],
    seedSettings: () => ({ type: 'ecr' }),
    countries: BAHRAIN_IRAQ,
    descriptionKey: 'PAYMENT_METHODS.PROVIDERS.APS_ECR_DESC',
    posToggle: true,
  },
  {
    slug: 'switch-ecr',
    displayName: 'Switch ECR',
    backendName: 'Switch ECR',
    logo: LOGO('switch.png'),
    fields: [
      // FIELD.merchantId(false)

    ],
    seedSettings: () => ({ type: 'ecr' }),
    countries: BAHRAIN_IRAQ,
    descriptionKey: 'PAYMENT_METHODS.PROVIDERS.SWITCH_ECR_DESC',
    posToggle: true,
  },
  {
    slug: 'fatoorah',
    displayName: 'Fatoorah',
    backendName: 'Fatoorah',
    logo: LOGO('myFatoorah.png'),
    fields: [FIELD.token()],
    countries: GCC_FULL,
    descriptionKey: 'PAYMENT_METHODS.PROVIDERS.FATOORAH_DESC',
    icons: ICONS(LOGO('myFatoorah.png')),
    notes: { configKey: 'PAYMENT_METHODS.CONNECT.NOTES.FATOORAH_CONFIG' },
  },
  {
    slug: 'gatee',
    displayName: 'Gatee',
    backendName: 'Gatee',
    logo: LOGO('gaatee_logo.png'),
    // Legacy `Gatee` settings class also carries a `hash` field, but
    // the legacy form never surfaces it — the value is server-set
    // and round-tripped via `settings` untouched. Keep parity.
    fields: [FIELD.merchantId(), FIELD.secretKey()],
    countries: GCC_FULL,
    descriptionKey: 'PAYMENT_METHODS.PROVIDERS.GATEE_DESC',
    icons: ICONS(LOGO('gaatee_logo.png')),
    notes: { configKey: 'PAYMENT_METHODS.CONNECT.NOTES.GATEE_CONFIG' },
  },
  {
    slug: 'hesabe',
    displayName: 'Hesabe',
    backendName: 'Hesabe',
    logo: LOGO('hesabi.png'),
    fields: [
      FIELD.merchantId(),
      {
        key: 'accessCode',
        labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.ACCESS_CODE',
        type: 'text', required: true,
      },
      FIELD.secretKey(),
      {
        key: 'IVKey',
        labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.IV_KEY',
        type: 'password', required: true,
      },
    ],
    countries: KUWAIT_ONLY,
    descriptionKey: 'PAYMENT_METHODS.PROVIDERS.HESABE_DESC',
    icons: ICONS(LOGO('hesabi.png')),
    notes: { configKey: 'PAYMENT_METHODS.CONNECT.NOTES.HESABE_CONFIG' },
  },
  {
    slug: 'maxwallet',
    displayName: 'MaxWallet',
    backendName: 'MaxWallet',
    logo: LOGO('maxWallet.png'),
    fields: [FIELD.merchantId(), FIELD.appId(), FIELD.secretKey()],
    countries: BAHRAIN_ONLY,
    descriptionKey: 'PAYMENT_METHODS.PROVIDERS.MAXWALLET_DESC',
    icons: ICONS(LOGO('maxWallet.png')),
    notes: { configKey: 'PAYMENT_METHODS.CONNECT.NOTES.MAXWALLET_CONFIG' },
  },
  {
    slug: 'tappayment',
    displayName: 'Tap',
    backendName: 'TapPayment',
    logo: LOGO('tap_logo.svg'),
    fields: [FIELD.secretKey()],
    applePay: APPLE_PAY_OVER_PROVIDER,
    countries: GCC_FULL,
    descriptionKey: 'PAYMENT_METHODS.PROVIDERS.TAP_DESC',
    testMode: true,
    icons: ICONS(LOGO('tap_logo.svg')),
    notes: {
      configKey:   'PAYMENT_METHODS.CONNECT.NOTES.TAP_CONFIG',
      applePayKey: 'PAYMENT_METHODS.CONNECT.NOTES.TAP_APPLE_PAY',
    },
    applePayFiles: true,
  },
  {
    slug: 'thawanipayment',
    displayName: 'Thawani',
    backendName: 'ThawaniPayment',
    logo: LOGO('thawani.jpg'),
    fields: [FIELD.secretKey(), FIELD.publishableKey()],
    countries: OMAN_ONLY,
    descriptionKey: 'PAYMENT_METHODS.PROVIDERS.THAWANI_DESC',
    icons: ICONS(LOGO('thawani.jpg')),
    notes: { configKey: 'PAYMENT_METHODS.CONNECT.NOTES.THAWANI_CONFIG' },
  },
  // Note: the legacy `PaymnetMethod` constructor has an `ApplePay`
  // branch for backwards compat, but Apple Pay isn't a standalone
  // gateway in the Connect tab — it's only meaningfully configured
  // as the `applePay` sub-block on CrediMax and Tap. We deliberately
  // don't surface it here.
];

/** Map by both `slug` AND the legacy `backendName` so the list page
 *  can look up a row's logo from whichever the server returned in
 *  `method.name`. */
const BY_NAME = new Map<string, ProviderSpec>();
for (const p of PROVIDERS) {
  BY_NAME.set(p.slug, p);
  BY_NAME.set(p.backendName.toLowerCase().replace(/\s+/g, '-'), p);
  BY_NAME.set(p.backendName, p);
}

export function findProviderByName(name: string | null | undefined): ProviderSpec | null {
  if (!name) return null;
  const key = name.trim();
  return BY_NAME.get(key)
      ?? BY_NAME.get(key.toLowerCase().replace(/\s+/g, '-'))
      ?? null;
}

/** Convenience wrapper — calls `findProviderByName` with the
 *  slug-shaped input. Kept as a named export so call sites read
 *  more naturally. */
export function findProviderBySlug(slug: string | null | undefined): ProviderSpec | null {
  return findProviderByName(slug);
}

/** Lightweight shape used by `buildConnectList` — we only need the
 *  `name` field to look up the provider, so callers can pass their
 *  full `PaymentMethod` rows or anything compatible. */
export interface ConnectRow {
  name?: string;
}

/**
 * Project the raw `getOnlinePaymentMethods` response into the list
 * the Connect tab actually shows. Two-step pipeline:
 *
 *   1. Drop every server row whose `name` doesn't map to a known
 *      provider. The endpoint also returns user-created Cash
 *      methods (BHD wallets, custom currencies) and legacy
 *      `ApplePay` rows; those have no place on the Connect tab.
 *   2. Append a stub for every registry provider not already
 *      represented by a server row, so the user sees "Connect"
 *      cards for the rest.
 *
 * Country gate: when `country` is provided, drop providers whose
 * `countries[]` doesn't include it — same semantics as the legacy
 * `setCountryValueForPaymentsConnect` mapping. Already-saved server
 * rows are kept regardless (so a record provisioned in another
 * region doesn't silently disappear from the list).
 *
 * Stubs are created with the canonical `backendName` so the form
 * round-trips correctly when the user clicks Connect on one of them.
 */
export function buildConnectList<T extends ConnectRow>(
  serverRows: T[],
  stubFactory: (provider: ProviderSpec) => T,
  country?: string | null,
): T[] {
  const seenSlugs = new Set<string>();
  const out: T[] = [];

  // 1. Keep every server row that maps to a known provider AND
  //    serves the company's country. Drops Cash currency rows and
  //    ApplePay leftovers (no registry match) as well as providers
  //    that aren't available in this country — same semantics as
  //    legacy `filterPaymentsConnectByCountry()`.
  for (const row of serverRows) {
    const p = findProviderByName(row.name);
    if (!p) continue;
    if (country && !(p.countries as readonly string[]).includes(country)) continue;
    out.push(row);
    seenSlugs.add(p.slug);
  }

  // 2. Append stubs for providers that didn't come back from the
  //    server, restricted to ones that serve the company's country.
  for (const p of PROVIDERS) {
    if (seenSlugs.has(p.slug)) continue;
    if (country && !(p.countries as readonly string[]).includes(country)) continue;
    out.push(stubFactory(p));
  }

  return out;
}
