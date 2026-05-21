import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // ─── Auth ─────────────────────────────────────────────────────
  auth: {
    currentUser: () => ipcRenderer.invoke('auth:current-user'),
    signIn: () => ipcRenderer.invoke('auth:sign-in'),
    signOut: () => ipcRenderer.invoke('auth:sign-out')
  },

  // ─── Sync ─────────────────────────────────────────────────────
  sync: {
    download: () => ipcRenderer.invoke('sync:download'),
    uploadAll: () => ipcRenderer.invoke('sync:upload-all'),
    uploadServer: (id: string) => ipcRenderer.invoke('sync:upload-server', id),
    deleteServer: (id: string) => ipcRenderer.invoke('sync:delete-server', id)
  },

  // ─── Servers ─────────────────────────────────────────────────
  server: {
    list: () => ipcRenderer.invoke('server:list'),
    add: (server: object) => ipcRenderer.invoke('server:add', server),
    update: (id: string, updates: object) => ipcRenderer.invoke('server:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('server:delete', id),
    clearAll: () => ipcRenderer.invoke('server:clear-all')
  },

  // ─── SSH ──────────────────────────────────────────────────────
  ssh: {
    connect: (connectionId: string, serverId: string) =>
      ipcRenderer.invoke('ssh:connect', connectionId, serverId),
    send: (connectionId: string, data: string) => ipcRenderer.invoke('ssh:send', connectionId, data),
    resize: (connectionId: string, cols: number, rows: number) =>
      ipcRenderer.invoke('ssh:resize', connectionId, cols, rows),
    disconnect: (connectionId: string) => ipcRenderer.invoke('ssh:disconnect', connectionId),
    onData: (callback: (connectionId: string, data: string) => void) => {
      const listener = (_event: any, id: string, data: string) => callback(id, data)
      ipcRenderer.on('ssh:data', listener)
      return () => {
        ipcRenderer.removeListener('ssh:data', listener)
      }
    },
    onClosed: (callback: (connectionId: string) => void) => {
      const listener = (_event: any, id: string) => callback(id)
      ipcRenderer.on('ssh:closed', listener)
      return () => {
        ipcRenderer.removeListener('ssh:closed', listener)
      }
    }
  },

  // ─── SFTP ─────────────────────────────────────────────────────
  sftp: {
    list: (connectionId: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:list', connectionId, remotePath),
    upload: (connectionId: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:upload', connectionId, remotePath),
    download: (connectionId: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:download', connectionId, remotePath),
    delete: (connectionId: string, remotePath: string, isDir: boolean) =>
      ipcRenderer.invoke('sftp:delete', connectionId, remotePath, isDir),
    mkdir: (connectionId: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:mkdir', connectionId, remotePath),
    onProgress: (callback: (connectionId: string, file: string, progress: number) => void) => {
      const listener = (_event: any, id: string, file: string, progress: number) => callback(id, file, progress)
      ipcRenderer.on('sftp:progress', listener)
      return () => {
        ipcRenderer.removeListener('sftp:progress', listener)
      }
    }
  }
})
