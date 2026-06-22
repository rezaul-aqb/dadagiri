import React, { useEffect, useState } from 'react'
import api from '../../api/axios'
import WB_DISTRICTS from '../../data/districts'

function formatTime(secs) {
  if (!secs && secs !== 0) return '—'
  const m = Math.floor(secs / 60), s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function UsersPage() {
  const [episodes, setEpisodes]       = useState([])
  const [selectedEp, setSelectedEp]   = useState('')
  const [users, setUsers]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [totalQuestions, setTotalQuestions] = useState(null)

  // Edit state
  const [editId,       setEditId]       = useState(null)
  const [editName,     setEditName]     = useState('')
  const [editDistrict, setEditDistrict] = useState('')
  const [saving,       setSaving]       = useState(false)
  const [saveErr,      setSaveErr]      = useState('')

  useEffect(() => {
    api.get('/episodes').then(r => setEpisodes(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setSearch('')
    cancelEdit()
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

  const startEdit = (u) => {
    setEditId(u.id)
    setEditName(u.name)
    setEditDistrict(u.district || '')
    setSaveErr('')
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditName('')
    setEditDistrict('')
    setSaveErr('')
  }

  const handleSave = async (u) => {
    if (!editName.trim()) { setSaveErr('Name is required'); return }
    if (!editDistrict)    { setSaveErr('District is required'); return }
    setSaving(true)
    setSaveErr('')
    try {
      await api.put('/user/update', { id: u.id, name: editName.trim(), district: editDistrict })
      setUsers(prev => prev.map(r => r.id === u.id
        ? { ...r, name: editName.trim(), district: editDistrict }
        : r
      ))
      cancelEdit()
    } catch {
      setSaveErr('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Inline edit row cell for name + district
  const EditCells = ({ u }) => (
    <>
      <td>
        <input
          className="form-input"
          style={{ padding: '4px 8px', fontSize: '0.85rem', width: '100%', minWidth: 130 }}
          value={editName}
          onChange={e => { setEditName(e.target.value); setSaveErr('') }}
          onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
          autoFocus
        />
      </td>
      <td>{u.phone}</td>
      <td>
        <select
          className="form-input"
          style={{ padding: '4px 8px', fontSize: '0.85rem', width: '100%', minWidth: 130 }}
          value={editDistrict}
          onChange={e => { setEditDistrict(e.target.value); setSaveErr('') }}
        >
          <option value="">-- Select --</option>
          {WB_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </td>
    </>
  )

  const EditActions = ({ u }) => (
    <td>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => handleSave(u)}
            disabled={saving}
          >
            {saving ? '...' : 'Save'}
          </button>
          <button className="btn btn-sm btn-secondary" onClick={cancelEdit} disabled={saving}>
            Cancel
          </button>
        </div>
        {saveErr && <span style={{ color: 'var(--danger)', fontSize: 11 }}>{saveErr}</span>}
      </div>
    </td>
  )

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
              <option key={ep.id} value={ep.id}>
                EP {ep.episode_no} — {ep.name}
              </option>
            ))}
          </select>

          <input
            className="form-input"
            style={{ width: 220 }}
            placeholder="🔍 Search name, phone, district..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
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
                  {editId === u.id ? (
                    <>
                      <EditCells u={u} />
                      <td className="score-cell">
                        {u.score}{totalQuestions ? ` / ${totalQuestions}` : ''}
                      </td>
                      <td style={{ fontWeight: 500 }}>{formatTime(u.time_seconds)}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {u.completed_at ? new Date(u.completed_at).toLocaleString() : '—'}
                      </td>
                      <td>
                        <span className={`status-badge ${u.published ? 'active' : 'inactive'}`}>
                          {u.published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <EditActions u={u} />
                    </>
                  ) : (
                    <>
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
                        <button className="btn btn-sm btn-secondary" onClick={() => startEdit(u)}>
                          Edit
                        </button>
                      </td>
                    </>
                  )}
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
                  {editId === u.id ? (
                    <>
                      <EditCells u={u} />
                      <td className="score-cell">{u.total_score > 0 ? u.total_score : '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <EditActions u={u} />
                    </>
                  ) : (
                    <>
                      <td style={{ fontWeight: 600 }}>{u.name}</td>
                      <td>{u.phone}</td>
                      <td>{u.district || '—'}</td>
                      <td className="score-cell">{u.total_score > 0 ? u.total_score : '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <button className="btn btn-sm btn-secondary" onClick={() => startEdit(u)}>
                          Edit
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
