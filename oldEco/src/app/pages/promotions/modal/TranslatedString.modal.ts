export type TranslatedString = { [key: string]: string };

export function translate(
  translatedString: TranslatedString,
  language: string
): string {
  if(!translatedString) return '';

  if (translatedString[language]) {
    return translatedString[language];
  }
  if (translatedString['en']) {
    return translatedString['en'];
  }
  const keys = Object.keys(translatedString);

  if (keys.length > 0) {
    const firstKey = Object.keys(translatedString)[0];
    if (firstKey) {
      return translatedString[firstKey];
    }
  }
  return '';
}

