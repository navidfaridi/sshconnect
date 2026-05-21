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
  createdAt: number
}

export interface Tab {
  id: string
  serverId: string
  serverName: string
  host: string
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  showTerminal: boolean
  showFiles: boolean
  splitPercent: number   // width % of terminal pane (10–90)
  currentPath: string
}

export interface FileEntry {
  filename: string
  longname: string
  isDirectory: boolean
  size: number
  modifyTime: number
  permissions: number
}

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
        add: (server: Omit<Server, 'id' | 'createdAt'>) => Promise<Server>
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
        onProgress: (callback: (connectionId: string, file: string, progress: number) => void) => () => void
      }
    }
  }
}
