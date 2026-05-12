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
  /** Optional defaults for the `settings` object on a fresh
   *  record — providers like BenefitPay store a constant `type`
   *  field that the backend keys off. */
  seedSettings?: () => Record<string, unknown>;
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
    {
      key: 'applesecretKey',
      labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.APPLE_SECRET_KEY',
      hintKey:  'PAYMENT_METHODS.CONNECT.FIELDS.APPLE_SECRET_KEY_HINT',
      type: 'password', required: false,
    },
  ],
};

/* Provider logos served from `public/images/payment-icons/`.
 * Copied verbatim from the legacy app's asset folder. */
const LOGO = (file: string) => `images/payment-icons/${file}`;

export const PROVIDERS: ProviderSpec[] = [
  {
    slug: 'afs',
    displayName: 'AFS',
    backendName: 'afs',
    logo: LOGO('afs.png'),
    setupDocUrl: 'https://www.afs.com.bh',
    fields: [FIELD.merchantId(), FIELD.apiPassword()],
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
        key: 'transportalPass',
        labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.TRANSPORTAL_PASS',
        type: 'password', required: true,
      },
      {
        key: 'terminalResourseKey',
        labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.TERMINAL_RESOURCE_KEY',
        type: 'text', required: true,
      },
    ],
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
  },
  {
    slug: 'credimax',
    displayName: 'CrediMax',
    backendName: 'CrediMax',
    logo: LOGO('credimax.jpg'),
    fields: [FIELD.merchantId(), FIELD.apiPassword()],
    applePay: APPLE_PAY_OVER_PROVIDER,
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
  },
  {
    slug: 'aps-ecr',
    displayName: 'APS ECR',
    backendName: 'APS ECR',
    logo: LOGO('aps.png'),
    fields: [FIELD.merchantId(false)],
    seedSettings: () => ({ type: 'ecr' }),
  },
  {
    slug: 'switch-ecr',
    displayName: 'Switch ECR',
    backendName: 'Switch ECR',
    logo: LOGO('switch.png'),
    fields: [FIELD.merchantId(false)],
    seedSettings: () => ({ type: 'ecr' }),
  },
  {
    slug: 'fatoorah',
    displayName: 'Fatoorah',
    backendName: 'Fatoorah',
    logo: LOGO('myFatoorah.png'),
    fields: [FIELD.token()],
  },
  {
    slug: 'gatee',
    displayName: 'Gatee',
    backendName: 'Gatee',
    logo: LOGO('gaatee_logo.png'),
    fields: [
      FIELD.merchantId(),
      FIELD.secretKey(),
      {
        key: 'hash',
        labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.HASH',
        type: 'password', required: true,
      },
    ],
  },
  {
    slug: 'hesabe',
    displayName: 'Hesabe',
    backendName: 'Hesabe',
    logo: LOGO('hesabi.png'),
    fields: [
      FIELD.merchantId(),
      FIELD.secretKey(),
      {
        key: 'IVKey',
        labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.IV_KEY',
        type: 'password', required: true,
      },
      {
        key: 'accessCode',
        labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.ACCESS_CODE',
        type: 'password', required: true,
      },
    ],
  },
  {
    slug: 'maxwallet',
    displayName: 'MaxWallet',
    backendName: 'MaxWallet',
    logo: LOGO('maxWallet.png'),
    fields: [FIELD.merchantId(), FIELD.appId(), FIELD.secretKey()],
  },
  {
    slug: 'tappayment',
    displayName: 'Tap',
    backendName: 'TapPayment',
    logo: LOGO('tap_logo.svg'),
    fields: [FIELD.secretKey()],
    applePay: APPLE_PAY_OVER_PROVIDER,
  },
  {
    slug: 'thawanipayment',
    displayName: 'Thawani',
    backendName: 'ThawaniPayment',
    logo: LOGO('thawani.jpg'),
    fields: [FIELD.secretKey(), FIELD.publishableKey()],
  },
  {
    slug: 'applepay',
    displayName: 'Apple Pay',
    backendName: 'ApplePay',
    logo: LOGO('applepay.png'),
    fields: [
      {
        key: 'host',
        labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.HOST',
        type: 'text', required: true,
      },
      {
        key: 'Merchant_Identifier',
        labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.APPLE_MERCHANT_IDENTIFIER',
        hintKey:  'PAYMENT_METHODS.CONNECT.FIELDS.APPLE_MERCHANT_IDENTIFIER_HINT',
        type: 'text', required: true,
      },
      {
        key: 'codeString',
        labelKey: 'PAYMENT_METHODS.CONNECT.FIELDS.APPLE_CODE_STRING',
        hintKey:  'PAYMENT_METHODS.CONNECT.FIELDS.APPLE_CODE_STRING_HINT',
        type: 'password', required: true,
      },
    ],
  },
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
