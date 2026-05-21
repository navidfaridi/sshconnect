import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Terminal from './components/Terminal'
import FileManager from './components/FileManager'
import ServerModal from './components/ServerModal'
import SplitPane from './components/SplitPane'
import AuthButton from './components/AuthButton'
import { Server, Tab, CloudUser } from './types'
import logoUrl from './assets/logo.png'

export default function App() {
  const [servers, setServers] = useState<Server[]>([])
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editServer, setEditServer] = useState<Server | null>(null)
  const [user, setUser] = useState<CloudUser | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  useEffect(() => {
    loadServers()
    // بررسی وضعیت لاگین هنگام شروع
    window.api.auth.currentUser().then((u) => setUser(u))
  }, [])

  async function loadServers() {
    setServers(await window.api.server.list())
  }

  // ─── Auth ────────────────────────────────────────────────────────
  async function handleSignIn() {
    try {
      const u = await window.api.auth.signIn()
      setUser(u)
      // بعد از لاگین، سرورهای cloud را دریافت و merge کن
      await handleSync(u)
    } catch (e: any) {
      alert('Sign in failed: ' + e.message)
    }
  }

  async function handleSignOut() {
    // بستن همه تب‌های باز
    tabs.forEach((tab) => window.api.ssh.disconnect(tab.id))
    setTabs([])
    setActiveTabId(null)
    // پاک کردن سرورها از local store و state
    await window.api.server.clearAll()
    setServers([])
    // logout
    await window.api.auth.signOut()
    setUser(null)
  }

  async function handleSync(currentUser?: CloudUser) {
    const u = currentUser ?? user
    if (!u) return
    setSyncing(true)
    setSyncMsg(null)
    try {
      // دریافت سرورها از cloud
      const cloudServers = await window.api.sync.download()
      const cloudIds = new Set(cloudServers.map((s) => s.id))

      // خواندن سرورهای محلی فعلی (fresh از store)
      const localServers = await window.api.server.list()
      const localIds = new Set(localServers.map((s) => s.id))

      // افزودن سرورهایی که در cloud هستن ولی محلی نیستن
      for (const cs of cloudServers) {
        if (!localIds.has(cs.id)) {
          await window.api.server.add(cs) // ID حفظ می‌شه
        }
      }

      // آپلود فقط سرورهایی که محلی هستن ولی در cloud نیستن
      for (const ls of localServers) {
        if (!cloudIds.has(ls.id)) {
          await window.api.sync.uploadServer(ls.id).catch(() => {})
        }
      }

      await loadServers()
      setSyncMsg('Synced ✓')
      setTimeout(() => setSyncMsg(null), 2500)
    } catch (e: any) {
      setSyncMsg('Sync failed')
      setTimeout(() => setSyncMsg(null), 3000)
    } finally {
      setSyncing(false)
    }
  }

  async function handleConnect(server: Server) {
    const connectionId = `${server.id}-${Date.now()}`
    const tab: Tab = {
      id: connectionId,
      serverId: server.id,
      serverName: server.name,
      host: server.host,
      status: 'connecting',
      showTerminal: true,
      showFiles: false,
      splitPercent: 55,
      currentPath: '/'
    }
    setTabs((prev) => [...prev, tab])
    setActiveTabId(connectionId)

    try {
      await window.api.ssh.connect(connectionId, server.id)
      setTabs((prev) => prev.map((t) => t.id === connectionId ? { ...t, status: 'connected' } : t))
    } catch {
      setTabs((prev) => prev.map((t) => t.id === connectionId ? { ...t, status: 'error' } : t))
    }
  }

  function closeTab(tabId: string) {
    window.api.ssh.disconnect(tabId)
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId)
      if (activeTabId === tabId)
        setActiveTabId(next.length > 0 ? next[next.length - 1].id : null)
      return next
    })
  }

  function updateTab(tabId: string, patch: Partial<Tab>) {
    setTabs((prev) => prev.map((t) => t.id === tabId ? { ...t, ...patch } : t))
  }

  function togglePanel(tabId: string, panel: 'terminal' | 'files') {
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab) return
    const isTerminal = panel === 'terminal'
    const current = isTerminal ? tab.showTerminal : tab.showFiles
    const other   = isTerminal ? tab.showFiles   : tab.showTerminal
    // at least one panel must stay open
    if (current && !other) return
    updateTab(tabId, isTerminal ? { showTerminal: !current } : { showFiles: !current })
  }

  async function handleSaveServer(data: Omit<Server, 'id' | 'createdAt'>) {
    if (editServer) {
      await window.api.server.update(editServer.id, data)
      if (user) window.api.sync.uploadServer(editServer.id).catch(() => {})
    } else {
      const added = await window.api.server.add(data)
      if (user && added?.id) window.api.sync.uploadServer(added.id).catch(() => {})
    }
    setShowModal(false)
    setEditServer(null)
    loadServers()
  }

  async function handleDeleteServer(id: string) {
    await window.api.server.delete(id)
    if (user) window.api.sync.deleteServer(id).catch(() => {})
    loadServers()
  }

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null

  function statusDot(status: Tab['status']) {
    if (status === 'connected')  return 'bg-green-500'
    if (status === 'connecting') return 'bg-yellow-500 animate-pulse'
    if (status === 'error')      return 'bg-red-500'
    return 'bg-gray-500'
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">

      {/* ── Draggable title bar ── */}
      <div
        className="flex items-center gap-2 px-3 bg-dark-800 border-b border-dark-600 flex-shrink-0"
        style={{ height: 36, WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <img
          src={logoUrl}
          alt="ConnectSSH"
          className="w-4 h-4 pointer-events-none select-none flex-shrink-0"
          style={{ imageRendering: 'crisp-edges' }}
        />
        <span className="text-xs font-semibold text-gray-500 pointer-events-none select-none tracking-wide">
          ConnectSSH
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <div className="w-64 bg-dark-800 border-r border-dark-600 flex flex-col">
          <Sidebar
            servers={servers}
            onConnect={handleConnect}
            onAdd={() => { setEditServer(null); setShowModal(true) }}
            onEdit={(s) => { setEditServer(s); setShowModal(true) }}
            onDelete={handleDeleteServer}
          />
          {/* sync status */}
          {syncMsg && (
            <div className="px-4 py-1 text-xs text-center text-green-400 bg-green-900/20">
              {syncMsg}
            </div>
          )}
          <AuthButton
            user={user}
            syncing={syncing}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onSync={() => handleSync()}
          />
        </div>

        {/* ── Main area ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Tab bar */}
          {tabs.length > 0 && (
            <div className="flex items-center bg-dark-800 border-b border-dark-600 overflow-x-auto flex-shrink-0">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 border-r border-dark-600 cursor-pointer group flex-shrink-0 transition-colors ${
                    activeTabId === tab.id
                      ? 'bg-dark-900 text-white border-b-2 border-b-accent-500'
                      : 'text-gray-400 hover:text-white hover:bg-dark-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(tab.status)}`} />
                  <span className="text-sm max-w-[130px] truncate">{tab.serverName}</span>

                  {/* Panel toggles — only on active tab */}
                  {activeTabId === tab.id && (
                    <div className="flex items-center gap-0.5 ml-1">
                      {/* Terminal toggle */}
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePanel(tab.id, 'terminal') }}
                        title={tab.showTerminal ? 'Hide terminal' : 'Show terminal'}
                        className={`p-1 rounded transition-colors ${
                          tab.showTerminal ? 'text-accent-400 hover:bg-accent-600/20' : 'text-gray-600 hover:text-gray-400'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </button>
                      {/* Files toggle */}
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePanel(tab.id, 'files') }}
                        title={tab.showFiles ? 'Hide file manager' : 'Show file manager'}
                        className={`p-1 rounded transition-colors ${
                          tab.showFiles ? 'text-accent-400 hover:bg-accent-600/20' : 'text-gray-600 hover:text-gray-400'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Close tab */}
                  <button
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                    className="ml-1 p-0.5 rounded text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-hidden relative flex">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`w-full h-full ${tab.id === activeTabId ? 'flex' : 'hidden'}`}
              >
                <SplitPane
                  showLeft={tab.showTerminal}
                  showRight={tab.showFiles}
                  splitPercent={tab.splitPercent}
                  onSplitChange={(pct) => updateTab(tab.id, { splitPercent: pct })}
                  left={<Terminal tab={tab} isActive={tab.id === activeTabId} />}
                  right={
                    <FileManager
                      tab={tab}
                      onPathChange={(path) => updateTab(tab.id, { currentPath: path })}
                    />
                  }
                />
              </div>
            ))}
            {tabs.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-600 select-none h-full w-full">
                <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-lg font-medium text-gray-500">No active connection</p>
                <p className="text-sm mt-1 text-gray-600">Double-click a server to connect</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <ServerModal
          server={editServer}
          onSave={handleSaveServer}
          onClose={() => { setShowModal(false); setEditServer(null) }}
        />
      )}
    </div>
  )
}
