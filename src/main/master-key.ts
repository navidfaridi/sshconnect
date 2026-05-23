/**
 * Feature 1 — End-to-End Encryption with Master Password
 *
 * - Key derivation: PBKDF2-SHA512 (600k iterations)
 * - Encryption: AES-256-GCM (authenticated, no tampering possible)
 * - Master password NEVER stored on disk — only derived key kept in memory
 */

import { pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from 'crypto'
import * as https from 'https'
import { getValidToken } from './auth'

// ─── In-memory master key (cleared on logout) ─────────────────────────────────
let masterKey: Buffer | null = null

const PBKDF2_ITERATIONS = 600_000
const PBKDF2_KEYLEN     = 32
const KDF_SALT_SUFFIX   = 'sshconnect-master-v1'
const VERIFICATION_TEXT = 'sshconnect:verified:v1'

// ─── Key derivation ───────────────────────────────────────────────────────────

export function deriveMasterKey(password: string, uid: string): Buffer {
  // Salt = uid + static suffix — same password + same uid → same key (cross-device)
  const salt = Buffer.from(uid + KDF_SALT_SUFFIX, 'utf8')
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, 'sha512')
}

// ─── AES-256-GCM helpers ──────────────────────────────────────────────────────

export function encryptGCM(plainText: string, key: Buffer): string {
  const iv      = randomBytes(12) // 96-bit IV recommended for GCM
  const cipher  = createCipheriv('aes-256-gcm', key, iv)
  const enc     = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const tag     = cipher.getAuthTag()
  return `gcm:${iv.toString('hex')}:${enc.toString('hex')}:${tag.toString('hex')}`
}

export function decryptGCM(encoded: string, key: Buffer): string {
  if (!encoded.startsWith('gcm:')) throw new Error('Not a GCM-encrypted value')
  const parts = encoded.split(':')
  if (parts.length !== 4) throw new Error('Malformed GCM payload')
  const iv  = Buffer.from(parts[1], 'hex')
  const enc = Buffer.from(parts[2], 'hex')
  const tag = Buffer.from(parts[3], 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

// ─── Session management ───────────────────────────────────────────────────────

export function setMasterKey(key: Buffer): void { masterKey = key }
export function getMasterKey(): Buffer | null    { return masterKey }
export function clearMasterKey(): void           { masterKey = null }
export function isMasterKeyLoaded(): boolean     { return masterKey !== null }

// ─── Verification token (stored in Firestore) ─────────────────────────────────

export function buildVerificationToken(key: Buffer): string {
  return encryptGCM(VERIFICATION_TEXT, key)
}

export function verifyToken(token: string, key: Buffer): boolean {
  try {
    return decryptGCM(token, key) === VERIFICATION_TEXT
  } catch {
    return false
  }
}

// ─── Firestore: store / fetch verification token ─────────────────────────────

const BASE = 'https://firestore.googleapis.com/v1'

function fsRequest(method: string, url: string, body?: object, token?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined
    const u = new URL(url)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    if (data) headers['Content-Length'] = String(Buffer.byteLength(data))
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers }, (res) => {
      let buf = ''
      res.on('data', (c) => (buf += c))
      res.on('end', () => {
        if (res.statusCode === 204 || !buf) return resolve({})
        try {
          const parsed = JSON.parse(buf)
          if ((res.statusCode ?? 0) >= 400) reject(new Error(parsed.error?.message ?? `HTTP ${res.statusCode}`))
          else resolve(parsed)
        } catch { resolve({}) }
      })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

export async function saveMasterToken(
  apiKey: string, projectId: string, uid: string, token: string
): Promise<void> {
  const fbToken = await getValidToken(apiKey)
  if (!fbToken) throw new Error('Not signed in')
  const url = `${BASE}/projects/${projectId}/databases/(default)/documents/users/${uid}/settings/masterKey`
  await fsRequest('PATCH', `${url}?updateMask.fieldPaths=verificationToken`, {
    fields: { verificationToken: { stringValue: token } }
  }, fbToken)
}

export async function fetchMasterToken(
  apiKey: string, projectId: string, uid: string
): Promise<string | null> {
  const fbToken = await getValidToken(apiKey)
  if (!fbToken) return null
  try {
    const url = `${BASE}/projects/${projectId}/databases/(default)/documents/users/${uid}/settings/masterKey`
    const res = await fsRequest('GET', url, undefined, fbToken)
    return res.fields?.verificationToken?.stringValue ?? null
  } catch {
    return null
  }
}
