import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import {
  getServers,
  addServer,
  updateServer,
  deleteServer,
  getServerWithPassword,
  clearServers,
  Server
} from './store'
import {
  connect,
  sendData,
  resizeTerminal,
  disconnect,
  listDirectory,
  uploadFile,
  downloadFile,
  deleteRemoteFile,
  createRemoteDirectory
} from './ssh-manager'
import { signInWithGoogle, loadUser, clearUser, getValidToken } from './auth'
import { fetchServers, uploadServer, deleteServer as cloudDelete, syncAll } from './cloud-sync'
import { FIREBASE_CONFIG } from './firebase-config'

const { apiKey, projectId } = FIREBASE_CONFIG

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0d1117',
    icon: join(__dirname, '../../resources/icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#161b22',
      symbolColor: '#8b949e',
      height: 36
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
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

  // ─── Server IPC ────────────────────────────────────────────────
  ipcMain.handle('server:list', () => getServers().map((s) => ({ ...s, password: undefined })))

  ipcMain.handle('server:add', (_, server: Omit<Server, 'id' | 'createdAt'>) => {
    const added = addServer(server)
    return { ...added, password: undefined }
  })

  ipcMain.handle('server:update', (_, id: string, updates: Partial<Server>) => {
    const updated = updateServer(id, updates)
    return updated ? { ...updated, password: undefined } : null
  })

  ipcMain.handle('server:delete', (_, id: string) => deleteServer(id))

  ipcMain.handle('server:clear-all', () => clearServers())

  // ─── SSH IPC ────────────────────────────────────────────────────
  ipcMain.handle('ssh:connect', async (_, connectionId: string, serverId: string) => {
    const server = getServerWithPassword(serverId)
    if (!server) throw new Error('Server not found')

    await connect(
      connectionId,
      {
        host: server.host,
        port: server.port,
        username: server.username,
        password: server.password,
        readyTimeout: 10000,
        keepaliveInterval: 10000
      },
      win
    )
  })

  ipcMain.handle('ssh:send', (_, connectionId: string, data: string) =>
    sendData(connectionId, data)
  )

  ipcMain.handle('ssh:resize', (_, connectionId: string, cols: number, rows: number) =>
    resizeTerminal(connectionId, cols, rows)
  )

  ipcMain.handle('ssh:disconnect', (_, connectionId: string) => disconnect(connectionId))

  // ─── SFTP IPC ───────────────────────────────────────────────────
  ipcMain.handle('sftp:list', (_, connectionId: string, remotePath: string) =>
    listDirectory(connectionId, remotePath)
  )

  ipcMain.handle('sftp:upload', async (_, connectionId: string, remotePath: string) => {
    const result = await dialog.showOpenDialog(win, {
      title: 'Select file to upload',
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled || result.filePaths.length === 0) return { canceled: true }

    for (const localPath of result.filePaths) {
      await uploadFile(connectionId, localPath, remotePath + '/' + localPath.split(/[\\/]/).pop(), win)
    }
    return { success: true }
  })

  ipcMain.handle('sftp:download', async (_, connectionId: string, remotePath: string) => {
    const result = await dialog.showOpenDialog(win, {
      title: 'Select download destination',
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return { canceled: true }

    await downloadFile(connectionId, remotePath, result.filePaths[0], win)
    shell.showItemInFolder(result.filePaths[0])
    return { success: true }
  })

  ipcMain.handle('sftp:delete', (_, connectionId: string, remotePath: string, isDir: boolean) =>
    deleteRemoteFile(connectionId, remotePath, isDir)
  )

  ipcMain.handle('sftp:mkdir', (_, connectionId: string, remotePath: string) =>
    createRemoteDirectory(connectionId, remotePath)
  )

  // ─── Auth IPC ───────────────────────────────────────────────────
  ipcMain.handle('auth:current-user', () => {
    const u = loadUser()
    return u ? { uid: u.uid, email: u.email, displayName: u.displayName, photoUrl: u.photoUrl } : null
  })

  ipcMain.handle('auth:sign-in', async () => {
    const user = await signInWithGoogle(apiKey)
    return { uid: user.uid, email: user.email, displayName: user.displayName, photoUrl: user.photoUrl }
  })

  ipcMain.handle('auth:sign-out', () => clearUser())

  // ─── Cloud Sync IPC ─────────────────────────────────────────────
  ipcMain.handle('sync:download', async () => {
    const user = loadUser()
    if (!user) throw new Error('Not signed in')
    const cloudServers = await fetchServers(apiKey, projectId, user.uid)
    return cloudServers
  })

  ipcMain.handle('sync:upload-all', async () => {
    const user = loadUser()
    if (!user) throw new Error('Not signed in')
    const servers = getServers()
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
