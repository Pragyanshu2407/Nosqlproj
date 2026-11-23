import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud, FileText, ScanSearch, TriangleAlert, X } from 'lucide-react'
import { api } from '../api.js'
import { Card, PageHeader, ErrorBanner } from '../components/ui.jsx'

function Step({ n, title, done, children }) {
  return (
    <div className="flex gap-4">
      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors duration-300 ${done ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="mb-2 text-sm font-medium">{title}</p>
        {children}
      </div>
    </div>
  )
}

export default function ScanProject() {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [name, setName] = useState('')
  const [file, setFile] = useState(null)
  const [content, setContent] = useState('')
  const [parsed, setParsed] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')

  async function chooseFile(f) {
    if (!f) return
    setError(''); setParsed(null); setFile(f); setParsing(true)
    try {
      setParsed(await api.parse(f))        // Flask extracts package names + versions
      setContent(await f.text())
    } catch (e) {
      setError(e.message); setFile(null)
    } finally {
      setParsing(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function clearFile(e) {
    e.stopPropagation()
    setFile(null); setParsed(null); setError('')
  }

  async function scan() {
    setError('')
    if (!name.trim()) return setError('Please enter a project name.')
    setScanning(true)
    try {
      const res = await api.scan({
        project_name: name.trim(), filename: parsed.filename, file_content: content, dependencies: parsed.dependencies,
      })
      navigate(`/results?project=${res.project_id}`)
    } catch (e) {
      setError(e.message); setScanning(false)
    }
  }

  return (
    <>
      <PageHeader title="Scan Project" subtitle="Check a requirements.txt or package.json against OSV.dev" />
      <div className="max-w-2xl space-y-4">
        <Card className="space-y-7">
          <Step n={1} title="Project name" done={!!name.trim()}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Billing API"
              maxLength={100}
              className="w-full rounded-md border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </Step>

          <Step n={2} title="Dependency file" done={!!parsed}>
            <div
              onClick={() => inputRef.current.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); chooseFile(e.dataTransfer.files[0]) }}
              className={`cursor-pointer rounded-md border border-dashed px-6 py-8 text-center transition-all duration-200 ${
                dragging ? 'scale-[1.01] border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
              }`}
            >
              <input ref={inputRef} type="file" accept=".txt,.json" className="hidden" onChange={(e) => chooseFile(e.target.files[0])} />
              {file && parsed ? (
                <div className="anim-scale flex items-center justify-center gap-2.5 text-sm font-medium">
                  <FileText size={18} className="text-blue-600" /> {file.name}
                  <button onClick={clearFile} className="rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700" title="Remove">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <UploadCloud className={`mx-auto text-slate-400 transition-transform duration-200 ${dragging ? '-translate-y-1' : ''}`} size={28} strokeWidth={1.6} />
                  <p className="mt-2.5 text-sm">{parsing ? 'Reading file…' : <><span className="font-medium text-blue-600">Click to upload</span> or drag and drop</>}</p>
                  <p className="mt-1 text-xs text-slate-500">requirements.txt or package.json, up to 1 MB</p>
                </>
              )}
            </div>
          </Step>
        </Card>

        <ErrorBanner message={error} />

        {parsed && (
          <Card className="!p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold">Extracted packages</h2>
              <span className="text-xs text-slate-500">{parsed.dependencies.length} found · {parsed.file_type}</span>
            </div>
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500">
                  <tr><th className="px-5 py-2 font-medium">Package</th><th className="px-5 py-2 font-medium">Version</th><th className="px-5 py-2 font-medium">Ecosystem</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsed.dependencies.map((d, i) => (
                    <tr key={d.name + d.version} className="anim-fade" style={{ animationDelay: `${Math.min(i, 15) * 25}ms` }}>
                      <td className="px-5 py-2 font-medium">{d.name}</td>
                      <td className="px-5 py-2 font-mono text-xs text-slate-600">{d.version}</td>
                      <td className="px-5 py-2 text-slate-600">{d.ecosystem}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsed.skipped.length > 0 && (
              <div className="border-t border-amber-200 bg-amber-50 px-5 py-3.5 text-xs text-amber-800">
                <p className="flex items-center gap-2 font-medium"><TriangleAlert size={14} />{parsed.skipped.length} skipped</p>
                <ul className="mt-1.5 space-y-0.5 pl-6">
                  {parsed.skipped.map((s, i) => <li key={i}><b>{s.name}</b> – {s.reason}</li>)}
                </ul>
              </div>
            )}
          </Card>
        )}

        <button
          onClick={scan}
          disabled={!parsed || scanning}
          className="relative w-full overflow-hidden rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white transition duration-150 hover:bg-blue-700 active:scale-[.99] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          <span className="flex items-center justify-center gap-2">
            <ScanSearch size={16} /> {scanning ? 'Querying OSV.dev…' : 'Scan Dependencies'}
          </span>
          {scanning && <span className="anim-slide-bar absolute bottom-0 left-0 h-[3px] w-1/3 bg-violet-300" />}
        </button>
      </div>
    </>
  )
}
