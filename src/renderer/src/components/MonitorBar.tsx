import React from 'react'
import { MonitorMetrics } from '../types'

interface Props { metrics: MonitorMetrics }

function colorFor(pct: number): string {
  if (pct >= 90) return 'bg-red-500'
  if (pct >= 70) return 'bg-yellow-500'
  return 'bg-emerald-500'
}

function Gauge({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-[3.5rem] text-right">
        <span className="text-xs font-mono font-semibold text-white tabular-nums">
          {value}%
        </span>
      </div>
      <div className="flex flex-col gap-0.5" style={{ minWidth: 80 }}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{label}</span>
        </div>
        <div className="h-1.5 bg-[#21262d] rounded-full overflow-hidden w-20">
          <div
            className={`h-full rounded-full transition-all duration-700 ${colorFor(value)}`}
            style={{ width: `${value}%` }}
          />
        </div>
        <span className="text-[10px] text-gray-600 truncate">{sub}</span>
      </div>
    </div>
  )
}

export default function MonitorBar({ metrics }: Props) {
  return (
    <div className="flex items-center gap-5 px-4 py-1.5 bg-[#0d1117] border-b border-[#21262d] flex-shrink-0">
      {/* CPU */}
      <Gauge label="CPU" value={metrics.cpu} sub="usage" />

      <div className="w-px h-6 bg-[#21262d]" />

      {/* RAM */}
      <Gauge
        label="RAM"
        value={metrics.ram}
        sub={`${metrics.ramUsed} / ${metrics.ramTotal}`}
      />

      <div className="w-px h-6 bg-[#21262d]" />

      {/* DISK */}
      <Gauge
        label="Disk"
        value={metrics.disk}
        sub={`${metrics.diskUsed} / ${metrics.diskTotal}`}
      />
    </div>
  )
}
