/**
 * Generate a UUID that also works outside a secure context.
 *
 * `crypto.randomUUID()` is only defined on secure origins (HTTPS or
 * `localhost`). When the dev server is served over plain HTTP on a LAN IP
 * (e.g. `http://192.168.x.x:4700`) it's `undefined`, which throws
 * "crypto.randomUUID is not a function". This helper prefers the native call
 * when available, falls back to a `crypto.getRandomValues`-based RFC-4122 v4
 * UUID, and finally to `Math.random` if the Web Crypto API is missing entirely.
 */
export function safeUuid(): string {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();

  const bytes = new Uint8Array(16);
  if (typeof c?.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  // Set the RFC-4122 version (4) and variant (10xx) bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'));
  return (
    hex.slice(0, 4).join('') + '-' +
    hex.slice(4, 6).join('') + '-' +
    hex.slice(6, 8).join('') + '-' +
    hex.slice(8, 10).join('') + '-' +
    hex.slice(10, 16).join('')
  );
}
