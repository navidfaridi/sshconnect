import React, { useRef, useCallback, useEffect } from 'react'

interface Props {
  left: React.ReactNode
  right: React.ReactNode
  showLeft: boolean
  showRight: boolean
  splitPercent: number
  splitOrientation: 'horizontal' | 'vertical'
  onSplitChange: (pct: number) => void
}

export default function SplitPane({
  left, right, showLeft, showRight, splitPercent, splitOrientation, onSplitChange
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging     = useRef(false)
  const isH          = splitOrientation === 'horizontal'

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor    = isH ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }, [isH])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct  = isH
        ? ((e.clientX - rect.left)  / rect.width)  * 100
        : ((e.clientY - rect.top)   / rect.height) * 100
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
  }, [isH, onSplitChange])

  const both = showLeft && showRight

  if (isH) {
    // ── Horizontal split (side by side) ──
    return (
      <div ref={containerRef} className="flex flex-1 overflow-hidden h-full">
        {showLeft && (
          <div className="flex flex-col overflow-hidden" style={{ width: both ? `${splitPercent}%` : '100%', minWidth: 0 }}>
            {left}
          </div>
        )}
        {both && (
          <div onMouseDown={onMouseDown}
            className="flex-shrink-0 w-1 bg-dark-600 hover:bg-accent-500 cursor-col-resize transition-colors relative group">
            <div className="absolute inset-y-0 -left-1 -right-1" />
            <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-0.5 h-8 bg-accent-500 rounded-full" />
            </div>
          </div>
        )}
        {showRight && (
          <div className="flex flex-col overflow-hidden" style={{ width: both ? `${100 - splitPercent}%` : '100%', minWidth: 0 }}>
            {right}
          </div>
        )}
      </div>
    )
  }

  // ── Vertical split (stacked) ──
  return (
    <div ref={containerRef} className="flex flex-col flex-1 overflow-hidden h-full">
      {showLeft && (
        <div className="flex overflow-hidden" style={{ height: both ? `${splitPercent}%` : '100%', minHeight: 0 }}>
          {left}
        </div>
      )}
      {both && (
        <div onMouseDown={onMouseDown}
          className="flex-shrink-0 h-1 bg-dark-600 hover:bg-accent-500 cursor-row-resize transition-colors relative group">
          <div className="absolute -top-1 -bottom-1 inset-x-0" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="h-0.5 w-8 bg-accent-500 rounded-full" />
          </div>
        </div>
      )}
      {showRight && (
        <div className="flex overflow-hidden" style={{ height: both ? `${100 - splitPercent}%` : '100%', minHeight: 0 }}>
          {right}
        </div>
      )}
    </div>
  )
}
