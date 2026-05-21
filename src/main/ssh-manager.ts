import { Client, ConnectConfig, ClientChannel, SFTPWrapper } from 'ssh2'
import { BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

export interface SshConnection {
  id: string
  client: Client
  stream?: ClientChannel
  sftp?: SFTPWrapper
}

const connections = new Map<string, SshConnection>()

export function connect(
  connectionId: string,
  config: ConnectConfig,
  win: BrowserWindow
): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = new Client()
    let isReady = false

    const cleanup = () => {
      if (connections.has(connectionId)) {
        connections.delete(connectionId)
        if (!win.isDestroyed()) {
          win.webContents.send('ssh:closed', connectionId)
        }
      }
    }

    client.on('ready', () => {
      isReady = true
      client.shell({ term: 'xterm-256color', cols: 220, rows: 50 }, (err, stream) => {
        if (err) {
          reject(err)
          return
        }

        connections.set(connectionId, { id: connectionId, client, stream })

        stream.on('data', (data: Buffer) => {
          if (!win.isDestroyed()) {
            win.webContents.send('ssh:data', connectionId, data.toString())
          }
        })

        stream.stderr.on('data', (data: Buffer) => {
          if (!win.isDestroyed()) {
            win.webContents.send('ssh:data', connectionId, data.toString())
          }
        })

        stream.on('close', () => {
          cleanup()
        })

        resolve()
      })
    })

    client.on('close', cleanup)
    client.on('end', cleanup)
    client.on('error', (err) => {
      cleanup()
      if (!isReady) {
        reject(err)
      }
    })

    client.connect(config)
  })
}

export function sendData(connectionId: string, data: string): boolean {
  const conn = connections.get(connectionId)
  if (!conn?.stream) return false
  conn.stream.write(data)
  return true
}

export function resizeTerminal(connectionId: string, cols: number, rows: number): void {
  const conn = connections.get(connectionId)
  conn?.stream?.setWindow(rows, cols, 0, 0)
}

export function disconnect(connectionId: string): void {
  const conn = connections.get(connectionId)
  if (conn) {
    conn.client.end()
    connections.delete(connectionId)
  }
}

export function getSftp(connectionId: string): Promise<SFTPWrapper> {
  return new Promise((resolve, reject) => {
    const conn = connections.get(connectionId)
    if (!conn) return reject(new Error('Connection not found'))
    if (conn.sftp) return resolve(conn.sftp)

    conn.client.sftp((err, sftp) => {
      if (err) return reject(err)
      conn.sftp = sftp
      resolve(sftp)
    })
  })
}

export interface FileEntry {
  filename: string
  longname: string
  isDirectory: boolean
  size: number
  modifyTime: number
  permissions: number
}

export async function listDirectory(connectionId: string, remotePath: string): Promise<FileEntry[]> {
  const sftp = await getSftp(connectionId)
  return new Promise((resolve, reject) => {
    sftp.readdir(remotePath, (err, list) => {
      if (err) return reject(err)
      const entries: FileEntry[] = list.map((item) => ({
        filename: item.filename,
        longname: item.longname,
        isDirectory: (item.attrs.mode! & 0o170000) === 0o040000,
        size: item.attrs.size ?? 0,
        modifyTime: (item.attrs.mtime ?? 0) * 1000,
        permissions: item.attrs.mode ?? 0
      }))
      resolve(entries)
    })
  })
}

export async function uploadFile(
  connectionId: string,
  localPath: string,
  remotePath: string,
  win: BrowserWindow
): Promise<void> {
  const sftp = await getSftp(connectionId)
  const fileSize = fs.statSync(localPath).size
  let transferred = 0

  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(localPath)
    const writeStream = sftp.createWriteStream(remotePath)

    readStream.on('data', (chunk: Buffer) => {
      transferred += chunk.length
      const progress = Math.round((transferred / fileSize) * 100)
      if (!win.isDestroyed()) {
        win.webContents.send('sftp:progress', connectionId, localPath, progress)
      }
    })

    writeStream.on('close', resolve)
    writeStream.on('error', reject)
    readStream.pipe(writeStream)
  })
}

export async function downloadFile(
  connectionId: string,
  remotePath: string,
  localPath: string,
  win: BrowserWindow
): Promise<void> {
  const sftp = await getSftp(connectionId)

  return new Promise((resolve, reject) => {
    sftp.stat(remotePath, (err, stats) => {
      if (err) return reject(err)
      const fileSize = stats.size
      let transferred = 0
      const filename = path.basename(remotePath)
      const destPath = path.join(localPath, filename)

      const readStream = sftp.createReadStream(remotePath)
      const writeStream = fs.createWriteStream(destPath)

      readStream.on('data', (chunk: Buffer) => {
        transferred += chunk.length
        const progress = Math.round((transferred / fileSize) * 100)
        if (!win.isDestroyed()) {
          win.webContents.send('sftp:progress', connectionId, remotePath, progress)
        }
      })

      writeStream.on('close', resolve)
      writeStream.on('error', reject)
      readStream.pipe(writeStream)
    })
  })
}

export async function deleteRemoteFile(connectionId: string, remotePath: string, isDirectory: boolean): Promise<void> {
  const sftp = await getSftp(connectionId)
  return new Promise((resolve, reject) => {
    if (isDirectory) {
      sftp.rmdir(remotePath, (err) => (err ? reject(err) : resolve()))
    } else {
      sftp.unlink(remotePath, (err) => (err ? reject(err) : resolve()))
    }
  })
}

export async function createRemoteDirectory(connectionId: string, remotePath: string): Promise<void> {
  const sftp = await getSftp(connectionId)
  return new Promise((resolve, reject) => {
    sftp.mkdir(remotePath, (err) => (err ? reject(err) : resolve()))
  })
}
