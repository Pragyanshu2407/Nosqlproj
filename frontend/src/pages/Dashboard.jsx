import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, ShieldAlert, Flame, ShieldCheck, ChevronRight, ScanSearch } from 'lucide-react'
import { api } from '../api.js'
import { Card, PageHeader, Spinner, ErrorBanner, ProjectSelect, CountUp, SEVERITY_COLORS } from '../components/ui.jsx'

function StatCard({ label, value, icon: Icon, tint, delay }) {
  return (
    <Card delay={delay} className="transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-[13px] text-slate-500">{label}</p>
        <span className={`grid h-8 w-8 place-items-center rounded-md ${tint}`}><Icon size={16} /></span>
      </div>
      <p className="mt-3 text-[32px] font-semibold leading-none tracking-tight"><CountUp value={value} /></p>
    </Card>
  )
}

/** SVG donut. Segments draw in on load via a stroke-dasharray transition. */
function Donut({ dist, total }) {
  const [ready, setReady] = useState(false)
  useEffect(() => { const t = setTimeout(() => setReady(true), 80); return () => clearTimeout(t) }, [])
  const r = 70
  const C = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="relative h-44 w-44 shrink-0">
      <svg viewBox="0 0 180 180" className="-rotate-90">
        <circle cx="90" cy="90" r={r} fill="none" stroke="#f1f5f9" strokeWidth="18" />
        {Object.entries(dist).map(([sev, n]) => {
          if (!n) return null
          const len = (n / total) * C
          const el = (
            <circle
              key={sev} cx="90" cy="90" r={r} fill="none" stroke={SEVERITY_COLORS[sev]} strokeWidth="18"
              strokeDasharray={`${ready ? Math.max(len - 1.5, 0) : 0} ${C}`} strokeDashoffset={-offset}
              style={{ transition: 'stroke-dasharray 900ms cubic-bezier(.3,.7,.2,1)' }}
            />
          )
          offset += len
          return el
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-2xl font-semibold"><CountUp value={total} /></p>
          <p className="text-xs text-slate-500">findings</p>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { api.projects().then(setProjects).catch((e) => setError(e.message)) }, [])
  useEffect(() => {
    setStats(null)
    api.dashboard(projectId).then(setStats).catch((e) => setError(e.message))
  }, [projectId])

  if (error) return <ErrorBanner message={error} />
  if (!stats) return <Spinner />

  const dist = stats.severity_distribution
  const total = stats.total_vulnerabilities

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Security overview of your scanned dependencies">
        <ProjectSelect projects={projects} value={projectId} onChange={setProjectId} allLabel="All projects" />
      </PageHeader>

      {stats.total_dependencies === 0 ? (
        <Card className="py-16 text-center">
          <ScanSearch className="mx-auto text-slate-300" size={34} />
          <p className="mt-4 font-medium">No scans yet</p>
          <p className="mt-1 text-sm text-slate-500">Upload a dependency file to see your security overview.</p>
          <Link to="/scan" className="mt-6 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700">
            Scan a project
          </Link>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard delay={0} label="Dependencies scanned" value={stats.total_dependencies} icon={Package} tint="bg-blue-50 text-blue-600" />
            <StatCard delay={60} label="Vulnerable dependencies" value={stats.vulnerable_dependencies} icon={ShieldAlert} tint="bg-orange-50 text-orange-600" />
            <StatCard delay={120} label="Critical vulnerabilities" value={stats.critical_vulnerabilities} icon={Flame} tint="bg-red-50 text-red-600" />
            <StatCard delay={180} label="Safe dependencies" value={stats.safe_dependencies} icon={ShieldCheck} tint="bg-emerald-50 text-emerald-600" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-5">
            <Card delay={240} className="lg:col-span-3">
              <h2 className="text-[15px] font-semibold">Severity distribution</h2>
              <div className="mt-6 flex flex-wrap items-center gap-10">
                <Donut key={projectId} dist={dist} total={total} />
                <ul className="min-w-52 flex-1 space-y-3.5">
                  {Object.entries(dist).map(([sev, n]) => (
                    <li key={sev}>
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="flex items-center gap-2 text-slate-600">
                          <span className="h-2 w-2 rounded-full" style={{ background: SEVERITY_COLORS[sev] }} />
                          {sev.charAt(0) + sev.slice(1).toLowerCase()}
                        </span>
                        <span className="tabular font-medium">{n}</span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full origin-left rounded-full"
                          style={{
                            width: `${total ? (n / total) * 100 : 0}%`,
                            background: SEVERITY_COLORS[sev],
                            animation: 'bar-grow 900ms cubic-bezier(.3,.7,.2,1) both',
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            <Card delay={300} className="lg:col-span-2">
              <h2 className="text-[15px] font-semibold">Recent scans</h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {projects.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <Link to={`/results?project=${p.id}`} className="group -mx-2 flex items-center justify-between rounded-md px-2 py-3 transition-colors hover:bg-slate-50">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.project_name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {p.vulnerable} of {p.total} vulnerable · {new Date(p.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <ChevronRight size={16} className="shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-slate-500" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </>
  )
}
