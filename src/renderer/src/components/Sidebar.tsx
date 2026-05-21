import React, { useState } from 'react'
import { Server } from '../types'

interface Props {
  servers: Server[]
  onConnect: (server: Server) => void
  onAdd: () => void
  onEdit: (server: Server) => void
  onDelete: (id: string) => void
}

export default function Sidebar({ servers, onConnect, onAdd, onEdit, onDelete }: Props) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; server: Server } | null>(null)
  const [search, setSearch] = useState('')

  const filtered = servers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.host.toLowerCase().includes(search.toLowerCase())
  )

  function handleContextMenu(e: React.MouseEvent, server: Server) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, server })
  }

  return (
    <div
      className="w-64 bg-dark-800 border-r border-dark-600 flex flex-col select-none"
      onClick={() => setContextMenu(null)}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Servers</span>
          <button
            onClick={onAdd}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-dark-600 transition-colors"
            title="Add server"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div className="relative">
          <svg className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-md pl-7 pr-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-500 transition-colors"
          />
        </div>
      </div>

      {/* Server list */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-600 text-sm">
            {search ? 'No results' : 'No servers yet'}
          </div>
        )}
        {filtered.map((server) => (
          <div
            key={server.id}
            onDoubleClick={() => onConnect(server)}
            onContextMenu={(e) => handleContextMenu(e, server)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-dark-700 group transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-accent-600/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate font-medium">{server.name}</div>
              <div className="text-xs text-gray-500 truncate">{server.username}@{server.host}:{server.port}</div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(server) }}
                className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-dark-600 transition-colors"
                title="Edit server"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onConnect(server) }}
                className="w-6 h-6 flex items-center justify-center rounded text-accent-500 hover:bg-accent-600/20 transition-colors"
                title="Connect"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-dark-700 border border-dark-500 rounded-lg shadow-xl py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => { onConnect(contextMenu.server); setContextMenu(null) }}
            className="w-full text-left px-4 py-2 text-sm text-white hover:bg-dark-600 flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            Connect
          </button>
          <button
            onClick={() => { onEdit(contextMenu.server); setContextMenu(null) }}
            className="w-full text-left px-4 py-2 text-sm text-white hover:bg-dark-600 flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit
          </button>
          <div className="my-1 border-t border-dark-600" />
          <button
            onClick={() => { onDelete(contextMenu.server.id); setContextMenu(null) }}
            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-dark-600 flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
