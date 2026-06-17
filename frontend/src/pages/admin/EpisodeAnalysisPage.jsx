import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/axios'

const OPTION_LABEL = { A: 'option_a', B: 'option_b', C: 'option_c', D: 'option_d' }

function formatTime(u) {
  const ms = u?.time_taken_ms ?? (u?.time_taken_seconds != null ? u.time_taken_seconds * 1000 : null)
  if (ms == null) return '—'
  const m  = Math.floor(ms / 60000)
  const s  = Math.floor((ms % 60000) / 1000)
  const c  = ms % 1000
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(c).padStart(3,'0')}`
}

export default function EpisodeAnalysisPage() {
  const { episodeId } = useParams()
  const navigate      = useNavigate()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})   // question id → bool

  useEffect(() => {
    api.get(`/episodes/${episodeId}/analysis`)
      .then(r => {
        setData(r.data)
        // expand all by default
        const init = {}
        r.data.questions.forEach(q => { init[q.id] = true })
        setExpanded(init)
      })
      .finally(() => setLoading(false))
  }, [episodeId])

  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  if (loading) return <div className="loading-state">Loading analysis...</div>
  if (!data)   return <div className="empty-state"><p>No data found.</p></div>

  const { episode, questions } = data
  const totalQ   = questions.length
  const answered = questions.filter(q => q.total_attempts > 0).length

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/admin/episodes')}
            style={{ marginBottom: 8 }}
          >
            ← Episodes
          </button>
          <h1 className="page-title">EP {episode.episode_no} — {episode.name}</h1>
          <p className="page-subtitle">Question-wise Analysis</p>
        </div>
        <div className="header-actions" style={{ gap: 8 }}>
          <div className="stat-card" style={{ padding: '10px 20px', minWidth: 0 }}>
            <div className="stat-value" style={{ fontSize: 20 }}>{totalQ}</div>
            <div className="stat-label">Questions</div>
          </div>
          <div className="stat-card" style={{ padding: '10px 20px', minWidth: 0 }}>
            <div className="stat-value" style={{ fontSize: 20 }}>{answered}</div>
            <div className="stat-label">Attempted</div>
          </div>
        </div>
      </div>

      {/* Question cards */}
      <div className="analysis-list">
        {questions.map((q, idx) => {
          const pct        = q.total_attempts > 0
            ? Math.round((q.correct_count / q.total_attempts) * 100)
            : 0
          const isOpen     = expanded[q.id]
          const difficulty = pct >= 70 ? 'easy' : pct >= 40 ? 'medium' : 'hard'

          return (
            <div key={q.id} className={`analysis-card ${q.total_attempts === 0 ? 'analysis-card-unattempted' : ''}`}>
              {/* Question header — clickable to expand/collapse */}
              <div className="analysis-q-header" onClick={() => toggle(q.id)}>
                <div className="analysis-q-left">
                  <span className="analysis-q-num">Q{idx + 1}</span>
                  <p className="analysis-q-text">{q.question_text}</p>
                </div>
                <div className="analysis-q-right">
                  {q.total_attempts > 0 && (
                    <span className={`analysis-diff analysis-diff-${difficulty}`}>
                      {pct}% correct
                    </span>
                  )}
                  {q.total_attempts === 0 && (
                    <span className="analysis-diff analysis-diff-none">Not attempted</span>
                  )}
                  <span className="analysis-toggle">{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>

              {isOpen && (
                <div className="analysis-q-body">
                  {/* Options grid — highlight correct */}
                  <div className="analysis-options">
                    {['A','B','C','D'].map(letter => (
                      <div
                        key={letter}
                        className={`analysis-opt${q.correct_answer === letter ? ' correct' : ''}`}
                      >
                        <span className="analysis-opt-k">{letter}</span>
                        <span className="analysis-opt-v">{q[OPTION_LABEL[letter]]}</span>
                        {q.correct_answer === letter && (
                          <span className="analysis-correct-tick">✓ Correct</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Stats bar */}
                  <div className="analysis-stats-row">
                    <span>{q.correct_count} correct</span>
                    <span style={{ color: 'var(--text-faint)' }}>/</span>
                    <span>{q.total_attempts} attempted</span>
                    {q.total_attempts > 0 && (
                      <>
                        <div className="analysis-bar-wrap">
                          <div
                            className="analysis-bar-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`analysis-pct analysis-diff-${difficulty}`}>{pct}%</span>
                      </>
                    )}
                  </div>

                  {/* Correct users table */}
                  {q.correct_users.length > 0 ? (
                    <table className="analysis-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Name</th>
                          <th>Phone</th>
                          <th>District</th>
                          <th>Time Taken</th>
                        </tr>
                      </thead>
                      <tbody>
                        {q.correct_users.map((u, i) => (
                          <tr key={u.user_id} className={i === 0 ? 'analysis-fastest' : ''}>
                            <td style={{ color: 'var(--text-faint)', fontWeight: 600 }}>
                              {i === 0 ? '⚡' : i + 1}
                            </td>
                            <td style={{ fontWeight: 600 }}>{u.name}</td>
                            <td>{u.phone}</td>
                            <td>{u.district || '—'}</td>
                            <td style={{ fontWeight: 600, color: i === 0 ? 'var(--success)' : 'inherit', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                              {formatTime(u)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="analysis-no-correct">No one answered this question correctly.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
