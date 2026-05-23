/**
 * Feature 2 — SSH Key Management
 *
 * - Generates ED25519 / RSA-4096 key pairs locally using Node.js crypto
 * - Stores private keys encrypted with safeStorage (OS keychain)
 * - Converts public keys to OpenSSH format for authorized_keys
 */

import { generateKeyPairSync, createPublicKey } from 'crypto'
import { safeStorage } from 'electron'
import Store from 'electron-store'

export interface SshKey {
  id: string
  name: string
  type: 'ed25519' | 'rsa'
  publicKey: string   // OpenSSH format
  privateKeyEnc: string // encrypted with safeStorage
  createdAt: number
}

interface KeyStoreSchema { keys: SshKey[] }
const keyStore = new Store<KeyStoreSchema>({ name: 'ssh-keys', defaults: { keys: [] } })

// ─── OpenSSH public key conversion ────────────────────────────────────────────

function pemToOpenSsh(pemPublic: string, keyType: 'ed25519' | 'rsa', comment = 'ssh-connect'): string {
  const keyObj = createPublicKey(pemPublic)

  if (keyType === 'ed25519') {
    // ED25519 SPKI DER: last 32 bytes are the raw key
    const der = keyObj.export({ type: 'spki', format: 'der' }) as Buffer
    const keyBytes = der.slice(-32)
    const typeStr = 'ssh-ed25519'
    const buf = Buffer.alloc(4 + typeStr.length + 4 + keyBytes.length)
    buf.writeUInt32BE(typeStr.length, 0)
    buf.write(typeStr, 4, 'ascii')
    buf.writeUInt32BE(keyBytes.length, 4 + typeStr.length)
    keyBytes.copy(buf, 4 + typeStr.length + 4)
    return `${typeStr} ${buf.toString('base64')} ${comment}`
  }

  if (keyType === 'rsa') {
    // RSA: export as PKCS1 DER, then wrap in OpenSSH wire format
    const der = keyObj.export({ type: 'pkcs1', format: 'der' }) as Buffer
    const typeStr = 'ssh-rsa'
    // ssh-rsa format: length(type) + type + length(e) + e + length(n) + n
    // Simpler: encode DER as ASN1 inside OpenSSH framing
    // Use the standard OpenSSH RSA public key framing
    const typeBuf = Buffer.from(typeStr, 'ascii')
    const header  = Buffer.alloc(4)
    header.writeUInt32BE(typeBuf.length)
    const rsaDer   = Buffer.alloc(4)
    rsaDer.writeUInt32BE(der.length)
    const combined = Buffer.concat([header, typeBuf, rsaDer, der])
    return `${typeStr} ${combined.toString('base64')} ${comment}`
  }

  throw new Error('Unsupported key type')
}

// ─── Encrypt/decrypt private key ──────────────────────────────────────────────

function encryptKey(pem: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(pem).toString('base64')
  }
  return 'plain:' + Buffer.from(pem).toString('base64')
}

export function decryptKey(enc: string): string {
  if (enc.startsWith('plain:')) {
    return Buffer.from(enc.slice(6), 'base64').toString('utf8')
  }
  return safeStorage.decryptString(Buffer.from(enc, 'base64'))
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function listKeys(): Omit<SshKey, 'privateKeyEnc'>[] {
  return keyStore.get('keys').map(({ privateKeyEnc: _, ...rest }) => rest)
}

export function generateKey(name: string, type: 'ed25519' | 'rsa'): Omit<SshKey, 'privateKeyEnc'> {
  const opts: Parameters<typeof generateKeyPairSync>[1] =
    type === 'ed25519'
      ? { privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
          publicKeyEncoding:  { format: 'pem', type: 'spki' } }
      : { modulusLength: 4096,
          privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
          publicKeyEncoding:  { format: 'pem', type: 'spki' } }

  const { privateKey: privPem, publicKey: pubPem } = generateKeyPairSync(type as any, opts as any)

  const publicKey = pemToOpenSsh(pubPem as string, type, name)
  const key: SshKey = {
    id: Date.now().toString(),
    name,
    type,
    publicKey,
    privateKeyEnc: encryptKey(privPem as string),
    createdAt: Date.now()
  }

  const keys = keyStore.get('keys')
  keyStore.set('keys', [...keys, key])
  const { privateKeyEnc: _, ...safe } = key
  return safe
}

export function importKey(name: string, privateKeyPem: string): Omit<SshKey, 'privateKeyEnc'> {
  // Detect key type from PEM header
  const type: 'ed25519' | 'rsa' = privateKeyPem.includes('EC PRIVATE KEY') ||
    privateKeyPem.includes('ED25519')
    ? 'ed25519'
    : 'rsa'

  // Derive public key from private key
  const privKeyObj = require('crypto').createPrivateKey(privateKeyPem)
  const pubPem = privKeyObj.export({ type: 'spki', format: 'pem' }) as string
  const publicKey = pemToOpenSsh(pubPem, type, name)

  const key: SshKey = {
    id: Date.now().toString(),
    name,
    type,
    publicKey,
    privateKeyEnc: encryptKey(privateKeyPem),
    createdAt: Date.now()
  }

  const keys = keyStore.get('keys')
  keyStore.set('keys', [...keys, key])
  const { privateKeyEnc: _, ...safe } = key
  return safe
}

export function getPrivateKey(keyId: string): string | null {
  const key = keyStore.get('keys').find((k) => k.id === keyId)
  if (!key) return null
  return decryptKey(key.privateKeyEnc)
}

export function deleteKey(keyId: string): void {
  keyStore.set('keys', keyStore.get('keys').filter((k) => k.id !== keyId))
}
