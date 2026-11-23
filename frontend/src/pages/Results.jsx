import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, ChevronRight } from 'lucide-react'
import { api } from '../api.js'
import { Card, PageHeader, Spinner, ErrorBanner, ProjectSelect, SeverityBadge } from '../components/ui.jsx'
import VulnModal from '../components/VulnModal.jsx'

const FILTERS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN', 'SAFE']
const matches = (r, f) => (f === 'ALL' ? true : f === 'SAFE' ? r.status === 'Safe' : r.severity === f)

export default function Results() {
  const [params, setParams] = useSearchParams()
  const projectId = params.get('project') || ''
  const [projects, setProjects] = useState([])
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [severity, setSeverity] = useState('ALL')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => { api.projects().then(setProjects).catch((e) => setError(e.message)) }, [])
  useEffect(() => {
    setData(null)
    api.results(projectId).then(setData).catch((e) => setError(e.message))
  }, [projectId])

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f, data ? data.rows.filter((r) => matches(r, f)).length : 0])),
    [data],
  )
  const rows = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    return data.rows.filter(
      (r) => matches(r, severity) && (!q || `${r.package_name} ${r.vulnerability_id || ''}`.toLowerCase().includes(q)),
    )
  }, [data, severity, query])

  if (error) return <ErrorBanner message={error} />
  if (!data) return <Spinner />
  if (!data.project) return <Card className="py-16 text-center text-sm text-slate-500">No scans yet. Scan a project first.</Card>

  return (
    <>
      <PageHeader title="Vulnerability Results" subtitle={`Findings for ${data.project.project_name}`}>
        <ProjectSelect projects={projects} value={data.project.id} onChange={(id) => setParams({ project: id })} />
      </PageHeader>

      <Card className="!p-0 overflow-hidden">
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by package or vulnerability ID"
              className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex flex-wrap gap-1 rounded-md bg-slate-100 p-1 sm:inline-flex">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setSeverity(f)}
                className={`rounded px-3 py-1 text-[13px] font-medium transition-all duration-150 ${
                  severity === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {f.charAt(0) + f.slice(1).toLowerCase()}
                <span className="tabular ml-1.5 text-xs text-slate-400">{counts[f]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                {['Package', 'Installed', 'Vulnerability ID', 'Severity', 'Fixed version', 'Status', ''].map((h) => (
                  <th key={h} className="whitespace-nowrap px-5 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody key={severity + query} className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr
                  key={i}
                  onClick={() => r.vulnerability_id && setSelected(r)}
                  className={`anim-fade group transition-colors duration-100 ${r.vulnerability_id ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                  style={{ animationDelay: `${Math.min(i, 14) * 18}ms` }}
                >
                  <td className="px-5 py-3 font-medium">{r.package_name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-600">{r.version}</td>
                  <td className="px-5 py-3 font-mono text-xs text-blue-700">{r.vulnerability_id || <span className="text-slate-300">—</span>}</td>
                  <td className="px-5 py-3"><SeverityBadge severity={r.severity} /></td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-600">
                    {r.status === 'Safe' ? <span className="text-slate-300">—</span> : r.fixed_versions.length ? r.fixed_versions.join(', ') : <span className="text-slate-400">None listed</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${r.status === 'Safe' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="pr-4 text-slate-300">
                    {r.vulnerability_id && <ChevronRight size={15} className="-translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="py-14 text-center text-sm text-slate-500">No results match your filters.</p>}
        </div>
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          Showing {rows.length} of {data.rows.length} · select a vulnerability for details
        </p>
      </Card>

      {selected && <VulnModal row={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
