import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'

export const SEVERITY_COLORS = {
  CRITICAL: '#dc2626',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#3b82f6',
  UNKNOWN: '#94a3b8',
}

const label = (s) => s.charAt(0) + s.slice(1).toLowerCase()

/** Small coloured dot + text. Quieter than a filled pill. */
export function SeverityBadge({ severity }) {
  if (!severity) return <span className="text-slate-300">—</span>
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
      <span className="h-2 w-2 rounded-full" style={{ background: SEVERITY_COLORS[severity] || SEVERITY_COLORS.UNKNOWN }} />
      {label(severity)}
    </span>
  )
}

export function Card({ className = '', delay = 0, children }) {
  return (
    <div
      className={`anim-up rounded-lg border border-slate-200 bg-white p-6 ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="anim-up mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

export function Spinner({ text = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-24 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
      {text}
    </div>
  )
}

export function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="anim-scale flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <AlertCircle size={17} className="mt-0.5 shrink-0" /> <span>{message}</span>
    </div>
  )
}

export function ProjectSelect({ projects, value, onChange, allLabel }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
    >
      {allLabel && <option value="">{allLabel}</option>}
      {projects.map((p) => (
        <option key={p.id} value={p.id}>{p.project_name}</option>
      ))}
    </select>
  )
}

/** Counts up from 0 to `value`. */
export function CountUp({ value, duration = 800 }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf, start
    const tick = (t) => {
      start ??= t
      const p = Math.min((t - start) / duration, 1)
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <span className="tabular">{n.toLocaleString()}</span>
}
