import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ScanSearch, ShieldAlert, ShieldCheck } from 'lucide-react'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/scan', label: 'Scan Project', icon: ScanSearch },
  { to: '/results', label: 'Vulnerability Results', icon: ShieldAlert },
]

export default function Sidebar() {
  return (
    <aside className="flex shrink-0 items-center gap-6 overflow-x-auto bg-navy px-5 py-3 text-slate-400 md:sticky md:top-0 md:h-screen md:w-60 md:flex-col md:items-stretch md:gap-0 md:px-4 md:py-6">
      <div className="flex shrink-0 items-center gap-2.5 md:mb-10 md:px-2">
        <ShieldCheck size={22} className="text-blue-400" strokeWidth={2.2} />
        <span className="text-[17px] font-semibold tracking-tight text-white">DepGuard</span>
      </div>

      <nav className="flex gap-1 md:flex-col">
        <p className="mb-2 hidden px-3 text-[11px] font-medium uppercase tracking-widest text-slate-500 md:block">Menu</p>
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `group relative flex items-center gap-3 whitespace-nowrap rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors duration-150 ${
                isActive ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-slate-100'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`absolute left-0 top-1/2 hidden h-5 w-[3px] -translate-y-1/2 rounded-r bg-violet-400 transition-all duration-200 md:block ${
                    isActive ? 'opacity-100' : 'scale-y-0 opacity-0'
                  }`}
                />
                <Icon size={17} className="transition-transform duration-150 group-hover:translate-x-0.5" />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <p className="mt-auto hidden px-3 text-xs text-slate-500 md:block">Data from OSV.dev</p>
    </aside>
  )
}
