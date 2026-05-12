// ─────────────────────────────────────────────────────────────────────────
// Currency reference table
// ─────────────────────────────────────────────────────────────────────────
// Ported verbatim from InvoCloudFront2's payment-method-form. Used by
// the payment-methods Currency form so picking a currency auto-fills
// the method's `name`, `symbol`, and `afterDecimal`.
//
// The `symbol` is the latinised glyph (e.g. `KD` for Kuwaiti Dinar);
// the native script symbol from the legacy dataset isn't carried —
// it wasn't surfaced anywhere in the new UI. Add it back here if a
// consumer asks for it.
//
// Sorted alphabetically by `code`.
// ─────────────────────────────────────────────────────────────────────────

export interface Currency {
  code:          string;
  name:          string;
  symbol:        string;
  decimalDigits: number;
}

export const CURRENCIES: Currency[] = [
  { code: 'AED', name: 'United Arab Emirates Dirham',          symbol: 'AED',  decimalDigits: 2 },
  { code: 'AFN', name: 'Afghan Afghani',                       symbol: 'Af',   decimalDigits: 0 },
  { code: 'ALL', name: 'Albanian Lek',                         symbol: 'ALL',  decimalDigits: 0 },
  { code: 'AMD', name: 'Armenian Dram',                        symbol: 'AMD',  decimalDigits: 0 },
  { code: 'ARS', name: 'Argentine Peso',                       symbol: 'AR$',  decimalDigits: 2 },
  { code: 'AUD', name: 'Australian Dollar',                    symbol: 'AU$',  decimalDigits: 2 },
  { code: 'AZN', name: 'Azerbaijani Manat',                    symbol: 'man.', decimalDigits: 2 },
  { code: 'BAM', name: 'Bosnia-Herzegovina Convertible Mark',  symbol: 'KM',   decimalDigits: 2 },
  { code: 'BDT', name: 'Bangladeshi Taka',                     symbol: 'Tk',   decimalDigits: 2 },
  { code: 'BGN', name: 'Bulgarian Lev',                        symbol: 'BGN',  decimalDigits: 2 },
  { code: 'BHD', name: 'Bahraini Dinar',                       symbol: 'BHD',  decimalDigits: 3 },
  { code: 'BIF', name: 'Burundian Franc',                      symbol: 'FBu',  decimalDigits: 0 },
  { code: 'BND', name: 'Brunei Dollar',                        symbol: 'BN$',  decimalDigits: 2 },
  { code: 'BOB', name: 'Bolivian Boliviano',                   symbol: 'Bs',   decimalDigits: 2 },
  { code: 'BRL', name: 'Brazilian Real',                       symbol: 'R$',   decimalDigits: 2 },
  { code: 'BWP', name: 'Botswanan Pula',                       symbol: 'BWP',  decimalDigits: 2 },
  { code: 'BYN', name: 'Belarusian Ruble',                     symbol: 'Br',   decimalDigits: 2 },
  { code: 'BZD', name: 'Belize Dollar',                        symbol: 'BZ$',  decimalDigits: 2 },
  { code: 'CAD', name: 'Canadian Dollar',                      symbol: 'CA$',  decimalDigits: 2 },
  { code: 'CDF', name: 'Congolese Franc',                      symbol: 'CDF',  decimalDigits: 2 },
  { code: 'CHF', name: 'Swiss Franc',                          symbol: 'CHF',  decimalDigits: 2 },
  { code: 'CLP', name: 'Chilean Peso',                         symbol: 'CL$',  decimalDigits: 0 },
  { code: 'CNY', name: 'Chinese Yuan',                         symbol: 'CN¥',  decimalDigits: 2 },
  { code: 'COP', name: 'Colombian Peso',                       symbol: 'CO$',  decimalDigits: 0 },
  { code: 'CRC', name: 'Costa Rican Colón',                    symbol: '₡',   decimalDigits: 0 },
  { code: 'CVE', name: 'Cape Verdean Escudo',                  symbol: 'CV$',  decimalDigits: 2 },
  { code: 'CZK', name: 'Czech Republic Koruna',                symbol: 'Kč',   decimalDigits: 2 },
  { code: 'DJF', name: 'Djiboutian Franc',                     symbol: 'Fdj',  decimalDigits: 0 },
  { code: 'DKK', name: 'Danish Krone',                         symbol: 'Dkr',  decimalDigits: 2 },
  { code: 'DOP', name: 'Dominican Peso',                       symbol: 'RD$',  decimalDigits: 2 },
  { code: 'DZD', name: 'Algerian Dinar',                       symbol: 'DA',   decimalDigits: 2 },
  { code: 'EEK', name: 'Estonian Kroon',                       symbol: 'Ekr',  decimalDigits: 2 },
  { code: 'EGP', name: 'Egyptian Pound',                       symbol: 'EGP',  decimalDigits: 2 },
  { code: 'ERN', name: 'Eritrean Nakfa',                       symbol: 'Nfk',  decimalDigits: 2 },
  { code: 'ETB', name: 'Ethiopian Birr',                       symbol: 'Br',   decimalDigits: 2 },
  { code: 'EUR', name: 'Euro',                                 symbol: '€',    decimalDigits: 2 },
  { code: 'GBP', name: 'British Pound Sterling',               symbol: '£',    decimalDigits: 2 },
  { code: 'GEL', name: 'Georgian Lari',                        symbol: 'GEL',  decimalDigits: 2 },
  { code: 'GHS', name: 'Ghanaian Cedi',                        symbol: 'GH₵',  decimalDigits: 2 },
  { code: 'GNF', name: 'Guinean Franc',                        symbol: 'FG',   decimalDigits: 0 },
  { code: 'GTQ', name: 'Guatemalan Quetzal',                   symbol: 'GTQ',  decimalDigits: 2 },
  { code: 'HKD', name: 'Hong Kong Dollar',                     symbol: 'HK$',  decimalDigits: 2 },
  { code: 'HNL', name: 'Honduran Lempira',                     symbol: 'HNL',  decimalDigits: 2 },
  { code: 'HRK', name: 'Croatian Kuna',                        symbol: 'kn',   decimalDigits: 2 },
  { code: 'HUF', name: 'Hungarian Forint',                     symbol: 'Ft',   decimalDigits: 0 },
  { code: 'IDR', name: 'Indonesian Rupiah',                    symbol: 'Rp',   decimalDigits: 0 },
  { code: 'ILS', name: 'Israeli New Sheqel',                   symbol: '₪',    decimalDigits: 2 },
  { code: 'INR', name: 'Indian Rupee',                         symbol: 'Rs',   decimalDigits: 2 },
  { code: 'IQD', name: 'Iraqi Dinar',                          symbol: 'IQD',  decimalDigits: 0 },
  { code: 'IRR', name: 'Iranian Rial',                         symbol: 'IRR',  decimalDigits: 0 },
  { code: 'ISK', name: 'Icelandic Króna',                      symbol: 'Ikr',  decimalDigits: 0 },
  { code: 'JMD', name: 'Jamaican Dollar',                      symbol: 'J$',   decimalDigits: 2 },
  { code: 'JOD', name: 'Jordanian Dinar',                      symbol: 'JD',   decimalDigits: 3 },
  { code: 'JPY', name: 'Japanese Yen',                         symbol: '¥',    decimalDigits: 0 },
  { code: 'KES', name: 'Kenyan Shilling',                      symbol: 'Ksh',  decimalDigits: 2 },
  { code: 'KHR', name: 'Cambodian Riel',                       symbol: 'KHR',  decimalDigits: 2 },
  { code: 'KMF', name: 'Comorian Franc',                       symbol: 'CF',   decimalDigits: 0 },
  { code: 'KRW', name: 'South Korean Won',                     symbol: '₩',    decimalDigits: 0 },
  { code: 'KWD', name: 'Kuwaiti Dinar',                        symbol: 'KD',   decimalDigits: 3 },
  { code: 'KZT', name: 'Kazakhstani Tenge',                    symbol: 'KZT',  decimalDigits: 2 },
  { code: 'LBP', name: 'Lebanese Pound',                       symbol: 'L.L.', decimalDigits: 0 },
  { code: 'LKR', name: 'Sri Lankan Rupee',                     symbol: 'SLRs', decimalDigits: 2 },
  { code: 'LTL', name: 'Lithuanian Litas',                     symbol: 'Lt',   decimalDigits: 2 },
  { code: 'LVL', name: 'Latvian Lats',                         symbol: 'Ls',   decimalDigits: 2 },
  { code: 'LYD', name: 'Libyan Dinar',                         symbol: 'LD',   decimalDigits: 3 },
  { code: 'MAD', name: 'Moroccan Dirham',                      symbol: 'MAD',  decimalDigits: 2 },
  { code: 'MDL', name: 'Moldovan Leu',                         symbol: 'MDL',  decimalDigits: 2 },
  { code: 'MGA', name: 'Malagasy Ariary',                      symbol: 'MGA',  decimalDigits: 0 },
  { code: 'MKD', name: 'Macedonian Denar',                     symbol: 'MKD',  decimalDigits: 2 },
  { code: 'MMK', name: 'Myanma Kyat',                          symbol: 'MMK',  decimalDigits: 0 },
  { code: 'MOP', name: 'Macanese Pataca',                      symbol: 'MOP$', decimalDigits: 2 },
  { code: 'MUR', name: 'Mauritian Rupee',                      symbol: 'MURs', decimalDigits: 0 },
  { code: 'MXN', name: 'Mexican Peso',                         symbol: 'MX$',  decimalDigits: 2 },
  { code: 'MYR', name: 'Malaysian Ringgit',                    symbol: 'RM',   decimalDigits: 2 },
  { code: 'MZN', name: 'Mozambican Metical',                   symbol: 'MTn',  decimalDigits: 2 },
  { code: 'NAD', name: 'Namibian Dollar',                      symbol: 'N$',   decimalDigits: 2 },
  { code: 'NGN', name: 'Nigerian Naira',                       symbol: '₦',    decimalDigits: 2 },
  { code: 'NIO', name: 'Nicaraguan Córdoba',                   symbol: 'C$',   decimalDigits: 2 },
  { code: 'NOK', name: 'Norwegian Krone',                      symbol: 'Nkr',  decimalDigits: 2 },
  { code: 'NPR', name: 'Nepalese Rupee',                       symbol: 'NPRs', decimalDigits: 2 },
  { code: 'NZD', name: 'New Zealand Dollar',                   symbol: 'NZ$',  decimalDigits: 2 },
  { code: 'OMR', name: 'Omani Rial',                           symbol: 'OMR',  decimalDigits: 3 },
  { code: 'PAB', name: 'Panamanian Balboa',                    symbol: 'B/.',  decimalDigits: 2 },
  { code: 'PEN', name: 'Peruvian Nuevo Sol',                   symbol: 'S/.',  decimalDigits: 2 },
  { code: 'PHP', name: 'Philippine Peso',                      symbol: '₱',    decimalDigits: 2 },
  { code: 'PKR', name: 'Pakistani Rupee',                      symbol: 'PKRs', decimalDigits: 0 },
  { code: 'PLN', name: 'Polish Zloty',                         symbol: 'zł',   decimalDigits: 2 },
  { code: 'PYG', name: 'Paraguayan Guarani',                   symbol: '₲',    decimalDigits: 0 },
  { code: 'QAR', name: 'Qatari Rial',                          symbol: 'QR',   decimalDigits: 2 },
  { code: 'RON', name: 'Romanian Leu',                         symbol: 'RON',  decimalDigits: 2 },
  { code: 'RSD', name: 'Serbian Dinar',                        symbol: 'din.', decimalDigits: 0 },
  { code: 'RUB', name: 'Russian Ruble',                        symbol: 'RUB',  decimalDigits: 2 },
  { code: 'RWF', name: 'Rwandan Franc',                        symbol: 'RWF',  decimalDigits: 0 },
  { code: 'SAR', name: 'Saudi Riyal',                          symbol: 'SR',   decimalDigits: 2 },
  { code: 'SDG', name: 'Sudanese Pound',                       symbol: 'SDG',  decimalDigits: 2 },
  { code: 'SEK', name: 'Swedish Krona',                        symbol: 'Skr',  decimalDigits: 2 },
  { code: 'SGD', name: 'Singapore Dollar',                     symbol: 'S$',   decimalDigits: 2 },
  { code: 'SOS', name: 'Somali Shilling',                      symbol: 'Ssh',  decimalDigits: 0 },
  { code: 'SYP', name: 'Syrian Pound',                         symbol: 'SY£',  decimalDigits: 0 },
  { code: 'THB', name: 'Thai Baht',                            symbol: '฿',    decimalDigits: 2 },
  { code: 'TND', name: 'Tunisian Dinar',                       symbol: 'DT',   decimalDigits: 3 },
  { code: 'TOP', name: 'Tongan Paʻanga',                       symbol: 'T$',   decimalDigits: 2 },
  { code: 'TRY', name: 'Turkish Lira',                         symbol: 'TL',   decimalDigits: 2 },
  { code: 'TTD', name: 'Trinidad and Tobago Dollar',           symbol: 'TT$',  decimalDigits: 2 },
  { code: 'TWD', name: 'New Taiwan Dollar',                    symbol: 'NT$',  decimalDigits: 2 },
  { code: 'TZS', name: 'Tanzanian Shilling',                   symbol: 'TSh',  decimalDigits: 0 },
  { code: 'UAH', name: 'Ukrainian Hryvnia',                    symbol: '₴',    decimalDigits: 2 },
  { code: 'UGX', name: 'Ugandan Shilling',                     symbol: 'USh',  decimalDigits: 0 },
  { code: 'USD', name: 'US Dollar',                            symbol: '$',    decimalDigits: 2 },
  { code: 'UYU', name: 'Uruguayan Peso',                       symbol: '$U',   decimalDigits: 2 },
  { code: 'UZS', name: 'Uzbekistan Som',                       symbol: 'UZS',  decimalDigits: 0 },
  { code: 'VEF', name: 'Venezuelan Bolívar',                   symbol: 'Bs.F.', decimalDigits: 2 },
  { code: 'VND', name: 'Vietnamese Dong',                      symbol: '₫',    decimalDigits: 0 },
  { code: 'XAF', name: 'CFA Franc BEAC',                       symbol: 'FCFA', decimalDigits: 0 },
  { code: 'XOF', name: 'CFA Franc BCEAO',                      symbol: 'CFA',  decimalDigits: 0 },
  { code: 'YER', name: 'Yemeni Rial',                          symbol: 'YR',   decimalDigits: 0 },
  { code: 'ZAR', name: 'South African Rand',                   symbol: 'R',    decimalDigits: 2 },
  { code: 'ZMK', name: 'Zambian Kwacha',                       symbol: 'ZK',   decimalDigits: 0 },
  { code: 'ZWL', name: 'Zimbabwean Dollar',                    symbol: 'ZWL$', decimalDigits: 0 },
];

/** Lookup by code (case-insensitive). */
export function findCurrencyByCode(code: string | null | undefined): Currency | null {
  if (!code) return null;
  const want = code.trim().toUpperCase();
  return CURRENCIES.find(c => c.code === want) ?? null;
}

/** Best-effort: match an existing method's `name` (which legacy
 *  stores as either the currency code or the full English name)
 *  back to a `Currency` so the edit-form can pre-select. */
export function findCurrencyByName(name: string | null | undefined): Currency | null {
  if (!name) return null;
  const want = name.trim().toLowerCase();
  return CURRENCIES.find(c =>
    c.code.toLowerCase() === want || c.name.toLowerCase() === want,
  ) ?? null;
}
