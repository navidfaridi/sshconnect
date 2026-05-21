import { shell, safeStorage } from 'electron'
import * as http from 'http'
import * as https from 'https'
import Store from 'electron-store'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CloudUser {
  uid: string
  email: string
  displayName: string
  photoUrl: string
  idToken: string
  refreshToken: string
  expiresAt: number
}

// ─── Secure token store ───────────────────────────────────────────────────────

const authStore = new Store<{ token: string }>({ name: 'auth-token' })

function saveUser(user: CloudUser) {
  const json = JSON.stringify(user)
  const value = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(json).toString('base64')
    : json
  authStore.set('token', value)
}

export function loadUser(): CloudUser | null {
  const stored = authStore.get('token') as string | undefined
  if (!stored) return null
  try {
    const json = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(Buffer.from(stored, 'base64'))
      : stored
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function clearUser() {
  authStore.delete('token')
}

// ─── HTTPS helper ─────────────────────────────────────────────────────────────

function post(url: string, body: object, token?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const u = new URL(url)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(data))
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'POST', headers },
      (res) => {
        let buf = ''
        res.on('data', (c) => (buf += c))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(buf)
            if ((res.statusCode ?? 0) >= 400)
              reject(new Error(parsed.error?.message ?? `HTTP ${res.statusCode}`))
            else resolve(parsed)
          } catch {
            reject(new Error('Invalid response'))
          }
        })
      }
    )
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

// ─── Local callback server ────────────────────────────────────────────────────

function startCallbackServer(): Promise<{ port: number; waitForCode: () => Promise<string> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer()
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number }

      const waitForCode = (): Promise<string> =>
        new Promise((res, rej) => {
          const timer = setTimeout(() => {
            server.close()
            rej(new Error('Login timeout — please try again'))
          }, 120_000)

          server.once('request', (req, httpRes) => {
            clearTimeout(timer)
            httpRes.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            httpRes.end(`<!DOCTYPE html><html><head><meta charset="utf-8">
              <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0d1117;color:#e6edf3}</style>
              </head><body><div style="text-align:center;padding:2rem">
              <div style="font-size:3rem;margin-bottom:1rem">✅</div>
              <h2 style="margin-bottom:.5rem">Login successful</h2>
              <p style="color:#8b949e">You can close this tab and return to ConnectSSH.</p>
              </div></body></html>`)
            server.close()
            res('http://localhost:' + port + (req.url ?? ''))
          })
        })

      resolve({ port, waitForCode })
    })
    server.on('error', reject)
  })
}

// ─── Google Sign-In ───────────────────────────────────────────────────────────

export async function signInWithGoogle(apiKey: string): Promise<CloudUser> {
  const { port, waitForCode } = await startCallbackServer()
  const continueUri = `http://localhost:${port}`

  // 1 — Ask Firebase to build the Google OAuth URL
  const { authUri, sessionId } = await post(
    `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`,
    { providerId: 'google.com', continueUri }
  )

  // 2 — Open the browser
  await shell.openExternal(authUri)

  // 3 — Wait for the redirect to our local server
  const callbackUrl = await waitForCode()

  // 4 — Exchange the callback URL for a Firebase token
  const result = await post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${apiKey}`,
    { requestUri: callbackUrl, sessionId, returnSecureToken: true, returnIdpCredential: true }
  )

  const user: CloudUser = {
    uid: result.localId,
    email: result.email,
    displayName: result.displayName ?? result.email,
    photoUrl: result.photoUrl ?? '',
    idToken: result.idToken,
    refreshToken: result.refreshToken,
    expiresAt: Date.now() + Number(result.expiresIn) * 1000
  }

  saveUser(user)
  return user
}

// ─── Token refresh ────────────────────────────────────────────────────────────

export async function getValidToken(apiKey: string): Promise<string | null> {
  const user = loadUser()
  if (!user) return null

  // Still valid (with 1-min buffer)
  if (Date.now() < user.expiresAt - 60_000) return user.idToken

  try {
    const result = await post(
      `https://securetoken.googleapis.com/v1/token?key=${apiKey}`,
      { grant_type: 'refresh_token', refresh_token: user.refreshToken }
    )
    user.idToken = result.id_token
    user.refreshToken = result.refresh_token
    user.expiresAt = Date.now() + Number(result.expires_in) * 1000
    saveUser(user)
    return user.idToken
  } catch {
    clearUser()
    return null
  }
}
