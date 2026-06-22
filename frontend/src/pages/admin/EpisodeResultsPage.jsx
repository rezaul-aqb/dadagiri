import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../api/axios'

function formatTime(secs) {
  if (!secs && secs !== 0) return '—'
  const m = Math.floor(secs / 60), s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
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
            <Link
              to={`/admin/episodes/${episodeId}/led`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-led"
            >
              📺 Display on LED
            </Link>
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
                  <td style={{ fontWeight: 500, color: r.rank === 1 ? 'var(--success)' : 'inherit' }}>
                    {formatTime(r.total_time_seconds)}
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

    </div>
  )
}
