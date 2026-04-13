/**
 * Lightweight JWT utilities — replaces @auth0/angular-jwt
 * Zero dependencies, works with Angular 21+
 */

export interface JwtPayload {
  exp?: number;
  iat?: number;
  sub?: string;
  [key: string]: any;
}

/**
 * Decode a JWT token payload without verifying the signature.
 * Returns null if the token is malformed.
 */
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

/**
 * Check if a JWT token is expired.
 * Returns true if the token is null, malformed, or expired.
 * @param offsetSeconds — optional buffer in seconds (default 0)
 */
export function isTokenExpired(token: string | null, offsetSeconds: number = 0): boolean {
  const payload = decodeToken(token);
  if (!payload?.exp) return true;
  return (payload.exp * 1000) < (Date.now() + offsetSeconds * 1000);
}

/**
 * Get the expiration date of a JWT token.
 * Returns null if the token is invalid or has no expiration.
 */
export function getTokenExpirationDate(token: string | null): Date | null {
  const payload = decodeToken(token);
  if (!payload?.exp) return null;
  return new Date(payload.exp * 1000);
}