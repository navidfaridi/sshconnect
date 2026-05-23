import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { Tab } from '../types'

interface Props {
  tab: Tab
  isActive: boolean
}

interface ContextMenuState {
  x: number
  y: number
  hasSelection: boolean
}

export default function Terminal({ tab, isActive }: Props) {
  const containerRef    = useRef<HTMLDivElement>(null)
  const xtermRef        = useRef<XTerm | null>(null)
  const fitAddonRef     = useRef<FitAddon | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  // ─── Context menu actions ─────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    const sel = xtermRef.current?.getSelection()
    if (sel) await navigator.clipboard.writeText(sel)
    setContextMenu(null)
    xtermRef.current?.focus()
  }, [])

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) window.api.ssh.send(tab.id, text)
    } catch { /* clipboard permission denied */ }
    setContextMenu(null)
    xtermRef.current?.focus()
  }, [tab.id])

  const handleSelectAll = useCallback(() => {
    xtermRef.current?.selectAll()
    setContextMenu(null)
  }, [])

  const handleClear = useCallback(() => {
    xtermRef.current?.clear()
    setContextMenu(null)
    xtermRef.current?.focus()
  }, [])

  // بستن منو با کلیک بیرون از آن
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('contextmenu', close)
    }
  }, [contextMenu])

  // ─── xterm init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const term = new XTerm({
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: '#388bfd40',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc'
      },
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    xtermRef.current    = term
    fitAddonRef.current = fitAddon

    if (tab.status === 'connecting') {
      term.writeln('\x1b[90mConnecting to ' + tab.host + '...\x1b[0m')
    }

    // ─── کلیدهای ویژه ────────────────────────────────────────────────────
    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      // Tab: جلوگیری از focus traversal مرورگر
      if (event.key === 'Tab') {
        if (event.type === 'keydown') {
          event.preventDefault()
          window.api.ssh.send(tab.id, '\t')
        }
        return false
      }

      // Ctrl+Shift+C → کپی متن انتخاب‌شده
      if (event.ctrlKey && event.shiftKey && event.key === 'C' && event.type === 'keydown') {
        event.preventDefault()
        const sel = term.getSelection()
        if (sel) navigator.clipboard.writeText(sel)
        return false
      }

      // Ctrl+Shift+V → paste از clipboard
      if (event.ctrlKey && event.shiftKey && event.key === 'V' && event.type === 'keydown') {
        event.preventDefault()
        navigator.clipboard.readText().then((text) => {
          if (text) window.api.ssh.send(tab.id, text)
        }).catch(() => {})
        return false
      }

      return true
    })

    term.onData((data) => {
      window.api.ssh.send(tab.id, data)
    })

    // ─── راست‌کلیک: نمایش context menu ───────────────────────────────────
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const hasSelection = term.getSelection().length > 0

      // جلوگیری از خروج منو از صفحه
      const menuW = 160
      const menuH = hasSelection ? 156 : 120
      const x = Math.min(e.clientX, window.innerWidth  - menuW - 8)
      const y = Math.min(e.clientY, window.innerHeight - menuH - 8)

      setContextMenu({ x, y, hasSelection })
    }

    containerRef.current.addEventListener('contextmenu', handleContextMenu)

    const unsubscribeData = window.api.ssh.onData((connectionId, data) => {
      if (connectionId === tab.id) term.write(data)
    })

    const unsubscribeClosed = window.api.ssh.onClosed((connectionId) => {
      if (connectionId === tab.id) {
        term.writeln('\r\n\x1b[90m[Connection closed]\x1b[0m')
      }
    })

    const ro = new ResizeObserver(() => {
      if (containerRef.current && containerRef.current.clientWidth > 0 && containerRef.current.clientHeight > 0) {
        fitAddon.fit()
        const { cols, rows } = term
        window.api.ssh.resize(tab.id, cols, rows)
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      containerRef.current?.removeEventListener('contextmenu', handleContextMenu)
      term.dispose()
      unsubscribeData()
      unsubscribeClosed()
    }
  }, [tab.id])

  useEffect(() => {
    if (isActive && xtermRef.current && fitAddonRef.current) {
      setTimeout(() => {
        if (containerRef.current && containerRef.current.clientWidth > 0 && fitAddonRef.current && xtermRef.current) {
          fitAddonRef.current.fit()
          const { cols, rows } = xtermRef.current
          window.api.ssh.resize(tab.id, cols, rows)
          xtermRef.current.focus()
        }
      }, 50)
    }
  }, [isActive, tab.id])

  return (
    <div className="flex-1 bg-[#0d1117] overflow-hidden p-1 relative">
      <div ref={containerRef} className="w-full h-full" />

      {/* ── Context Menu ── */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[160px] bg-[#161b22] border border-[#30363d] rounded-md shadow-xl py-1 text-sm"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Copy — فقط وقتی متن انتخاب شده */}
          <button
            onClick={handleCopy}
            disabled={!contextMenu.hasSelection}
            className="w-full flex items-center gap-3 px-3 py-1.5 text-left
              disabled:text-[#484f58] disabled:cursor-not-allowed
              text-[#e6edf3] hover:bg-[#21262d] transition-colors"
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>Copy</span>
            <span className="ml-auto text-[#6e7681] text-xs">Ctrl+Shift+C</span>
          </button>

          {/* Paste */}
          <button
            onClick={handlePaste}
            className="w-full flex items-center gap-3 px-3 py-1.5 text-left
              text-[#e6edf3] hover:bg-[#21262d] transition-colors"
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Paste</span>
            <span className="ml-auto text-[#6e7681] text-xs">Ctrl+Shift+V</span>
          </button>

          {/* Select All */}
          <button
            onClick={handleSelectAll}
            className="w-full flex items-center gap-3 px-3 py-1.5 text-left
              text-[#e6edf3] hover:bg-[#21262d] transition-colors"
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>Select All</span>
          </button>

          <div className="border-t border-[#30363d] my-1" />

          {/* Clear */}
          <button
            onClick={handleClear}
            className="w-full flex items-center gap-3 px-3 py-1.5 text-left
              text-[#e6edf3] hover:bg-[#21262d] transition-colors"
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Clear</span>
          </button>
        </div>
      )}
    </div>
  )
}
