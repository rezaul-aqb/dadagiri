import React, { useEffect, useState } from 'react'
import api from '../api/axios'

export default function ResultsPage() {
  const [results, setResults] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [message, setMessage] = useState('')

  const fetchData = () => {
    setLoading(true)
    Promise.all([api.get('/results'), api.get('/results/stats')])
      .then(([r, s]) => {
        setResults(r.data)
        setStats(s.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const handlePublish = async () => {
    setPublishing(true)
    try {
      await api.post('/results/publish')
      setMessage('Results published successfully!')
      fetchData()
    } catch {
      setMessage('Failed to publish results')
    } finally {
      setPublishing(false)
    }
  }

  const handleUnpublish = async () => {
    setPublishing(true)
    try {
      await api.post('/results/unpublish')
      setMessage('Results unpublished')
      fetchData()
    } catch {
      setMessage('Failed to unpublish results')
    } finally {
      setPublishing(false)
    }
  }

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Results & Leaderboard</h1>
          <p className="page-subtitle">
            {stats ? `${stats.total_participants} participants` : 'Loading...'}
          </p>
        </div>
        <div className="header-actions">
          {stats?.published ? (
            <button className="btn btn-secondary" onClick={handleUnpublish} disabled={publishing}>
              {publishing ? '...' : 'Unpublish Results'}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handlePublish} disabled={publishing}>
              {publishing ? '...' : '🚀 Publish Results'}
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="alert alert-success" onClick={() => setMessage('')}>{message}</div>
      )}

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total_participants}</div>
            <div className="stat-label">Total Participants</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.total_questions}</div>
            <div className="stat-label">Questions</div>
          </div>
          <div className="stat-card">
            <div className={`stat-value ${stats.published ? 'text-green' : 'text-orange'}`}>
              {stats.published ? 'Published' : 'Draft'}
            </div>
            <div className="stat-label">Results Status</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-state">Loading results...</div>
      ) : results.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏆</div>
          <p>No completed quiz sessions yet</p>
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
                <th>Correct</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className={r.rank <= 3 ? `rank-${r.rank}` : ''}>
                  <td className="rank-cell">
                    {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `#${r.rank}`}
                  </td>
                  <td>{r.user?.name}</td>
                  <td>{r.user?.phone}</td>
                  <td>{r.user?.district || '—'}</td>
                  <td className="score-cell">{r.total_correct} / {stats?.total_questions}</td>
                  <td>{formatTime(r.total_time_seconds)}</td>
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
