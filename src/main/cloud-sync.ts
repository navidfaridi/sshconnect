import * as https from 'https'
import { getValidToken } from './auth'
import { Server } from './store'

const BASE = 'https://firestore.googleapis.com/v1'

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function request(method: string, url: string, body?: object, token?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined
    const u = new URL(url)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    if (data) headers['Content-Length'] = String(Buffer.byteLength(data))

    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method, headers },
      (res) => {
        let buf = ''
        res.on('data', (c) => (buf += c))
        res.on('end', () => {
          if (res.statusCode === 204 || !buf) return resolve({})
          try {
            const parsed = JSON.parse(buf)
            if ((res.statusCode ?? 0) >= 400)
              reject(new Error(parsed.error?.message ?? `HTTP ${res.statusCode}`))
            else resolve(parsed)
          } catch {
            resolve({})
          }
        })
      }
    )
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

// ─── Firestore document converters ───────────────────────────────────────────

function toDoc(s: Server) {
  return {
    fields: {
      name:      { stringValue:  s.name },
      host:      { stringValue:  s.host },
      port:      { integerValue: String(s.port) },
      username:  { stringValue:  s.username },
      password:  { stringValue:  s.password ?? '' },
      createdAt: { integerValue: String(s.createdAt) }
    }
  }
}

function fromDoc(doc: any, id: string): Server {
  const f = doc.fields ?? {}
  return {
    id,
    name:      f.name?.stringValue      ?? '',
    host:      f.host?.stringValue      ?? '',
    port:      Number(f.port?.integerValue ?? 22),
    username:  f.username?.stringValue  ?? '',
    password:  f.password?.stringValue  || undefined,
    createdAt: Number(f.createdAt?.integerValue ?? Date.now())
  }
}

function col(projectId: string, uid: string) {
  return `${BASE}/projects/${projectId}/databases/(default)/documents/users/${uid}/servers`
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function uploadServer(apiKey: string, projectId: string, uid: string, server: Server) {
  const token = await getValidToken(apiKey)
  if (!token) throw new Error('Not signed in')

  const fields = Object.keys(toDoc(server).fields)
    .map((f) => `updateMask.fieldPaths=${f}`)
    .join('&')

  await request('PATCH', `${col(projectId, uid)}/${server.id}?${fields}`, toDoc(server), token)
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
  return res.documents.map((doc: any) => {
    const id = doc.name.split('/').pop()
    return fromDoc(doc, id)
  })
}

export async function syncAll(apiKey: string, projectId: string, uid: string, servers: Server[]) {
  await Promise.all(servers.map((s) => uploadServer(apiKey, projectId, uid, s)))
}
