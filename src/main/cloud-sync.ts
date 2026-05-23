/**
 * Cloud Sync — Firestore REST API
 *
 * Encryption priority:
 *   1. If master key loaded → AES-256-GCM (Feature 1)
 *   2. Otherwise → AES-256-CBC with UID-derived key (legacy fallback)
 */

import * as https from 'https'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { getValidToken } from './auth'
import { getMasterKey, encryptGCM, decryptGCM } from './master-key'
import { Server } from './store'

const BASE = 'https://firestore.googleapis.com/v1'
const CLOUD_SALT = 'connectssh-firestore-v1' // keep stable — changing breaks existing data

// ─── Fallback: UID-derived AES-256-CBC ────────────────────────────────────────

function deriveCloudKey(uid: string): Buffer {
  return scryptSync(uid + CLOUD_SALT, 'connectssh-kdf', 32)
}

function cbcEncrypt(text: string, uid: string): string {
  const key = deriveCloudKey(uid)
  const iv  = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  return 'enc:' + iv.toString('hex') + ':' + Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString('hex')
}

function cbcDecrypt(text: string, uid: string): string {
  try {
    if (!text.startsWith('enc:')) return text
    const [, ivHex, encHex] = text.split(':')
    const key = deriveCloudKey(uid)
    const decipher = createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'))
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8')
  } catch { return text }
}

// ─── Encryption dispatcher ────────────────────────────────────────────────────

function cloudEncrypt(text: string, uid: string): string {
  const mk = getMasterKey()
  if (mk) return encryptGCM(text, mk)      // Feature 1: AES-256-GCM
  return cbcEncrypt(text, uid)              // Fallback: AES-256-CBC
}

function cloudDecrypt(text: string, uid: string): string {
  if (!text) return text
  if (text.startsWith('gcm:')) {
    const mk = getMasterKey()
    if (!mk) return text  // can't decrypt without master key
    try { return decryptGCM(text, mk) } catch { return text }
  }
  return cbcDecrypt(text, uid)
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function request(method: string, url: string, body?: object, token?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined
    const u = new URL(url)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    if (data)  headers['Content-Length'] = String(Buffer.byteLength(data))
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

// ─── Firestore document converters ───────────────────────────────────────────

function toDoc(s: Server, uid: string) {
  return {
    fields: {
      name:      { stringValue: s.name },
      host:      { stringValue: cloudEncrypt(s.host,     uid) },
      port:      { integerValue: String(s.port) },
      username:  { stringValue: cloudEncrypt(s.username, uid) },
      password:  { stringValue: s.password ? cloudEncrypt(s.password, uid) : '' },
      sshKeyId:  { stringValue: s.sshKeyId ?? '' },
      createdAt: { integerValue: String(s.createdAt) }
    }
  }
}

function fromDoc(doc: any, id: string, uid: string): Server {
  const f = doc.fields ?? {}
  const rawPwd = f.password?.stringValue || undefined
  return {
    id,
    name:      f.name?.stringValue ?? '',
    host:      cloudDecrypt(f.host?.stringValue ?? '', uid),
    port:      Number(f.port?.integerValue ?? 22),
    username:  cloudDecrypt(f.username?.stringValue ?? '', uid),
    password:  rawPwd ? cloudDecrypt(rawPwd, uid) : undefined,
    sshKeyId:  f.sshKeyId?.stringValue || undefined,
    createdAt: Number(f.createdAt?.integerValue ?? Date.now())
  }
}

function col(projectId: string, uid: string) {
  return `${BASE}/projects/${projectId}/databases/(default)/documents/users/${uid}/servers`
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function uploadServer(apiKey: string, projectId: string, uid: string, server: Server) {
  const token  = await getValidToken(apiKey)
  if (!token) throw new Error('Not signed in')
  const doc    = toDoc(server, uid)
  const fields = Object.keys(doc.fields).map((f) => `updateMask.fieldPaths=${f}`).join('&')
  await request('PATCH', `${col(projectId, uid)}/${server.id}?${fields}`, doc, token)
}

export async function deleteServer(apiKey: string, projectId: string, uid: string, serverId: string) {
  const token = await getValidToken(apiKey)
  if (!token) throw new Error('Not signed in')
  await request('DELETE', `${col(projectId, uid)}/${serverId}`, undefined, token)
}

export async function fetchServers(apiKey: string, projectId: string, uid: string): Promise<Server[]> {
  const token = await getValidToken(apiKey)
  if (!token) throw new Error('Not signed in')
  const res = await request('GET', col(projectId, uid), undefined, token)
  if (!res.documents) return []
  return res.documents.map((doc: any) => fromDoc(doc, doc.name.split('/').pop(), uid))
}

export async function syncAll(apiKey: string, projectId: string, uid: string, servers: Server[]) {
  await Promise.all(servers.map((s) => uploadServer(apiKey, projectId, uid, s)))
}
