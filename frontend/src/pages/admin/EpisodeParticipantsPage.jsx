import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/axios'

function fmtMs(ms) {
  if (ms == null || ms === 0) return '—'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const c = ms % 1000
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(c).padStart(3,'0')}`
}

function fmtSecs(secs) {
  if (secs == null) return '—'
  return fmtMs(secs * 1000)
}

export default function EpisodeParticipantsPage() {
  const { episodeId } = useParams()
  const navigate      = useNavigate()

  const [data, setData]                   = useState(null)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')
  const [selectedRound, setSelectedRound] = useState(null)
  const [search, setSearch]               = useState('')

  useEffect(() => {
    api.get(`/episodes/${episodeId}/participants`)
      .then(r => {
        setData(r.data)
        if (r.data.rounds?.length > 0) setSelectedRound(r.data.rounds[0].id)
      })
      .catch(() => setError('Failed to load participants.'))
      .finally(() => setLoading(false))
  }, [episodeId])

  if (loading) return <div className="loading-state">Loading...</div>
  if (error)   return <div className="loading-state" style={{ color: '#ef4444' }}>{error}</div>

  const { episode, participants, total, questions, rounds, question_winners } = data

  const roundQuestions = selectedRound
    ? questions.filter(q => q.round_id === selectedRound)
    : questions

  // Build userId → [Q1, Q3, ...] won labels for the active round
  const winnerQMap = {}
  roundQuestions.forEach((q, idx) => {
    const w = question_winners[String(q.id)] ?? question_winners[q.id]
    if (w) {
      if (!winnerQMap[w.user_id]) winnerQMap[w.user_id] = []
      winnerQMap[w.user_id].push(`Q${idx + 1}`)
    }
  })

  const selectedCount = Object.keys(winnerQMap).length

  const augmented = participants.map(p => ({
    ...p,
    wonQuestions: winnerQMap[p.user_id] || [],
    is_selected:  !!(winnerQMap[p.user_id]?.length),
  }))

  // Selected first, then by correct answers desc, then by time asc
  const sorted = [...augmented].sort((a, b) => {
    if (a.is_selected && !b.is_selected) return -1
    if (!a.is_selected && b.is_selected) return 1
    if ((b.total_correct ?? 0) !== (a.total_correct ?? 0)) return (b.total_correct ?? 0) - (a.total_correct ?? 0)
    return (a.total_time_seconds ?? 0) - (b.total_time_seconds ?? 0)
  })

  const filtered = sorted.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.district || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.phone || '').includes(search)
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 8 }}>
            ← Back
          </button>
          <h1 className="page-title">Participants</h1>
          <p className="page-subtitle">EP {episode.episode_no} — {episode.name}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="qr-stats" style={{ marginBottom: 20 }}>
        <div className="qr-stat-card">
          <span className="qr-stat-val">{total}</span>
          <span className="qr-stat-label">Registered</span>
        </div>
        <div className="qr-stat-card correct">
          <span className="qr-stat-val">{participants.filter(p => (p.total_correct ?? 0) > 0).length}</span>
          <span className="qr-stat-label">Answered</span>
        </div>
        <div className="qr-stat-card" style={{ borderColor: 'rgba(251,191,36,0.4)' }}>
          <span className="qr-stat-val" style={{ color: '#fbbf24' }}>{selectedCount}</span>
          <span className="qr-stat-label">Selected</span>
        </div>
        <div className="qr-stat-card">
          <span className="qr-stat-val" style={{ color: '#a5b4fc' }}>{roundQuestions.length}</span>
          <span className="qr-stat-label">Questions</span>
        </div>
      </div>

      {/* Round filter */}
      {rounds?.length > 0 && (
        <div className="ep-q-pills" style={{ marginBottom: 14 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-faint)', alignSelf: 'center', marginRight: 4 }}>Round:</span>
          <button
            className={`ep-q-pill ${!selectedRound ? 'ep-q-pill-active' : ''}`}
            onClick={() => setSelectedRound(null)}
          >
            All
          </button>
          {rounds.map(r => (
            <button
              key={r.id}
              className={`ep-q-pill ${selectedRound === r.id ? 'ep-q-pill-active' : ''}`}
              onClick={() => setSelectedRound(selectedRound === r.id ? null : r.id)}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input
          className="form-input"
          style={{ maxWidth: 300 }}
          placeholder="Search by name, district, phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <p>No participants found.</p>
        </div>
      ) : (
        <div className="ep-part-table-wrap">
          <table className="ep-part-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Phone</th>
                <th>Won</th>
                <th>Status</th>
                <th>Joined At</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const rowClass = [
                  'ep-part-played',
                  p.is_selected ? 'ep-part-selected-row' : '',
                ].filter(Boolean).join(' ')

                return (
                  <tr key={p.session_id} className={rowClass}>
                    <td className="ep-part-rank">
                      {p.is_selected
                        ? <span className="ep-sel-star">★</span>
                        : <span style={{ color: 'var(--text-faint)' }}>{i + 1}</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div>
                          <span className="ep-part-name">{p.name}</span>
                          {p.district && <span className="ep-part-district">{p.district}</span>}
                        </div>
                        {p.is_selected && <span className="ep-selected-badge">Selected</span>}
                      </div>
                    </td>
                    <td className="ep-part-phone">{p.phone || '—'}</td>
                    <td className="ep-part-won-cell">
                      {p.wonQuestions.length > 0
                        ? <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {p.wonQuestions.map(ql => (
                              <span key={ql} className="ep-won-q-badge">{ql}</span>
                            ))}
                          </div>
                        : '—'}
                    </td>
                    <td>
                      <span className={`ep-part-badge ep-part-badge-${p.is_selected ? 'selected' : 'played'}`}>
                        {p.is_selected ? 'Selected' : 'Played'}
                      </span>
                    </td>
                    <td className="ep-part-date">
                      {(p.joined_at || p.completed_at)
                        ? new Date(p.joined_at || p.completed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
