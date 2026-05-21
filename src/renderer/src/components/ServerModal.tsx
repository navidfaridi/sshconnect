import React, { useState, useEffect } from 'react'
import { Server } from '../types'

interface Props {
  server?: Server | null
  onSave: (server: Omit<Server, 'id' | 'createdAt'>) => void
  onClose: () => void
}

export default function ServerModal({ server, onSave, onClose }: Props) {
  const [form, setForm] = useState({ name: '', host: '', port: '22', username: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (server) {
      setForm({ name: server.name, host: server.host, port: String(server.port), username: server.username, password: '' })
    } else {
      setForm({ name: '', host: '', port: '22', username: '', password: '' })
    }
    setShowPassword(false)
  }, [server])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      name: form.name.trim() || form.host,
      host: form.host.trim(),
      port: parseInt(form.port) || 22,
      username: form.username.trim(),
      password: form.password || undefined
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-dark-800 border border-dark-600 rounded-xl w-[480px] shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-600">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-600/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
            <h2 className="text-white font-semibold text-base">
              {server ? 'Edit Server' : 'New Server'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-dark-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Label */}
          <Field label="Label">
            <input
              type="text"
              placeholder="My Server"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={input}
            />
          </Field>

          {/* Host + Port */}
          <div className="flex gap-3">
            <Field label="Hostname / IP" className="flex-1">
              <input
                type="text"
                placeholder="192.168.1.1"
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                required
                className={input}
              />
            </Field>
            <Field label="Port" className="w-24">
              <input
                type="number"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: e.target.value })}
                className={input}
              />
            </Field>
          </div>

          {/* Username */}
          <Field label="Username">
            <input
              type="text"
              placeholder="root"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              className={input}
            />
          </Field>

          {/* Password */}
          <Field label="Password">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={server ? 'Leave blank to keep current' : 'Password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={input + ' pr-10'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </Field>

          {/* Info row in edit mode */}
          {server && (
            <div className="rounded-lg bg-dark-700 border border-dark-600 px-4 py-3 text-xs text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>Connection string</span>
                <span className="text-gray-300 font-mono">{server.username}@{server.host}:{server.port}</span>
              </div>
              <div className="flex justify-between">
                <span>Added</span>
                <span className="text-gray-300">{new Date(server.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-dark-600 text-gray-400 hover:text-white hover:border-dark-500 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-lg bg-accent-600 hover:bg-accent-500 text-white font-medium transition-colors text-sm"
            >
              {server ? 'Save Changes' : 'Add Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const input = 'w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-accent-500 transition-colors'

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs text-gray-400 mb-1.5 font-medium">{label}</label>
      {children}
    </div>
  )
}
