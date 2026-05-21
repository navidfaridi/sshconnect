import React, { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { Tab } from '../types'

interface Props {
  tab: Tab
  isActive: boolean
}

export default function Terminal({ tab, isActive }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

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

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    if (tab.status === 'connecting') {
      term.writeln('\x1b[90mConnecting to ' + tab.host + '...\x1b[0m')
    }

    term.onData((data) => {
      window.api.ssh.send(tab.id, data)
    })

    const unsubscribeData = window.api.ssh.onData((connectionId, data) => {
      if (connectionId === tab.id) {
        term.write(data)
      }
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
    <div className="flex-1 bg-[#0d1117] overflow-hidden p-1">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
