import Store from 'electron-store'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { safeStorage } from 'electron'

const ENCRYPTION_KEY = scryptSync('ssh-terminal-secret-key', 'salt-value', 32)

function legacyEncrypt(text: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

function legacyDecrypt(text: string): string {
  const [ivHex, encryptedHex] = text.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}

function encrypt(text: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(text).toString('base64')
  }
  return 'legacy:' + legacyEncrypt(text)
}

function decrypt(text: string): string {
  if (text.startsWith('legacy:')) {
    return legacyDecrypt(text.slice(7))
  }
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(text, 'base64'))
    } catch {
      // If decryption fails, it might be an older legacy password
      try {
        return legacyDecrypt(text)
      } catch (err) {
        throw new Error('Failed to decrypt password: ' + (err as Error).message)
      }
    }
  }
  return legacyDecrypt(text)
}

export interface Server {
  id: string
  name: string
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  createdAt: number
}

interface StoreSchema {
  servers: Server[]
}

const store = new Store<StoreSchema>({
  defaults: { servers: [] }
})

export function getServers(): Server[] {
  return store.get('servers')
}

export function addServer(server: Omit<Server, 'id' | 'createdAt'>): Server {
  const servers = store.get('servers')
  const newServer: Server = {
    ...server,
    id: Date.now().toString(),
    createdAt: Date.now(),
    password: server.password ? encrypt(server.password) : undefined
  }
  store.set('servers', [...servers, newServer])
  return { ...newServer, password: server.password }
}

export function updateServer(id: string, updates: Partial<Omit<Server, 'id' | 'createdAt'>>): Server | null {
  const servers = store.get('servers')
  const index = servers.findIndex((s) => s.id === id)
  if (index === -1) return null

  const updated: Server = {
    ...servers[index],
    ...updates,
    password: updates.password ? encrypt(updates.password) : servers[index].password
  }
  servers[index] = updated
  store.set('servers', servers)
  return { ...updated, password: updates.password ?? getDecryptedPassword(servers[index]) }
}

export function deleteServer(id: string): boolean {
  const servers = store.get('servers')
  const filtered = servers.filter((s) => s.id !== id)
  if (filtered.length === servers.length) return false
  store.set('servers', filtered)
  return true
}

export function getDecryptedPassword(server: Server): string | undefined {
  if (!server.password) return undefined
  try {
    return decrypt(server.password)
  } catch {
    return server.password
  }
}

export function getServerWithPassword(id: string): Server | null {
  const servers = store.get('servers')
  const server = servers.find((s) => s.id === id)
  if (!server) return null
  return { ...server, password: getDecryptedPassword(server) }
}

export function clearServers(): void {
  store.set('servers', [])
}
