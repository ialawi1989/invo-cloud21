const STORAGE_PREFIX = 'invo_';
const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

let _secret = 'invo-default-key-2025';
let _prefix = STORAGE_PREFIX;
let _storage: Storage = localStorage;

export function configureStorage(config: { secret?: string; prefix?: string; storage?: Storage }): void {
  if (config.secret)  _secret  = config.secret;
  if (config.prefix)  _prefix  = config.prefix;
  if (config.storage) _storage = config.storage;
}

export function setItemSync<T>(key: string, value: T, encrypt = false): void {
  const raw    = JSON.stringify(value);
  const stored = encrypt ? obfuscate(raw) : raw;
  _storage.setItem(_prefix + key, stored);
}

export function getItemSync<T = any>(key: string, decrypt = false): T | null {
  const stored = _storage.getItem(_prefix + key);
  if (stored === null) return null;
  try {
    const raw = decrypt ? deobfuscate(stored) : stored;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function removeItem(key: string): void {
  _storage.removeItem(_prefix + key);
}

export function removeItems(...keys: string[]): void {
  keys.forEach(key => _storage.removeItem(_prefix + key));
}

export function clearAll(): void {
  const toRemove: string[] = [];
  for (let i = 0; i < _storage.length; i++) {
    const key = _storage.key(i);
    if (key?.startsWith(_prefix)) toRemove.push(key);
  }
  toRemove.forEach(k => _storage.removeItem(k));
}

function obfuscate(str: string): string {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16))
  ));
}

function deobfuscate(str: string): string {
  try {
    return decodeURIComponent(
      Array.from(atob(str)).map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    );
  } catch {
    return str;
  }
}
