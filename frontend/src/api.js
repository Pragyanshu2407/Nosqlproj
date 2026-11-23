// Thin wrapper around fetch for the Flask API.
async function request(path, options) {
  let res
  try {
    res = await fetch('/api' + path, options)
  } catch {
    throw new Error('Cannot reach the backend. Is the Flask server running on port 5001?')
  }
  let data = null
  try { data = await res.json() } catch { /* non-JSON response */ }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}

export const api = {
  dashboard: (projectId) => request('/dashboard' + (projectId ? `?project_id=${projectId}` : '')),
  projects: () => request('/projects'),
  results: (projectId) => request('/results' + (projectId ? `?project_id=${projectId}` : '')),
  vulnerability: (id, pkg, eco) =>
    request(`/vulnerabilities/${encodeURIComponent(id)}?package=${encodeURIComponent(pkg)}&ecosystem=${eco}`),
  parse: (file) => {
    const form = new FormData()
    form.append('file', file)
    return request('/parse', { method: 'POST', body: form })
  },
  scan: (payload) =>
    request('/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
}
