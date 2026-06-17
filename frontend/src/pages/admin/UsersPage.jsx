import React, { useEffect, useState } from 'react'
import api from '../../api/axios'

function formatTime(secs) {
  if (!secs && secs !== 0) return '—'
  const m = Math.floor(secs / 60), s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function UsersPage() {
  const [episodes, setEpisodes]       = useState([])
  const [selectedEp, setSelectedEp]   = useState('')   // '' = all
  const [users, setUsers]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [totalQuestions, setTotalQuestions] = useState(null)

  // Load episodes once for the dropdown
  useEffect(() => {
    api.get('/episodes').then(r => setEpisodes(r.data)).catch(() => {})
  }, [])

  // Reload users whenever the episode filter changes
  useEffect(() => {
    setLoading(true)
    setSearch('')
    const url = selectedEp ? `/admin/users?episode_id=${selectedEp}` : '/admin/users'
    api.get(url)
      .then(r => setUsers(r.data))
      .finally(() => setLoading(false))

    // Fetch total questions for that episode to show "X / Y" score
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
          {/* Episode filter */}
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

          {/* Search */}
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
        /* ── Episode-scoped view: rank + score ── */
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
