import { app, safeStorage } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import type { LLMProviderConfig } from '@llmTypes';

const ENCRYPTION_KEY_FILE = 'votc-enc-key.dat';
const ENCRYPTED_PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96-bit IV recommended for GCM

function getKeyFilePath(): string {
  return path.join(app.getPath('userData'), ENCRYPTION_KEY_FILE);
}

function isSafeStorageAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

// Load or create AES-256 master key (then encrypted via safeStorage).
function getOrCreateMasterKey(): Buffer | null {
  const keyPath = getKeyFilePath();

  if (fs.existsSync(keyPath)) {
    try {
      const encryptedKey = fs.readFileSync(keyPath, 'utf-8');
      const base64 = safeStorage.decryptString(
        Buffer.from(encryptedKey, 'base64')
      );
      return Buffer.from(base64, 'base64');
    } catch (err) {
      console.error(
        '[ApiKeyCrypto] Failed to decrypt existing master key. ' +
          'This can happen after OS re-install or credential change.',
        err
      );
      // Fall through to regenerate — old encrypted keys will be
      // reencrypted with new master key during migration.
    }
  }

  if (!isSafeStorageAvailable()) {
    console.warn(
      '[ApiKeyCrypto] safeStorage is NOT available on this system. ' +
        'API keys will remain in plain text.'
    );
    return null;
  }

  const rawKey = crypto.randomBytes(32);
  const encryptedForStorage = safeStorage.encryptString(
    rawKey.toString('base64')
  );
  fs.writeFileSync(keyPath, encryptedForStorage.toString('base64'), 'utf-8');
  console.log('[ApiKeyCrypto] New master encryption key generated and saved.');
  return rawKey;
}

let _masterKey: Buffer | null | undefined = undefined; // cached singleton

function masterKey(): Buffer | null {
  if (!app.isReady()) {
    // safeStorage cannot be used before app is ready.
    return null;
  }
  if (_masterKey === undefined) {
    _masterKey = getOrCreateMasterKey();
  }
  return _masterKey;
}

export function encryptApiKey(plainText: string): string {
  if (!plainText) return plainText;

  if (plainText.startsWith(ENCRYPTED_PREFIX)) return plainText;

  const key = masterKey();
  if (!key) return plainText; // safeStorage unavailable

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf-8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // enc:v1:<iv>.<authTag>.<cipherText>   — all base64
  return (
    ENCRYPTED_PREFIX +
    iv.toString('base64') +
    '.' +
    authTag.toString('base64') +
    '.' +
    encrypted.toString('base64')
  );
}

export function decryptApiKey(maybeEncrypted: string): string {
  if (!maybeEncrypted) return maybeEncrypted;

  if (!maybeEncrypted.startsWith(ENCRYPTED_PREFIX)) {
    // a plain text, will be migrated on next save
    return maybeEncrypted;
  }

  const key = masterKey();
  if (!key) {
    console.warn(
      '[ApiKeyCrypto] Cannot decrypt key — safeStorage unavailable. ' +
        'Returning raw value.'
    );
    return maybeEncrypted;
  }

  try {
    const payload = maybeEncrypted.slice(ENCRYPTED_PREFIX.length);
    const parts = payload.split('.');
    if (parts.length !== 3) throw new Error('Invalid encrypted key format');

    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const cipherText = Buffer.from(parts[2], 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return (
      decipher.update(cipherText, undefined, 'utf-8') + decipher.final('utf-8')
    );
  } catch (err) {
    console.error('[ApiKeyCrypto] Failed to decrypt API key:', err);
    // Return the raw value so the user can re-enter their API key,
    // since master key was regenerated and key is unrecoverable.
    return maybeEncrypted;
  }
}

export function isEncrypted(value: string | undefined): boolean {
  return !!value && value.startsWith(ENCRYPTED_PREFIX);
}

export function decryptProviderConfig<T extends LLMProviderConfig>(
  config: T
): T {
  if (config.apiKey) {
    config.apiKey = decryptApiKey(config.apiKey);
  }
  return config;
}

export function encryptProviderConfig<T extends LLMProviderConfig>(
  config: T
): T {
  if (config.apiKey) {
    config.apiKey = encryptApiKey(config.apiKey);
  }
  return config;
}

export function encryptProviderConfigs<T extends LLMProviderConfig>(
  configs: T[]
): T[] {
  return configs.map((c) => {
    // shallow clone to avoid mutating objects the rest of the app holds
    const clone = { ...c };
    if (clone.apiKey) {
      clone.apiKey = encryptApiKey(clone.apiKey);
    }
    return clone;
  });
}

export function decryptProviderConfigs<T extends LLMProviderConfig>(
  configs: T[]
): T[] {
  for (const c of configs) {
    if (c.apiKey) {
      c.apiKey = decryptApiKey(c.apiKey);
    }
  }
  return configs;
}

export function hasPlainKeys(configs: LLMProviderConfig[]): boolean {
  return configs.some(
    (c) => c.apiKey && !c.apiKey.startsWith(ENCRYPTED_PREFIX)
  );
}
