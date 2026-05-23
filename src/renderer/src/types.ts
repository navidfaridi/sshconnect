export interface CloudUser {
  uid: string
  email: string
  displayName: string
  photoUrl: string
}

export interface Server {
  id: string
  name: string
  host: string
  port: number
  username: string
  password?: string
  sshKeyId?: string          // Feature 2: SSH Key auth
  createdAt: number
}

export interface Tab {
  id: string                 // primary connectionId
  serverId: string
  serverName: string
  host: string
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  showTerminal: boolean
  showFiles: boolean
  splitPercent: number
  splitOrientation: 'horizontal' | 'vertical'  // Feature 3
  currentPath: string
  metrics?: MonitorMetrics   // Feature 5
  // Feature 3: second terminal in same pane
  secondConnectionId?: string
  secondStatus?: 'connecting' | 'connected' | 'disconnected' | 'error'
}

export interface FileEntry {
  filename: string
  longname: string
  isDirectory: boolean
  size: number
  modifyTime: number
  permissions: number
}

// ─── Feature 5: Server Monitoring ────────────────────────────────────────────
export interface MonitorMetrics {
  cpu: number         // 0–100 %
  ram: number         // 0–100 %
  disk: number        // 0–100 %
  ramUsed: string     // e.g. "3.2 GB"
  ramTotal: string    // e.g. "8.0 GB"
  diskUsed: string    // e.g. "45 GB"
  diskTotal: string   // e.g. "100 GB"
}

// ─── Feature 2: SSH Keys ─────────────────────────────────────────────────────
export interface SshKey {
  id: string
  name: string
  type: 'ed25519' | 'rsa'
  publicKey: string   // OpenSSH format (for authorized_keys)
  createdAt: number
}

// ─── Feature 1: Master Password status ───────────────────────────────────────
export type MasterPasswordStatus = 'none' | 'locked' | 'unlocked'

declare global {
  interface Window {
    api: {
      auth: {
        currentUser: () => Promise<CloudUser | null>
        signIn: () => Promise<CloudUser>
        signOut: () => Promise<void>
      }
      sync: {
        download: () => Promise<Server[]>
        uploadAll: () => Promise<void>
        uploadServer: (id: string) => Promise<void>
        deleteServer: (id: string) => Promise<void>
      }
      server: {
        list: () => Promise<Server[]>
        add: (server: Omit<Server, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => Promise<Server>
        update: (id: string, updates: Partial<Server>) => Promise<Server | null>
        delete: (id: string) => Promise<boolean>
        clearAll: () => Promise<void>
      }
      ssh: {
        connect: (connectionId: string, serverId: string) => Promise<void>
        send: (connectionId: string, data: string) => Promise<boolean>
        resize: (connectionId: string, cols: number, rows: number) => Promise<void>
        disconnect: (connectionId: string) => Promise<void>
        onData: (callback: (connectionId: string, data: string) => void) => () => void
        onClosed: (callback: (connectionId: string) => void) => () => void
      }
      sftp: {
        list: (connectionId: string, remotePath: string) => Promise<FileEntry[]>
        upload: (connectionId: string, remotePath: string) => Promise<{ canceled?: boolean; success?: boolean }>
        download: (connectionId: string, remotePath: string) => Promise<{ canceled?: boolean; success?: boolean }>
        delete: (connectionId: string, remotePath: string, isDir: boolean) => Promise<void>
        mkdir: (connectionId: string, remotePath: string) => Promise<void>
        readFile: (connectionId: string, remotePath: string) => Promise<string>
        writeFile: (connectionId: string, remotePath: string, content: string) => Promise<void>
        onProgress: (callback: (connectionId: string, file: string, progress: number) => void) => () => void
      }
      // Feature 5: Monitoring
      monitor: {
        start: (connectionId: string) => Promise<void>
        stop: (connectionId: string) => Promise<void>
        onMetrics: (callback: (connectionId: string, metrics: MonitorMetrics) => void) => () => void
      }
      // Feature 2: SSH Keys
      keys: {
        list: () => Promise<SshKey[]>
        generate: (name: string, type: 'ed25519' | 'rsa') => Promise<SshKey>
        import: (name: string, privateKeyPem: string) => Promise<SshKey>
        delete: (id: string) => Promise<void>
      }
      // Feature 1: Master Password
      master: {
        status: () => Promise<MasterPasswordStatus>
        setup: (password: string) => Promise<void>
        unlock: (password: string) => Promise<boolean>
        lock: () => Promise<void>
        isEnabled: () => Promise<boolean>
      }
    }
  }
}
