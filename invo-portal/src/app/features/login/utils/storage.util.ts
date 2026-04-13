/**
 * Secure storage wrapper — replaces localstorage-slim
 * Zero dependencies, uses native SubtleCrypto for real AES-GCM encryption.
 * Falls back to obfuscation when SubtleCrypto is unavailable.
 */

const STORAGE_PREFIX = 'invo_';
const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

// Default secret — override via StorageUtil.configure({ secret: '...' })
let _secret = 'invo-default-key-2025';

// ==================== Configuration ====================

interface StorageConfig {
  secret?: string;
  prefix?: string;
  storage?: Storage;
}

let _prefix = STORAGE_PREFIX;
let _storage: Storage = localStorage;

export function configureStorage(config: StorageConfig): void {
  if (config.secret) _secret = config.secret;
  if (config.prefix) _prefix = config.prefix;
  if (config.storage) _storage = config.storage;
}

// ==================== Public API ====================

/**
 * Store a value. Optionally encrypt it.
 */
export async function setItem<T>(key: string, value: T, encrypt = false): Promise<void> {
  const raw = JSON.stringify(value);
  const stored = encrypt ? await encryptValue(raw) : raw;
  _storage.setItem(_prefix + key, stored);
}

/**
 * Synchronous version for non-encrypted storage.
 */
export function setItemSync<T>(key: string, value: T, encrypt = false): void {
  const raw = JSON.stringify(value);
  const stored = encrypt ? obfuscate(raw) : raw;
  _storage.setItem(_prefix + key, stored);
}

/**
 * Retrieve a value. Set decrypt=true if it was stored encrypted.
 */
export async function getItem<T = any>(key: string, decrypt = false): Promise<T | null> {
  const stored = _storage.getItem(_prefix + key);
  if (stored === null) return null;
  try {
    const raw = decrypt ? await decryptValue(stored) : stored;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Synchronous version for non-encrypted or obfuscated retrieval.
 */
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

/**
 * Remove an item.
 */
export function removeItem(key: string): void {
  _storage.removeItem(_prefix + key);
}

/**
 * Remove multiple items.
 */
export function removeItems(...keys: string[]): void {
  keys.forEach(key => _storage.removeItem(_prefix + key));
}

/**
 * Clear all prefixed items.
 */
export function clearAll(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < _storage.length; i++) {
    const key = _storage.key(i);
    if (key?.startsWith(_prefix)) keysToRemove.push(key);
  }
  keysToRemove.forEach(key => _storage.removeItem(key));
}

// ==================== Encryption (AES-GCM) ====================

async function deriveKey(secret: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: ENCODER.encode('invo-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptValue(plaintext: string): Promise<string> {
  try {
    const key = await deriveKey(_secret);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      ENCODER.encode(plaintext)
    );
    // Combine IV + ciphertext, encode as base64
    const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  } catch {
    // Fallback to obfuscation if SubtleCrypto fails
    return obfuscate(plaintext);
  }
}

async function decryptValue(ciphertext: string): Promise<string> {
  try {
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const key = await deriveKey(_secret);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    return DECODER.decode(decrypted);
  } catch {
    // Fallback: try deobfuscation for legacy data
    return deobfuscate(ciphertext);
  }
}

// ==================== Obfuscation (fallback / sync) ====================

function obfuscate(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

function deobfuscate(str: string): string {
  try {
    return decodeURIComponent(
      Array.from(atob(str))
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
  } catch {
    return str;
  }
}
