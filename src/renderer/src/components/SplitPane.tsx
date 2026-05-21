import React, { useRef, useCallback, useEffect } from 'react'

interface Props {
  left: React.ReactNode
  right: React.ReactNode
  showLeft: boolean
  showRight: boolean
  splitPercent: number
  onSplitChange: (pct: number) => void
}

export default function SplitPane({ left, right, showLeft, showRight, splitPercent, onSplitChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      onSplitChange(Math.min(85, Math.max(15, pct)))
    }
    function onMouseUp() {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [onSplitChange])

  const both = showLeft && showRight

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden h-full">
      {showLeft && (
        <div
          className="flex flex-col overflow-hidden"
          style={{ width: both ? `${splitPercent}%` : '100%', minWidth: 0 }}
        >
          {left}
        </div>
      )}

      {both && (
        <div
          onMouseDown={onMouseDown}
          className="flex-shrink-0 w-1 bg-dark-600 hover:bg-accent-500 cursor-col-resize transition-colors relative group"
          title="Drag to resize"
        >
          {/* wider invisible hit area */}
          <div className="absolute inset-y-0 -left-1 -right-1" />
          {/* visual handle */}
          <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-0.5 h-8 bg-accent-500 rounded-full" />
          </div>
        </div>
      )}

      {showRight && (
        <div
          className="flex flex-col overflow-hidden"
          style={{ width: both ? `${100 - splitPercent}%` : '100%', minWidth: 0 }}
        >
          {right}
        </div>
      )}
    </div>
  )
}
