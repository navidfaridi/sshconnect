/**
 * Feature 5 — Real-time Server Monitoring
 *
 * Spawns a background exec channel per connection.
 * Reads /proc/stat, /proc/meminfo, df — lightweight, no top dependency.
 * Calculates CPU delta between two consecutive readings.
 */

import { Client } from 'ssh2'
import { BrowserWindow } from 'electron'

export interface MonitorMetrics {
  cpu: number; ram: number; disk: number
  ramUsed: string; ramTotal: string
  diskUsed: string; diskTotal: string
}

interface CpuSnapshot { total: number; idle: number }

// Active monitor intervals and CPU snapshots
const intervals   = new Map<string, ReturnType<typeof setInterval>>()
const cpuSnapshot = new Map<string, CpuSnapshot>()

// The monitoring command — single lightweight read
const MON_CMD = [
  "echo '===CPU'",
  "cat /proc/stat | head -1",
  "echo '===MEM'",
  "awk '/MemTotal|MemAvailable/{print $1,$2}' /proc/meminfo",
  "echo '===DISK'",
  "df / --output=size,used,avail 2>/dev/null | tail -1 || df / | tail -1"
].join('; ')

// ─── Metric parsing ───────────────────────────────────────────────────────────

function parseCpu(line: string, connId: string): number {
  // "cpu  u n s id iow irq sirq steal ..."
  const nums = line.trim().replace(/^cpu\s+/, '').split(/\s+/).map(Number)
  const idle  = nums[3] + (nums[4] || 0) // idle + iowait
  const total = nums.reduce((a, b) => a + b, 0)

  const prev = cpuSnapshot.get(connId)
  cpuSnapshot.set(connId, { total, idle })

  if (!prev || prev.total === total) return 0
  const deltaTotal = total - prev.total
  const deltaIdle  = idle  - prev.idle
  return Math.max(0, Math.min(100, Math.round((1 - deltaIdle / deltaTotal) * 100)))
}

function fmtBytes(kb: number): string {
  if (kb >= 1024 * 1024) return (kb / 1024 / 1024).toFixed(1) + ' GB'
  if (kb >= 1024)        return (kb / 1024).toFixed(0) + ' MB'
  return kb + ' KB'
}

function parseOutput(raw: string, connId: string): MonitorMetrics | null {
  try {
    const sections: Record<string, string> = {}
    let current = ''
    for (const line of raw.split('\n')) {
      const t = line.trim()
      if (t.startsWith('===')) { current = t.slice(3); sections[current] = '' }
      else if (current)        { sections[current] += t + '\n' }
    }

    // CPU
    const cpuLine = (sections['CPU'] || '').trim()
    const cpu = cpuLine.startsWith('cpu') ? parseCpu(cpuLine, connId) : 0

    // RAM
    const memLines = (sections['MEM'] || '').trim().split('\n')
    let memTotal = 0, memAvail = 0
    for (const l of memLines) {
      const [k, v] = l.split(/\s+/)
      if (k === 'MemTotal:')     memTotal = parseInt(v)
      if (k === 'MemAvailable:') memAvail = parseInt(v)
    }
    const memUsed = memTotal - memAvail
    const ram = memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 0

    // DISK
    const diskLine = (sections['DISK'] || '').trim().split('\n').pop() ?? ''
    const diskParts = diskLine.trim().split(/\s+/).filter(Boolean)
    // df --output=size,used,avail → 3 columns in 1K blocks
    const dTotal = parseInt(diskParts[0]) || 0
    const dUsed  = parseInt(diskParts[1]) || 0
    const disk   = dTotal > 0 ? Math.round((dUsed / dTotal) * 100) : 0

    return {
      cpu, ram, disk,
      ramUsed:   fmtBytes(memUsed),
      ramTotal:  fmtBytes(memTotal),
      diskUsed:  fmtBytes(dUsed),
      diskTotal: fmtBytes(dTotal)
    }
  } catch { return null }
}

// ─── Exec helper ─────────────────────────────────────────────────────────────

function execOnce(client: Client, cmd: string): Promise<string> {
  return new Promise((resolve) => {
    client.exec(cmd, (err, stream) => {
      if (err) return resolve('')
      let out = ''
      stream.on('data', (d: Buffer) => (out += d.toString()))
      stream.stderr.on('data', () => {}) // ignore stderr
      stream.on('close', () => resolve(out))
    })
  })
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function startMonitoring(
  connectionId: string,
  client: Client,
  win: BrowserWindow
): void {
  stopMonitoring(connectionId)

  const tick = async () => {
    if (!client.writable) { stopMonitoring(connectionId); return }
    try {
      const raw     = await execOnce(client, MON_CMD)
      const metrics = parseOutput(raw, connectionId)
      if (metrics && !win.isDestroyed()) {
        win.webContents.send('ssh:monitor', connectionId, metrics)
      }
    } catch { /* ignore — non-critical */ }
  }

  tick() // immediate first reading
  intervals.set(connectionId, setInterval(tick, 6000))
}

export function stopMonitoring(connectionId: string): void {
  const id = intervals.get(connectionId)
  if (id) { clearInterval(id); intervals.delete(connectionId) }
  cpuSnapshot.delete(connectionId)
}
