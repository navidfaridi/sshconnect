import React, { useState } from 'react'
import { CloudUser } from '../types'

interface Props {
  user: CloudUser | null
  syncing: boolean
  onSignIn: () => void
  onSignOut: () => void
  onSync: () => void
}

export default function AuthButton({ user, syncing, onSignIn, onSignOut, onSync }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  if (!user) {
    return (
      <div className="px-3 py-3 border-t border-dark-600">
        <button
          onClick={onSignIn}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 border border-dark-500 text-sm text-gray-300 hover:text-white transition-colors"
        >
          {/* Google icon */}
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    )
  }

  return (
    <div className="px-3 py-3 border-t border-dark-600 relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-dark-700 transition-colors group"
      >
        {/* Avatar */}
        <div className="w-7 h-7 rounded-full bg-accent-600 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
          {user.displayName?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-xs font-medium text-white truncate">{user.displayName || user.email}</div>
          <div className="text-[10px] text-gray-500 truncate">{user.email}</div>
        </div>
        <svg className="w-3 h-3 text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {menuOpen && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />

          <div className="absolute bottom-full left-3 right-3 mb-1 z-50 bg-dark-700 border border-dark-500 rounded-lg shadow-xl py-1">
            <button
              onClick={() => { onSync(); setMenuOpen(false) }}
              disabled={syncing}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-dark-600 disabled:opacity-50 transition-colors"
            >
              <svg className={`w-4 h-4 flex-shrink-0 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncing ? 'Syncing...' : 'Sync servers'}
            </button>

            <div className="my-1 border-t border-dark-600" />

            <button
              onClick={() => { onSignOut(); setMenuOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-dark-600 transition-colors"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
