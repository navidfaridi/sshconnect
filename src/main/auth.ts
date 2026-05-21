import { shell, safeStorage } from 'electron'
import * as http from 'http'
import * as https from 'https'
import * as crypto from 'crypto'
import Store from 'electron-store'

// ─── Desktop OAuth credentials (injected at build time from .env) ─────────────
declare const __GOOGLE_CLIENT_ID__:     string
declare const __GOOGLE_CLIENT_SECRET__: string
const GOOGLE_CLIENT_ID     = __GOOGLE_CLIENT_ID__
const GOOGLE_CLIENT_SECRET = __GOOGLE_CLIENT_SECRET__

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

// ─── Secure local store ───────────────────────────────────────────────────────
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

// ─── HTTPS helpers ────────────────────────────────────────────────────────────
function httpsPost(url: string, body: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(body).toString()
    const u = new URL(url)
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(data)
        }
      },
      (res) => {
        let buf = ''
        res.on('data', (c) => (buf += c))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(buf)
            if ((res.statusCode ?? 0) >= 400)
              reject(new Error(parsed.error_description ?? parsed.error ?? `HTTP ${res.statusCode}`))
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

function httpsPostJson(url: string, body: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const u = new URL(url)
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      },
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

// ─── PKCE helpers ─────────────────────────────────────────────────────────────
function generatePKCE() {
  const verifier  = crypto.randomBytes(48).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

// ─── Local callback server ────────────────────────────────────────────────────
function startCallbackServer(): Promise<{
  port: number
  waitForCode: (state: string) => Promise<string>
}> {
  return new Promise((resolve, reject) => {
    const server = http.createServer()
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number }

      const waitForCode = (expectedState: string): Promise<string> =>
        new Promise((res, rej) => {
          const timer = setTimeout(() => {
            server.close()
            rej(new Error('Login timeout — please try again'))
          }, 120_000)

          server.once('request', (req, httpRes) => {
            clearTimeout(timer)
            const url    = new URL('http://localhost' + req.url)
            const code   = url.searchParams.get('code')
            const state  = url.searchParams.get('state')
            const errMsg = url.searchParams.get('error')

            httpRes.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            httpRes.end(`<!DOCTYPE html><html><head><meta charset="utf-8">
              <style>*{margin:0;padding:0}body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0d1117;color:#e6edf3}</style>
              </head><body><div style="text-align:center;padding:2rem">
              ${errMsg
                ? `<div style="font-size:2.5rem;margin-bottom:1rem">❌</div><h2>Login cancelled</h2><p style="color:#8b949e;margin-top:.5rem">You can close this tab.</p>`
                : `<div style="font-size:2.5rem;margin-bottom:1rem">✅</div><h2 style="margin-bottom:.5rem">Login successful!</h2><p style="color:#8b949e">You can close this tab and return to ConnectSSH.</p>`
              }
              </div></body></html>`)
            server.close()

            if (errMsg) return rej(new Error('Login cancelled by user'))
            if (state !== expectedState) return rej(new Error('Invalid state parameter'))
            if (!code) return rej(new Error('No authorization code received'))
            res(code)
          })
        })

      resolve({ port, waitForCode })
    })
    server.on('error', reject)
  })
}

// ─── Main sign-in flow ────────────────────────────────────────────────────────
export async function signInWithGoogle(firebaseApiKey: string): Promise<CloudUser> {
  const { verifier, challenge } = generatePKCE()
  const state = crypto.randomBytes(16).toString('hex')
  const { port, waitForCode } = await startCallbackServer()
  const redirectUri = `http://localhost:${port}`

  // 1 — Build Google OAuth2 URL (Desktop app → any localhost port accepted)
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id',             GOOGLE_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri',          redirectUri)
  authUrl.searchParams.set('response_type',         'code')
  authUrl.searchParams.set('scope',                 'openid email profile')
  authUrl.searchParams.set('code_challenge',        challenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('state',                 state)
  authUrl.searchParams.set('access_type',           'offline')
  authUrl.searchParams.set('prompt',                'select_account')

  // 2 — Open browser
  await shell.openExternal(authUrl.toString())

  // 3 — Wait for authorization code
  const code = await waitForCode(state)

  // 4 — Exchange code for Google tokens
  const tokens = await httpsPost('https://oauth2.googleapis.com/token', {
    code,
    client_id:     GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri:  redirectUri,
    grant_type:    'authorization_code',
    code_verifier: verifier
  })

  // 5 — Sign into Firebase with the Google ID token
  const firebaseResult = await httpsPostJson(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${firebaseApiKey}`,
    {
      postBody:           `id_token=${tokens.id_token}&providerId=google.com`,
      requestUri:         'http://localhost',
      returnSecureToken:  true,
      returnIdpCredential: true
    }
  )

  const user: CloudUser = {
    uid:          firebaseResult.localId,
    email:        firebaseResult.email,
    displayName:  firebaseResult.displayName ?? firebaseResult.email,
    photoUrl:     firebaseResult.photoUrl ?? '',
    idToken:      firebaseResult.idToken,
    refreshToken: firebaseResult.refreshToken,
    expiresAt:    Date.now() + Number(firebaseResult.expiresIn) * 1000
  }

  saveUser(user)
  return user
}

// ─── Token refresh ────────────────────────────────────────────────────────────
export async function getValidToken(apiKey: string): Promise<string | null> {
  const user = loadUser()
  if (!user) return null

  if (Date.now() < user.expiresAt - 60_000) return user.idToken

  try {
    const result = await httpsPost(
      `https://securetoken.googleapis.com/v1/token?key=${apiKey}`,
      { grant_type: 'refresh_token', refresh_token: user.refreshToken }
    )
    user.idToken      = result.id_token
    user.refreshToken = result.refresh_token
    user.expiresAt    = Date.now() + Number(result.expires_in) * 1000
    saveUser(user)
    return user.idToken
  } catch {
    clearUser()
    return null
  }
}
