import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/axios'

function formatTime(secs) {
  if (!secs && secs !== 0) return '—'
  const s = Math.floor(secs)
  const cs = Math.round((secs - s) * 100)
  return `${s}.${String(cs).padStart(2, '0')}s`
}

export default function EpisodeResultsPage() {
  const { episodeId } = useParams()
  const navigate      = useNavigate()
  const [episode, setEpisode]       = useState(null)
  const [results, setResults]       = useState([])
  const [stats, setStats]           = useState(null)
  const [loading, setLoading]       = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [msg, setMsg]               = useState('')
  const [showLED, setShowLED]       = useState(false)
  const [editingTime, setEditingTime] = useState({}) // sessionId → draft string
  const [savingTime, setSavingTime]   = useState({}) // sessionId → bool

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get(`/episodes/${episodeId}`),
      api.get(`/results?episode_id=${episodeId}`),
      api.get(`/results/stats?episode_id=${episodeId}`),
    ]).then(([ep, r, s]) => {
      setEpisode(ep.data)
      setResults(r.data)
      setStats(s.data)
    }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [episodeId])

  const handlePublish = async () => {
    setPublishing(true)
    await api.post('/results/publish', { episode_id: parseInt(episodeId) })
    setMsg('Results published!')
    load()
    setPublishing(false)
  }

  const handleSaveTime = async (sessionId) => {
    const raw = editingTime[sessionId]
    if (raw === undefined) return
    const num = parseFloat(raw)
    if (isNaN(num) || num < 0) return
    setSavingTime(prev => ({ ...prev, [sessionId]: true }))
    try {
      await api.post('/results/update-time', { session_id: sessionId, time_seconds: num })
      setResults(prev => prev.map(r =>
        r.id === sessionId ? { ...r, total_time_seconds: num } : r
      ))
      setEditingTime(prev => { const n = { ...prev }; delete n[sessionId]; return n })
    } catch {
      alert('Failed to update time.')
    }
    setSavingTime(prev => ({ ...prev, [sessionId]: false }))
  }

  const handleUnpublish = async () => {
    setPublishing(true)
    await api.post('/results/unpublish', { episode_id: parseInt(episodeId) })
    setMsg('Results unpublished')
    load()
    setPublishing(false)
  }

  if (loading) return <div className="loading-state">Loading...</div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/episodes')} style={{ marginBottom: 8 }}>
            ← Episodes
          </button>
          <h1 className="page-title">EP {episode?.episode_no} — {episode?.name} Results</h1>
          <p className="page-subtitle">{stats?.total_participants || 0} participants</p>
        </div>
        <div className="header-actions">
          {results.length > 0 && (
            <button className="btn btn-led" onClick={() => setShowLED(true)}>
              📺 Display on LED
            </button>
          )}
          {stats?.published ? (
            <button className="btn btn-secondary" onClick={handleUnpublish} disabled={publishing}>Unpublish</button>
          ) : (
            <button className="btn btn-primary" onClick={handlePublish} disabled={publishing}>
              🚀 Publish Results
            </button>
          )}
        </div>
      </div>

      {msg && <div className="alert alert-success" onClick={() => setMsg('')}>{msg}</div>}

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total_participants}</div>
            <div className="stat-label">Participants</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.total_questions}</div>
            <div className="stat-label">Questions</div>
          </div>
          <div className="stat-card">
            <div className={`stat-value ${stats.published ? 'text-green' : 'text-orange'}`}>
              {stats.published ? 'Published' : 'Draft'}
            </div>
            <div className="stat-label">Status</div>
          </div>
        </div>
      )}

      {results.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏆</div>
          <p>No completed sessions for this episode yet</p>
        </div>
      ) : (
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
              {results.map(r => (
                <tr key={r.id} className={r.rank <= 3 ? `rank-${r.rank}` : ''}>
                  <td className="rank-cell">
                    {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `#${r.rank}`}
                  </td>
                  <td style={{ fontWeight: 600 }}>{r.user?.name}</td>
                  <td>{r.user?.phone}</td>
                  <td>{r.user?.district || '—'}</td>
                  <td className="score-cell">{r.total_correct} / {stats?.total_questions}</td>
                  <td style={{ fontWeight: 500 }}>
                    {editingTime[r.id] !== undefined ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-input"
                          style={{ width: 90, padding: '3px 6px', fontSize: '0.85rem' }}
                          value={editingTime[r.id]}
                          onChange={e => setEditingTime(prev => ({ ...prev, [r.id]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveTime(r.id)
                            if (e.key === 'Escape') setEditingTime(prev => { const n = { ...prev }; delete n[r.id]; return n })
                          }}
                          onBlur={() => handleSaveTime(r.id)}
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>s</span>
                        {savingTime[r.id] && <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>…</span>}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: r.rank === 1 ? 'var(--success)' : 'inherit' }}>
                          {formatTime(r.total_time_seconds)}
                        </span>
                        <button
                          onClick={() => setEditingTime(prev => ({ ...prev, [r.id]: String(r.total_time_seconds) }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: '0.8rem', padding: '0 2px', lineHeight: 1 }}
                          title="Edit time"
                        >✏️</button>
                      </div>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {r.completed_at ? new Date(r.completed_at).toLocaleString() : '—'}
                  </td>
                  <td>
                    <span className={`status-badge ${r.published ? 'active' : 'inactive'}`}>
                      {r.published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showLED && (
        <LEDModal results={results} onClose={() => setShowLED(false)} />
      )}
    </div>
  )
}

/* ── LED Popup Modal ─────────────────────────────────── */
function LEDModal({ results, onClose }) {
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', fn)
      document.body.style.overflow = ''
    }
  }, [])

  const sorted = [...results].sort((a, b) =>
    b.total_correct - a.total_correct || a.total_time_seconds - b.total_time_seconds
  )

  return (
    <div className="lb-overlay">
      <div className="lb-bg" />
      <div className="lb-grid" />
      <button className="lb-close" onClick={onClose}>✕</button>

      <div className="lb-board">
        <div className="lb-top-deco">
          <div className="lb-deco-tl" />
          <div className="lb-deco-tr" />
        </div>

        <div className="lb-thead">
          <div className="lb-thead-accent" />
          <div className="lb-thead-main">
            <span className="lb-th-name">NAME</span>
            <span className="lb-th-district">DISTRICT</span>
          </div>
          <div className="lb-thead-score">
            <span className="lb-th-score">TIME</span>
          </div>
        </div>

        <div className="lb-rows">
          {sorted.length === 0 ? (
            <div className="lb-empty">No results yet.</div>
          ) : (
            sorted.map((r) => (
              <div key={r.id} className="lb-row">
                <div className="lb-row-left" />
                <div className="lb-row-blue">
                  <div className="lb-col-name">{r.user?.name}</div>
                  <div className="lb-col-district">{(r.user?.district || '—').toUpperCase()}</div>
                </div>
                <div className="lb-row-score">{formatTime(r.total_time_seconds)}</div>
              </div>
            ))
          )}
        </div>

        <div className="lb-bot-deco">
          <div className="lb-deco-bl" />
          <div className="lb-deco-br" />
        </div>
      </div>
    </div>
  )
}
