import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import {
  getServers, addServer, updateServer, deleteServer,
  getServerWithPassword, getDecryptedPassword, clearServers, Server
} from './store'
import {
  connect, sendData, resizeTerminal, disconnect, getClient,
  listDirectory, uploadFile, downloadFile, deleteRemoteFile,
  createRemoteDirectory, readRemoteFile, writeRemoteFile
} from './ssh-manager'
import { signInWithGoogle, loadUser, clearUser, getValidToken } from './auth'
import { fetchServers, uploadServer, deleteServer as cloudDelete, syncAll } from './cloud-sync'
import { FIREBASE_CONFIG } from './firebase-config'
import { startMonitoring, stopMonitoring } from './monitor'
import { listKeys, generateKey, importKey, getPrivateKey, deleteKey } from './key-store'
import {
  deriveMasterKey, setMasterKey, getMasterKey, clearMasterKey,
  isMasterKeyLoaded, buildVerificationToken, verifyToken,
  saveMasterToken, fetchMasterToken
} from './master-key'

const { apiKey, projectId } = FIREBASE_CONFIG

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    backgroundColor: '#0d1117',
    icon: join(__dirname, '../../resources/icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#161b22', symbolColor: '#8b949e', height: 36 },
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

app.whenReady().then(() => {
  const win = createWindow()

  // ─── Server IPC ────────────────────────────────────────────────────────────
  ipcMain.handle('server:list', () => getServers().map((s) => ({ ...s, password: undefined })))

  ipcMain.handle('server:add', (_, server: Omit<Server, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => {
    const added = addServer(server)
    return { ...added, password: undefined }
  })

  ipcMain.handle('server:update', (_, id: string, updates: Partial<Server>) => {
    const updated = updateServer(id, updates)
    return updated ? { ...updated, password: undefined } : null
  })

  ipcMain.handle('server:delete',    (_, id: string)  => deleteServer(id))
  ipcMain.handle('server:clear-all', ()               => clearServers())

  // ─── SSH IPC ───────────────────────────────────────────────────────────────
  ipcMain.handle('ssh:connect', async (_, connectionId: string, serverId: string) => {
    const server = getServerWithPassword(serverId)
    if (!server) throw new Error('Server not found')

    const connectConfig: any = {
      host: server.host, port: server.port,
      username: server.username,
      readyTimeout: 10000, keepaliveInterval: 10000
    }

    // Feature 2: prefer SSH key over password
    if (server.sshKeyId) {
      const privKey = getPrivateKey(server.sshKeyId)
      if (privKey) connectConfig.privateKey = privKey
      else if (server.password) connectConfig.password = server.password
    } else if (server.password) {
      connectConfig.password = server.password
    }

    await connect(connectionId, connectConfig, win)
  })

  ipcMain.handle('ssh:send',       (_, id, data)       => sendData(id, data))
  ipcMain.handle('ssh:resize',     (_, id, cols, rows)  => resizeTerminal(id, cols, rows))
  ipcMain.handle('ssh:disconnect', (_, id)              => disconnect(id))

  // ─── SFTP IPC ──────────────────────────────────────────────────────────────
  ipcMain.handle('sftp:list', (_, id, remotePath) => listDirectory(id, remotePath))

  ipcMain.handle('sftp:upload', async (_, id, remotePath) => {
    const result = await dialog.showOpenDialog(win, {
      title: 'Select file to upload', properties: ['openFile', 'multiSelections']
    })
    if (result.canceled || result.filePaths.length === 0) return { canceled: true }
    for (const lp of result.filePaths)
      await uploadFile(id, lp, remotePath + '/' + lp.split(/[\\/]/).pop(), win)
    return { success: true }
  })

  ipcMain.handle('sftp:download', async (_, id, remotePath) => {
    const result = await dialog.showOpenDialog(win, {
      title: 'Select download destination', properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return { canceled: true }
    await downloadFile(id, remotePath, result.filePaths[0], win)
    shell.showItemInFolder(result.filePaths[0])
    return { success: true }
  })

  ipcMain.handle('sftp:delete', (_, id, rp, isDir) => deleteRemoteFile(id, rp, isDir))
  ipcMain.handle('sftp:mkdir',  (_, id, rp)         => createRemoteDirectory(id, rp))

  // Feature 4: read/write file
  ipcMain.handle('sftp:read-file',  (_, id, rp)           => readRemoteFile(id, rp))
  ipcMain.handle('sftp:write-file', (_, id, rp, content)  => writeRemoteFile(id, rp, content))

  // ─── Auth IPC ──────────────────────────────────────────────────────────────
  ipcMain.handle('auth:current-user', () => {
    const u = loadUser()
    return u ? { uid: u.uid, email: u.email, displayName: u.displayName, photoUrl: u.photoUrl } : null
  })

  ipcMain.handle('auth:sign-in', async () => {
    const user = await signInWithGoogle(apiKey)
    return { uid: user.uid, email: user.email, displayName: user.displayName, photoUrl: user.photoUrl }
  })

  ipcMain.handle('auth:sign-out', () => {
    clearMasterKey()
    clearUser()
  })

  // ─── Cloud Sync IPC ────────────────────────────────────────────────────────
  ipcMain.handle('sync:download', async () => {
    const user = loadUser()
    if (!user) throw new Error('Not signed in')
    return fetchServers(apiKey, projectId, user.uid)
  })

  ipcMain.handle('sync:upload-all', async () => {
    const user = loadUser()
    if (!user) throw new Error('Not signed in')
    const servers = getServers().map((s) => ({ ...s, password: getDecryptedPassword(s) }))
    await syncAll(apiKey, projectId, user.uid, servers)
  })

  ipcMain.handle('sync:upload-server', async (_, serverId: string) => {
    const user = loadUser()
    if (!user) return
    const server = getServerWithPassword(serverId)
    if (server) await uploadServer(apiKey, projectId, user.uid, server)
  })

  ipcMain.handle('sync:delete-server', async (_, serverId: string) => {
    const user = loadUser()
    if (!user) return
    await cloudDelete(apiKey, projectId, user.uid, serverId)
  })

  // ─── Feature 5: Monitoring IPC ────────────────────────────────────────────
  ipcMain.handle('monitor:start', (_, connectionId: string) => {
    const client = getClient(connectionId)
    if (client) startMonitoring(connectionId, client, win)
  })

  ipcMain.handle('monitor:stop', (_, connectionId: string) => {
    stopMonitoring(connectionId)
  })

  // ─── Feature 2: SSH Keys IPC ───────────────────────────────────────────────
  ipcMain.handle('keys:list',     ()                          => listKeys())
  ipcMain.handle('keys:generate', (_, name, type)            => generateKey(name, type))
  ipcMain.handle('keys:import',   (_, name, privateKeyPem)   => importKey(name, privateKeyPem))
  ipcMain.handle('keys:delete',   (_, id)                    => deleteKey(id))

  // ─── Feature 1: Master Password IPC ───────────────────────────────────────
  ipcMain.handle('master:status', async () => {
    if (isMasterKeyLoaded()) return 'unlocked'
    const user = loadUser()
    if (!user) return 'none'
    const token = await fetchMasterToken(apiKey, projectId, user.uid)
    return token ? 'locked' : 'none'
  })

  ipcMain.handle('master:setup', async (_, password: string) => {
    const user = loadUser()
    if (!user) throw new Error('Not signed in')
    const key   = deriveMasterKey(password, user.uid)
    const token = buildVerificationToken(key)
    await saveMasterToken(apiKey, projectId, user.uid, token)
    setMasterKey(key)
  })

  ipcMain.handle('master:unlock', async (_, password: string) => {
    const user = loadUser()
    if (!user) throw new Error('Not signed in')
    const token = await fetchMasterToken(apiKey, projectId, user.uid)
    if (!token) return false
    const key = deriveMasterKey(password, user.uid)
    if (!verifyToken(token, key)) return false
    setMasterKey(key)
    return true
  })

  ipcMain.handle('master:lock',       () => clearMasterKey())
  ipcMain.handle('master:is-enabled', () => isMasterKeyLoaded())

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
