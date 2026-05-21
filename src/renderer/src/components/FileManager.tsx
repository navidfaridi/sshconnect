import React, { useState, useEffect, useCallback } from 'react'
import { FileEntry, Tab } from '../types'

interface Props {
  tab: Tab
  onPathChange: (path: string) => void
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function FileManager({ tab, onPathChange }: Props) {
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<{ file: string; pct: number } | null>(null)
  const [newDirName, setNewDirName] = useState('')
  const [showNewDir, setShowNewDir] = useState(false)

  const load = useCallback(
    async (path: string) => {
      setLoading(true)
      setError(null)
      setSelected(new Set())
      try {
        const list = await window.api.sftp.list(tab.id, path)
        const sorted = [...list].sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
          return a.filename.localeCompare(b.filename)
        })
        setEntries(sorted)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    },
    [tab.id]
  )

  useEffect(() => {
    if (tab.status === 'connected') load(tab.currentPath)
  }, [tab.currentPath, tab.status, load])

  useEffect(() => {
    const unsubscribeProgress = window.api.sftp.onProgress((connectionId, file, pct) => {
      if (connectionId === tab.id) {
        setProgress({ file: file.split(/[\\/]/).pop() ?? file, pct })
        if (pct >= 100) setTimeout(() => setProgress(null), 1500)
      }
    })
    return () => {
      unsubscribeProgress()
    }
  }, [tab.id])

  function navigate(entry: FileEntry) {
    if (!entry.isDirectory) return
    const newPath = tab.currentPath.endsWith('/')
      ? tab.currentPath + entry.filename
      : tab.currentPath + '/' + entry.filename
    onPathChange(newPath)
  }

  function goUp() {
    const parts = tab.currentPath.split('/').filter(Boolean)
    parts.pop()
    onPathChange('/' + parts.join('/') || '/')
  }

  async function handleUpload() {
    try {
      const res = await window.api.sftp.upload(tab.id, tab.currentPath)
      if (res && res.success) {
        load(tab.currentPath)
      }
    } catch (e: any) {
      alert(`Upload failed: ${e.message}`)
    }
  }

  async function handleDownload() {
    try {
      for (const name of selected) {
        const entry = entries.find((e) => e.filename === name)
        if (entry && !entry.isDirectory) {
          const remotePath = tab.currentPath + '/' + name
          await window.api.sftp.download(tab.id, remotePath)
        }
      }
    } catch (e: any) {
      alert(`Download failed: ${e.message}`)
    }
  }

  async function handleDelete() {
    try {
      for (const name of selected) {
        const entry = entries.find((e) => e.filename === name)
        if (entry) {
          await window.api.sftp.delete(tab.id, tab.currentPath + '/' + name, entry.isDirectory)
        }
      }
      load(tab.currentPath)
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`)
    }
  }

  async function handleMkdir() {
    if (!newDirName.trim()) return
    try {
      await window.api.sftp.mkdir(tab.id, tab.currentPath + '/' + newDirName.trim())
      setNewDirName('')
      setShowNewDir(false)
      load(tab.currentPath)
    } catch (e: any) {
      alert(`Create folder failed: ${e.message}`)
    }
  }

  if (tab.status !== 'connected') {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600">
        Not connected
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-dark-900 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-dark-600 bg-dark-800">
        <button
          onClick={goUp}
          disabled={tab.currentPath === '/'}
          className="p-1.5 rounded hover:bg-dark-600 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          title="Go up"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
        <button
          onClick={() => load(tab.currentPath)}
          className="p-1.5 rounded hover:bg-dark-600 text-gray-400 hover:text-white transition-colors"
          title="Refresh"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        <div className="flex-1 bg-dark-700 border border-dark-600 rounded px-3 py-1 text-sm text-gray-300 font-mono">
          {tab.currentPath}
        </div>

        <button
          onClick={handleUpload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent-600 hover:bg-accent-500 text-white text-sm transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload
        </button>

        {selected.size > 0 && (
          <>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-dark-700 hover:bg-dark-600 text-white text-sm border border-dark-500 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-900/40 hover:bg-red-800/60 text-red-400 text-sm border border-red-800/50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </>
        )}

        <button
          onClick={() => setShowNewDir(true)}
          className="p-1.5 rounded hover:bg-dark-600 text-gray-400 hover:text-white transition-colors"
          title="New folder"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
        </button>
      </div>

      {/* New folder input */}
      {showNewDir && (
        <div className="flex items-center gap-2 px-4 py-2 bg-dark-700 border-b border-dark-600">
          <input
            autoFocus
            type="text"
            placeholder="New folder name"
            value={newDirName}
            onChange={(e) => setNewDirName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleMkdir(); if (e.key === 'Escape') setShowNewDir(false) }}
            className="flex-1 bg-dark-800 border border-dark-500 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent-500"
          />
          <button onClick={handleMkdir} className="px-3 py-1.5 bg-accent-600 hover:bg-accent-500 text-white text-sm rounded transition-colors">Create</button>
          <button onClick={() => setShowNewDir(false)} className="px-3 py-1.5 bg-dark-600 hover:bg-dark-500 text-gray-300 text-sm rounded transition-colors">Cancel</button>
        </div>
      )}

      {/* Progress bar */}
      {progress && (
        <div className="px-4 py-2 bg-dark-700 border-b border-dark-600">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>{progress.file}</span>
            <span>{progress.pct}%</span>
          </div>
          <div className="h-1 bg-dark-600 rounded-full overflow-hidden">
            <div className="h-full bg-accent-500 transition-all duration-200" style={{ width: progress.pct + '%' }} />
          </div>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Loading...</div>
        )}
        {error && (
          <div className="flex items-center justify-center h-32 text-red-400 text-sm">{error}</div>
        )}
        {!loading && !error && (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-dark-800 border-b border-dark-600">
              <tr className="text-xs text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-right px-4 py-2 font-medium w-24">Size</th>
                <th className="text-right px-4 py-2 font-medium w-44">Modified</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.filename}
                  onClick={() => {
                    const next = new Set(selected)
                    next.has(entry.filename) ? next.delete(entry.filename) : next.add(entry.filename)
                    setSelected(next)
                  }}
                  onDoubleClick={() => navigate(entry)}
                  className={`border-b border-dark-700/50 cursor-pointer transition-colors ${
                    selected.has(entry.filename)
                      ? 'bg-accent-600/20'
                      : 'hover:bg-dark-700'
                  }`}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {entry.isDirectory ? (
                        <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                      <span className={entry.filename.startsWith('.') ? 'text-gray-500' : 'text-gray-200'}>
                        {entry.filename}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-500 font-mono text-xs">
                    {entry.isDirectory ? '-' : formatSize(entry.size)}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600 text-xs">
                    {formatDate(entry.modifyTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="px-4 py-1.5 border-t border-dark-600 bg-dark-800 text-xs text-gray-600">
        {entries.length} items{selected.size > 0 && ` · ${selected.size} selected`}
      </div>
    </div>
  )
}
