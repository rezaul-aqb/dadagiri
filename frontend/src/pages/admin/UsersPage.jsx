import React, { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import api from '../../api/axios'
import WB_DISTRICTS from '../../data/districts'

function formatTime(secs) {
  if (!secs && secs !== 0) return '—'
  const m = Math.floor(secs / 60), s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

/* ── Edit Modal ───────────────────────────────────────────────── */
function EditUserModal({ user, onSave, onClose }) {
  const [name,     setName]     = useState(user.name || '')
  const [phone,    setPhone]    = useState(user.phone || '')
  const [district, setDistrict] = useState(user.district || '')
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState('')
  const nameRef = useRef(null)

  useEffect(() => {
    nameRef.current?.focus()
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim())  { setErr('Name is required'); return }
    if (!phone.trim()) { setErr('Phone is required'); return }
    if (!district)     { setErr('District is required'); return }
    setSaving(true)
    setErr('')
    try {
      const res = await api.put('/user/update', {
        id: user.id,
        name: name.trim(),
        phone: phone.trim(),
        district,
      })
      onSave(res.data.user)
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '28px 32px', width: 420, maxWidth: '95vw',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
      }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.15rem', fontWeight: 700 }}>Edit User</h2>
        <p style={{ margin: '0 0 20px', fontSize: '0.8rem', color: 'var(--text-faint)' }}>
          ID #{user.id}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
              Name
            </label>
            <input
              ref={nameRef}
              className="form-input"
              style={{ width: '100%' }}
              value={name}
              onChange={e => { setName(e.target.value); setErr('') }}
              placeholder="Full name"
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
              Phone
            </label>
            <input
              className="form-input"
              style={{ width: '100%' }}
              value={phone}
              onChange={e => { setPhone(e.target.value); setErr('') }}
              placeholder="10–15 digit phone number"
              type="tel"
              inputMode="numeric"
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
              District
            </label>
            <select
              className="form-input"
              style={{ width: '100%' }}
              value={district}
              onChange={e => { setDistrict(e.target.value); setErr('') }}
            >
              <option value="">— Select district —</option>
              {WB_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {err && (
            <div style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: 8, padding: '8px 12px', color: '#fca5a5', fontSize: '0.82rem',
            }}>
              {err}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Main Page ────────────────────────────────────────────────── */
export default function UsersPage() {
  const [episodes, setEpisodes]           = useState([])
  const [selectedEp, setSelectedEp]       = useState('')
  const [users, setUsers]                 = useState([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [totalQuestions, setTotalQuestions] = useState(null)
  const [editingUser, setEditingUser]     = useState(null)

  useEffect(() => {
    api.get('/episodes').then(r => setEpisodes(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setSearch('')
    setEditingUser(null)
    const url = selectedEp ? `/admin/users?episode_id=${selectedEp}` : '/admin/users'
    api.get(url)
      .then(r => setUsers(r.data))
      .finally(() => setLoading(false))

    if (selectedEp) {
      api.get(`/results/stats?episode_id=${selectedEp}`)
        .then(r => setTotalQuestions(r.data.total_questions))
        .catch(() => setTotalQuestions(null))
    } else {
      setTotalQuestions(null)
    }
  }, [selectedEp])

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.phone.includes(search) ||
    (u.district || '').toLowerCase().includes(search.toLowerCase())
  )

  const episodeName = episodes.find(e => String(e.id) === String(selectedEp))?.name

  const handleSaved = (updated) => {
    setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, ...updated } : u))
    setEditingUser(null)
  }

  const handleExport = () => {
    const epLabel = episodeName || (selectedEp ? `Episode ${selectedEp}` : null)
    let headers, rows

    if (selectedEp) {
      headers = ['Rank', 'Name', 'Phone', 'District', 'Score', 'Time Taken', 'Completed At', 'Status']
      rows = filtered.map(u => [
        u.rank,
        u.name,
        u.phone,
        u.district || '—',
        u.score ?? 0,
        u.time_seconds != null ? formatTime(u.time_seconds) : '—',
        u.completed_at ? new Date(u.completed_at).toLocaleString() : '—',
        u.published ? 'Published' : 'Draft',
      ])
    } else {
      headers = ['#', 'Name', 'Phone', 'District', 'Score', 'Registered']
      rows = filtered.map((u, i) => [
        i + 1,
        u.name,
        u.phone,
        u.district || '—',
        u.total_score > 0 ? u.total_score : 0,
        u.created_at ? new Date(u.created_at).toLocaleDateString() : '—',
      ])
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = headers.map((h, i) => ({ wch: i === 1 ? 24 : i === 2 ? 16 : i === 6 ? 20 : 14 }))

    const wb = XLSX.utils.book_new()
    const sheetName = epLabel ? `${epLabel} Users` : 'All Users'
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    const fileName = epLabel ? `users_${epLabel.replace(/\s+/g, '_')}.xlsx` : 'users_all.xlsx'
    XLSX.writeFile(wb, fileName)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">
            {selectedEp
              ? `${users.length} participant${users.length !== 1 ? 's' : ''} — ${episodeName || `Episode ${selectedEp}`}`
              : `${users.length} registered participant${users.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-input"
            style={{ width: 200 }}
            value={selectedEp}
            onChange={e => setSelectedEp(e.target.value)}
          >
            <option value="">All Episodes</option>
            {episodes.map(ep => (
              <option key={ep.id} value={ep.id}>EP {ep.episode_no} — {ep.name}</option>
            ))}
          </select>

          <input
            className="form-input"
            style={{ width: 220 }}
            placeholder="🔍 Search name, phone, district..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <button className="btn btn-secondary" onClick={handleExport} disabled={filtered.length === 0}>
            ⬇️ Export Excel
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading users...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <p>
            {search
              ? 'No users match your search'
              : selectedEp
              ? 'No participants for this episode yet'
              : 'No users registered yet'}
          </p>
        </div>
      ) : selectedEp ? (
        /* ── Episode-scoped view ── */
        <div className="results-table-wrap">
          <table className="results-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>Phone</th>
                <th>District</th>
                <th>Score</th>
                <th>Time Taken</th>
                <th>Completed At</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className={u.rank <= 3 ? `rank-${u.rank}` : ''}>
                  <td className="rank-cell">
                    {u.rank === 1 ? '🥇' : u.rank === 2 ? '🥈' : u.rank === 3 ? '🥉' : `#${u.rank}`}
                  </td>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td>{u.phone}</td>
                  <td>{u.district || '—'}</td>
                  <td className="score-cell">
                    {u.score}{totalQuestions ? ` / ${totalQuestions}` : ''}
                  </td>
                  <td style={{ fontWeight: 500, color: u.rank === 1 ? 'var(--success)' : 'inherit' }}>
                    {formatTime(u.time_seconds)}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {u.completed_at ? new Date(u.completed_at).toLocaleString() : '—'}
                  </td>
                  <td>
                    <span className={`status-badge ${u.published ? 'active' : 'inactive'}`}>
                      {u.published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => setEditingUser(u)}>
                      ✏️ Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── All users view ── */
        <div className="results-table-wrap">
          <table className="results-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Phone</th>
                <th>District</th>
                <th>Score</th>
                <th>Registered</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id}>
                  <td style={{ color: 'var(--text-faint)' }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td>{u.phone}</td>
                  <td>{u.district || '—'}</td>
                  <td className="score-cell">{u.total_score > 0 ? u.total_score : '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => setEditingUser(u)}>
                      ✏️ Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onSave={handleSaved}
          onClose={() => setEditingUser(null)}
        />
      )}
    </div>
  )
}
