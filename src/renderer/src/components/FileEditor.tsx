import React, { useState, useEffect, useRef, useCallback } from 'react'
import Editor from '@monaco-editor/react'

interface Props {
  connectionId: string
  remotePath: string
  onClose: () => void
}

// Map file extension → Monaco language
function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    js: 'javascript',  jsx: 'javascript', ts: 'typescript',   tsx: 'typescript',
    py: 'python',      go: 'go',          rs: 'rust',          rb: 'ruby',
    java: 'java',      php: 'php',        cpp: 'cpp',          c: 'c',
    sh: 'shell',       bash: 'shell',     zsh: 'shell',        fish: 'shell',
    json: 'json',      yaml: 'yaml',      yml: 'yaml',         toml: 'ini',
    conf: 'ini',       nginx: 'nginx',    xml: 'xml',          html: 'html',
    css: 'css',        scss: 'scss',      md: 'markdown',      sql: 'sql',
    env: 'shell',      txt: 'plaintext',  log: 'plaintext',    dockerfile: 'dockerfile',
    ini: 'ini',        cfg: 'ini',
  }
  return map[ext] ?? 'plaintext'
}

export default function FileEditor({ connectionId, remotePath, onClose }: Props) {
  const filename = remotePath.split('/').pop() ?? remotePath
  const language = getLanguage(filename)

  const [content, setContent]   = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [isDirty, setIsDirty]   = useState(false)
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const editorRef               = useRef<any>(null)

  // Load file content
  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api.sftp.readFile(connectionId, remotePath)
      .then((text) => { setContent(text); setIsDirty(false) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [connectionId, remotePath])

  // Show toast
  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // Save file
  const save = useCallback(async () => {
    const current = editorRef.current?.getValue()
    if (current === undefined) return
    setSaving(true)
    try {
      await window.api.sftp.writeFile(connectionId, remotePath, current)
      setIsDirty(false)
      setContent(current)
      showToast(`Saved ${filename}`, true)
    } catch (e: any) {
      showToast(`Save failed: ${e.message}`, false)
    } finally {
      setSaving(false)
    }
  }, [connectionId, remotePath, filename])

  // Ctrl+S / Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save])

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#0d1117]">

      {/* Title bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[#161b22] border-b border-[#30363d] flex-shrink-0">
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-white text-sm font-medium truncate">{filename}</span>
          {isDirty && <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" title="Unsaved changes" />}
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#21262d] text-gray-500 uppercase tracking-wider flex-shrink-0">
            {language}
          </span>
        </div>

        <span className="text-xs text-gray-600 font-mono truncate max-w-[300px]">{remotePath}</span>

        <div className="flex items-center gap-2 ml-2">
          <button
            onClick={save}
            disabled={!isDirty || saving}
            title="Save (Ctrl+S)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent-600 hover:bg-accent-500
              disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
          >
            {saving
              ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
            }
            Save
          </button>
          <button
            onClick={() => {
              if (isDirty && !confirm('You have unsaved changes. Close anyway?')) return
              onClose()
            }}
            className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-[#21262d] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117] z-10">
            <div className="flex flex-col items-center gap-3 text-gray-500">
              <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Loading {filename}...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117] z-10">
            <div className="text-center">
              <p className="text-red-400 text-sm mb-3">{error}</p>
              <button onClick={onClose} className="px-4 py-2 bg-[#21262d] rounded text-white text-sm hover:bg-[#30363d]">
                Close
              </button>
            </div>
          </div>
        )}

        {!loading && !error && content !== null && (
          <Editor
            height="100%"
            language={language}
            value={content}
            theme="vs-dark"
            onMount={(editor) => { editorRef.current = editor; editor.focus() }}
            onChange={() => setIsDirty(true)}
            options={{
              fontSize: 13,
              fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              renderWhitespace: 'boundary',
              wordWrap: 'off',
              tabSize: 2,
              automaticLayout: true,
              padding: { top: 8 }
            }}
          />
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg
          text-sm font-medium transition-all ${toast.ok
            ? 'bg-emerald-900/90 border border-emerald-700/50 text-emerald-300'
            : 'bg-red-900/90 border border-red-700/50 text-red-300'}`}>
          {toast.ok
            ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          }
          {toast.msg}
        </div>
      )}
    </div>
  )
}
