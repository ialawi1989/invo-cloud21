export function isNullOrEmpty(str: string | null | undefined): boolean {
  return !str || str.length === 0;
}

export function isNullOrWhiteSpace(str: string | null | undefined): boolean {
  return !str || str.trim().length === 0;
}

export function isPhoneNumber(str: string | null | undefined): boolean {
  if (!str || isNullOrEmpty(str)) return false;
  // Simple pattern: allows +, digits, spaces, hyphens, and parentheses
  const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
  return phoneRegex.test(str.trim());
}

export function isUUID(str: string | null | undefined): boolean {
  if (!str || isNullOrEmpty(str)) return false;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
