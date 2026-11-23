import { useEffect, useState } from 'react'
import { X, ExternalLink } from 'lucide-react'
import { api } from '../api.js'
import { SeverityBadge, Spinner, ErrorBanner } from './ui.jsx'

export default function VulnModal({ row, onClose }) {
  const [v, setV] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.vulnerability(row.vulnerability_id, row.package_name, row.ecosystem).then(setV).catch((e) => setError(e.message))
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [row, onClose])

  return (
    <div className="anim-fade fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="anim-scale max-h-[88vh] w-full max-w-2xl overflow-auto rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="min-w-0">
            <p className="font-mono text-xs text-blue-700">{row.vulnerability_id}</p>
            <h2 className="mt-1 text-[17px] font-semibold leading-snug">{v?.summary || `${row.package_name} ${row.version}`}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
        </div>

        <div className="px-6 py-5">
          {error && <ErrorBanner message={error} />}
          {!v && !error && <Spinner />}
          {v && (
            <div className="space-y-6 text-sm">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Fact label="Severity"><SeverityBadge severity={v.severity} /></Fact>
                <Fact label="CVSS score">{v.cvss_score != null ? v.cvss_score.toFixed(1) : '—'}</Fact>
                <Fact label="Package">{v.package_name}</Fact>
                <Fact label="Ecosystem">{v.ecosystem}</Fact>
              </dl>

              {v.aliases.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {v.aliases.map((a) => <span key={a} className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">{a}</span>)}
                </div>
              )}

              <Section title="Description">
                <p className="max-h-52 overflow-auto whitespace-pre-wrap leading-relaxed text-slate-700">{v.description}</p>
              </Section>

              <div className="grid gap-6 sm:grid-cols-2">
                <Section title="Affected versions">
                  {v.affected_versions.length
                    ? <ul className="space-y-1">{v.affected_versions.map((r, i) => <li key={i} className="font-mono text-xs text-slate-700">{r}</li>)}</ul>
                    : <p className="text-slate-500">Not specified by OSV.</p>}
                </Section>
                <Section title="Fixed versions">
                  {v.fixed_versions.length
                    ? <p className="font-mono text-xs text-emerald-700">{v.fixed_versions.join(', ')}</p>
                    : <p className="text-slate-500">No fixed version listed.</p>}
                </Section>
              </div>

              <a href={`https://osv.dev/vulnerability/${v.vulnerability_id}`} target="_blank" rel="noreferrer"
                 className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
                View on OSV.dev <ExternalLink size={13} />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Fact({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-[13px] font-medium">{children}</dd>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      {children}
    </div>
  )
}
