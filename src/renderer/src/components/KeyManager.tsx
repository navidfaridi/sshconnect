import React, { useState, useEffect } from 'react'
import { SshKey } from '../types'

interface Props { onClose: () => void }

export default function KeyManager({ onClose }: Props) {
  const [keys, setKeys]           = useState<SshKey[]>([])
  const [loading, setLoading]     = useState(false)
  const [genName, setGenName]     = useState('')
  const [genType, setGenType]     = useState<'ed25519' | 'rsa'>('ed25519')
  const [importing, setImporting] = useState(false)
  const [importName, setImportName] = useState('')
  const [importPem, setImportPem]   = useState('')
  const [copied, setCopied]       = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)

  const reload = async () => setKeys(await window.api.keys.list())

  useEffect(() => { reload() }, [])

  async function handleGenerate() {
    if (!genName.trim()) { setError('Enter a key name'); return }
    setLoading(true); setError(null)
    try {
      await window.api.keys.generate(genName.trim(), genType)
      setGenName('')
      await reload()
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleImport() {
    if (!importName.trim() || !importPem.trim()) { setError('Name and PEM key are required'); return }
    setLoading(true); setError(null)
    try {
      await window.api.keys.import(importName.trim(), importPem.trim())
      setImportName(''); setImportPem(''); setImporting(false)
      await reload()
    } catch (e: any) { setError('Invalid PEM key: ' + e.message) }
    finally { setLoading(false) }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete key "${name}"? Servers using this key will need a password to connect.`)) return
    await window.api.keys.delete(id)
    await reload()
  }

  async function copyPublicKey(key: SshKey) {
    await navigator.clipboard.writeText(key.publicKey)
    setCopied(key.id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl w-[600px] max-h-[85vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-600/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h2 className="text-white font-semibold">SSH Key Manager</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1 rounded hover:bg-[#21262d] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Generate new key */}
          <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Generate New Key Pair</h3>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Key name (e.g. My Laptop)"
                value={genName}
                onChange={(e) => setGenName(e.target.value)}
                className="flex-1 bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-white text-sm
                  placeholder-gray-600 focus:outline-none focus:border-accent-500"
              />
              <select
                value={genType}
                onChange={(e) => setGenType(e.target.value as any)}
                className="bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent-500"
              >
                <option value="ed25519">ED25519 (recommended)</option>
                <option value="rsa">RSA 4096</option>
              </select>
              <button
                onClick={handleGenerate}
                disabled={loading || !genName.trim()}
                className="px-4 py-2 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors whitespace-nowrap"
              >
                {loading ? 'Generating…' : 'Generate'}
              </button>
            </div>
            <p className="text-xs text-gray-600">
              ED25519 is faster and more secure. RSA 4096 for maximum compatibility.
            </p>
          </div>

          {/* Import existing key */}
          <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 space-y-3">
            <button
              onClick={() => setImporting(!importing)}
              className="flex items-center gap-2 text-sm font-semibold text-white w-full text-left"
            >
              <svg className={`w-3.5 h-3.5 text-gray-500 transition-transform ${importing ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Import Existing Private Key
            </button>
            {importing && (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Key name"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-white text-sm
                    placeholder-gray-600 focus:outline-none focus:border-accent-500"
                />
                <textarea
                  placeholder={'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'}
                  value={importPem}
                  onChange={(e) => setImportPem(e.target.value)}
                  rows={6}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-white text-xs
                    font-mono placeholder-gray-700 focus:outline-none focus:border-accent-500 resize-none"
                />
                <button
                  onClick={handleImport}
                  disabled={loading || !importName.trim() || !importPem.trim()}
                  className="w-full py-2 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                >
                  Import Key
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2.5 text-sm text-red-400">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Key list */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Stored Keys ({keys.length})
            </h3>
            {keys.length === 0 && (
              <p className="text-sm text-gray-600 py-4 text-center">No SSH keys yet. Generate or import one above.</p>
            )}
            {keys.map((key) => (
              <div key={key.id}
                className="flex items-center gap-3 bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                  ${key.type === 'ed25519' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-blue-900/30 text-blue-400'}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{key.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase
                      ${key.type === 'ed25519' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-blue-900/30 text-blue-400'}`}>
                      {key.type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 font-mono truncate mt-0.5">
                    {key.publicKey.slice(0, 60)}…
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => copyPublicKey(key)}
                    title="Copy public key to clipboard"
                    className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-[#21262d] transition-colors"
                  >
                    {copied === key.id
                      ? <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    }
                  </button>
                  <button
                    onClick={() => handleDelete(key.id, key.name)}
                    title="Delete key"
                    className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
