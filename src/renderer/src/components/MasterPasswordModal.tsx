import React, { useState } from 'react'
import { MasterPasswordStatus } from '../types'

interface Props {
  status: MasterPasswordStatus
  onUnlocked: () => void
}

export default function MasterPasswordModal({ status, onUnlocked }: Props) {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [show, setShow]           = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const isSetup = status === 'none'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (isSetup && password !== confirm) { setError('Passwords do not match'); return }

    setLoading(true)
    try {
      if (isSetup) {
        await window.api.master.setup(password)
        onUnlocked()
      } else {
        const ok = await window.api.master.unlock(password)
        if (ok) onUnlocked()
        else    setError('Incorrect master password')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl w-[440px] shadow-2xl">

        {/* Header */}
        <div className="px-6 py-5 border-b border-[#30363d]">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-accent-600/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-semibold text-base">
                {isSetup ? 'Set Up Master Password' : 'Enter Master Password'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {isSetup
                  ? 'Protects your server credentials with end-to-end encryption'
                  : 'Required to decrypt your synced server credentials'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Info banner */}
          <div className="flex gap-2.5 bg-accent-600/10 border border-accent-600/20 rounded-lg px-4 py-3">
            <svg className="w-4 h-4 text-accent-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-accent-300/80 leading-relaxed">
              {isSetup
                ? 'This password is never sent to any server. It is used locally to encrypt your data before cloud sync. If you forget it, your cloud data cannot be recovered.'
                : 'Your server credentials are encrypted with this password. It is never stored anywhere.'}
            </p>
          </div>

          {/* Password field */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">
              {isSetup ? 'Create Master Password' : 'Master Password'}
            </label>
            <div className="relative">
              <input
                autoFocus
                type={show ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-white text-sm
                  placeholder-gray-600 focus:outline-none focus:border-accent-500 transition-colors pr-10"
              />
              <button type="button" onClick={() => setShow(!show)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {show
                  ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                }
              </button>
            </div>
          </div>

          {/* Confirm (setup only) */}
          {isSetup && (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Confirm Password</label>
              <input
                type={show ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-white text-sm
                  placeholder-gray-600 focus:outline-none focus:border-accent-500 transition-colors"
              />
            </div>
          )}

          {/* Strength indicator (setup only) */}
          {isSetup && password.length > 0 && (
            <div>
              <div className="flex gap-1 mb-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                    password.length >= i * 4
                      ? i <= 2 ? 'bg-yellow-500' : i === 3 ? 'bg-blue-500' : 'bg-green-500'
                      : 'bg-[#30363d]'
                  }`} />
                ))}
              </div>
              <p className="text-xs text-gray-600">
                {password.length < 8 ? 'Too short' : password.length < 12 ? 'Moderate' : password.length < 16 ? 'Strong' : 'Very strong'}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2.5 text-sm text-red-400">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || password.length < 8}
            className="w-full py-2.5 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:opacity-50
              disabled:cursor-not-allowed text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {loading
              ? (isSetup ? 'Setting up...' : 'Verifying...')
              : (isSetup ? 'Set Master Password' : 'Unlock')}
          </button>
        </form>
      </div>
    </div>
  )
}
