export interface JwtPayload {
  exp?: number;
  iat?: number;
  sub?: string;
  [key: string]: any;
}

export function decodeToken(token: string | null): JwtPayload | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string | null, offsetSeconds = 0): boolean {
  const payload = decodeToken(token);
  if (!payload?.exp) return true;
  return (payload.exp * 1000) < (Date.now() + offsetSeconds * 1000);
}

export function getTokenExpirationDate(token: string | null): Date | null {
  const payload = decodeToken(token);
  if (!payload?.exp) return null;
  return new Date(payload.exp * 1000);
}
