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
  const [selecting, setSelecting]         = useState({})   // userId → bool (loading)
  const [editingWonId, setEditingWonId]   = useState(null) // userId whose Won is being edited
  const [togglingQ, setTogglingQ]         = useState({})   // questionId → bool (saving)

  useEffect(() => {
    api.get(`/episodes/${episodeId}/participants`)
      .then(r => {
        setData(r.data)
        if (r.data.rounds?.length > 0) setSelectedRound(r.data.rounds[0].id)
      })
      .catch(() => setError('Failed to load participants.'))
      .finally(() => setLoading(false))
  }, [episodeId])

  const handleSelectToggle = async (p, value) => {
    const selected = value === 'selected'
    setSelecting(prev => ({ ...prev, [p.user_id]: true }))
    try {
      await api.post(`/episodes/${episodeId}/select-user`, { user_id: p.user_id, selected })
      setData(prev => ({
        ...prev,
        participants: prev.participants.map(pt =>
          pt.user_id === p.user_id ? { ...pt, is_manually_selected: selected ? 1 : 0 } : pt
        ),
      }))
    } catch {
      alert('Failed to update selection. Please try again.')
    } finally {
      setSelecting(prev => ({ ...prev, [p.user_id]: false }))
    }
  }

  const handleWonToggle = async (p, q, qIdx, currentlyWon) => {
    const qId = q.id
    setTogglingQ(prev => ({ ...prev, [qId]: true }))
    const newWon = !currentlyWon
    try {
      await api.post(`/episodes/${episodeId}/question-winner`, {
        question_id: qId,
        user_id: p.user_id,
        won: newWon,
      })
      setData(prev => {
        const newWinners = { ...prev.question_winners }
        if (newWon) {
          newWinners[qId] = { user_id: p.user_id, time_ms: 0 }
        } else {
          delete newWinners[qId]
        }
        return { ...prev, question_winners: newWinners }
      })
    } catch {
      alert('Failed to update. Please try again.')
    } finally {
      setTogglingQ(prev => ({ ...prev, [qId]: false }))
    }
  }

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
    wonQuestions:        winnerQMap[p.user_id] || [],
    is_selected:         !!(winnerQMap[p.user_id]?.length) || !!p.is_manually_selected,
    is_manually_selected: !!p.is_manually_selected,
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
                <th>Selection</th>
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
                      {editingWonId === p.user_id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {roundQuestions.map((q, idx) => {
                              const isWon = (question_winners[String(q.id)] ?? question_winners[q.id])?.user_id === p.user_id
                              return (
                                <button
                                  key={q.id}
                                  onClick={() => handleWonToggle(p, q, idx, isWon)}
                                  disabled={!!togglingQ[q.id]}
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: togglingQ[q.id] ? 'wait' : 'pointer',
                                    border: isWon ? '2px solid #fbbf24' : '2px solid rgba(255,255,255,0.15)',
                                    background: isWon ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.05)',
                                    color: isWon ? '#fbbf24' : 'var(--text-muted)',
                                    opacity: togglingQ[q.id] ? 0.5 : 1,
                                  }}
                                >
                                  Q{idx + 1}
                                </button>
                              )
                            })}
                          </div>
                          <button
                            className="btn btn-sm btn-secondary"
                            style={{ alignSelf: 'flex-start', padding: '2px 10px', fontSize: '0.75rem' }}
                            onClick={() => setEditingWonId(null)}
                          >
                            Done
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                          {p.wonQuestions.length > 0
                            ? p.wonQuestions.map(ql => (
                                <span key={ql} className="ep-won-q-badge">{ql}</span>
                              ))
                            : <span style={{ color: 'var(--text-faint)' }}>—</span>
                          }
                          <button
                            onClick={() => setEditingWonId(p.user_id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0 4px', lineHeight: 1 }}
                            title="Edit won questions"
                          >
                            ✏️
                          </button>
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`ep-part-badge ep-part-badge-${p.is_selected ? 'selected' : 'played'}`}>
                        {p.is_selected ? 'Selected' : 'Played'}
                      </span>
                    </td>
                    <td>
                      <select
                        className="form-input"
                        style={{ padding: '4px 8px', fontSize: '0.8rem', minWidth: 130 }}
                        value={p.is_manually_selected ? 'selected' : 'not_selected'}
                        onChange={e => handleSelectToggle(p, e.target.value)}
                        disabled={!!selecting[p.user_id]}
                      >
                        <option value="not_selected">— Not Selected</option>
                        <option value="selected">✓ Selected</option>
                      </select>
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
