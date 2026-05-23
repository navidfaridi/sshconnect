import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // ─── Auth ─────────────────────────────────────────────────────────────────
  auth: {
    currentUser: () => ipcRenderer.invoke('auth:current-user'),
    signIn:      () => ipcRenderer.invoke('auth:sign-in'),
    signOut:     () => ipcRenderer.invoke('auth:sign-out')
  },

  // ─── Sync ─────────────────────────────────────────────────────────────────
  sync: {
    download:     ()          => ipcRenderer.invoke('sync:download'),
    uploadAll:    ()          => ipcRenderer.invoke('sync:upload-all'),
    uploadServer: (id)        => ipcRenderer.invoke('sync:upload-server', id),
    deleteServer: (id)        => ipcRenderer.invoke('sync:delete-server', id)
  },

  // ─── Servers ──────────────────────────────────────────────────────────────
  server: {
    list:     ()                 => ipcRenderer.invoke('server:list'),
    add:      (server)           => ipcRenderer.invoke('server:add', server),
    update:   (id, updates)      => ipcRenderer.invoke('server:update', id, updates),
    delete:   (id)               => ipcRenderer.invoke('server:delete', id),
    clearAll: ()                 => ipcRenderer.invoke('server:clear-all')
  },

  // ─── SSH ──────────────────────────────────────────────────────────────────
  ssh: {
    connect:    (connectionId, serverId) => ipcRenderer.invoke('ssh:connect', connectionId, serverId),
    send:       (connectionId, data)     => ipcRenderer.invoke('ssh:send', connectionId, data),
    resize:     (connectionId, c, r)     => ipcRenderer.invoke('ssh:resize', connectionId, c, r),
    disconnect: (connectionId)           => ipcRenderer.invoke('ssh:disconnect', connectionId),
    onData: (callback) => {
      const listener = (_: any, id: string, data: string) => callback(id, data)
      ipcRenderer.on('ssh:data', listener)
      return () => ipcRenderer.removeListener('ssh:data', listener)
    },
    onClosed: (callback) => {
      const listener = (_: any, id: string) => callback(id)
      ipcRenderer.on('ssh:closed', listener)
      return () => ipcRenderer.removeListener('ssh:closed', listener)
    }
  },

  // ─── SFTP ─────────────────────────────────────────────────────────────────
  sftp: {
    list:      (id, rp)          => ipcRenderer.invoke('sftp:list', id, rp),
    upload:    (id, rp)          => ipcRenderer.invoke('sftp:upload', id, rp),
    download:  (id, rp)          => ipcRenderer.invoke('sftp:download', id, rp),
    delete:    (id, rp, isDir)   => ipcRenderer.invoke('sftp:delete', id, rp, isDir),
    mkdir:     (id, rp)          => ipcRenderer.invoke('sftp:mkdir', id, rp),
    readFile:  (id, rp)          => ipcRenderer.invoke('sftp:read-file', id, rp),
    writeFile: (id, rp, content) => ipcRenderer.invoke('sftp:write-file', id, rp, content),
    onProgress: (callback) => {
      const listener = (_: any, id: string, file: string, pct: number) => callback(id, file, pct)
      ipcRenderer.on('sftp:progress', listener)
      return () => ipcRenderer.removeListener('sftp:progress', listener)
    }
  },

  // ─── Feature 5: Monitor ───────────────────────────────────────────────────
  monitor: {
    start: (id) => ipcRenderer.invoke('monitor:start', id),
    stop:  (id) => ipcRenderer.invoke('monitor:stop', id),
    onMetrics: (callback) => {
      const listener = (_: any, id: string, metrics: any) => callback(id, metrics)
      ipcRenderer.on('ssh:monitor', listener)
      return () => ipcRenderer.removeListener('ssh:monitor', listener)
    }
  },

  // ─── Feature 2: SSH Keys ──────────────────────────────────────────────────
  keys: {
    list:     ()                    => ipcRenderer.invoke('keys:list'),
    generate: (name, type)          => ipcRenderer.invoke('keys:generate', name, type),
    import:   (name, pem)           => ipcRenderer.invoke('keys:import', name, pem),
    delete:   (id)                  => ipcRenderer.invoke('keys:delete', id)
  },

  // ─── Feature 1: Master Password ───────────────────────────────────────────
  master: {
    status:    () => ipcRenderer.invoke('master:status'),
    setup:     (password) => ipcRenderer.invoke('master:setup', password),
    unlock:    (password) => ipcRenderer.invoke('master:unlock', password),
    lock:      ()         => ipcRenderer.invoke('master:lock'),
    isEnabled: ()         => ipcRenderer.invoke('master:is-enabled')
  }
})
