import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/axios'

function fmtTime(r) {
  const ms = r.time_taken_ms != null
    ? r.time_taken_ms
    : r.time_taken_seconds != null ? r.time_taken_seconds * 1000 : null
  if (ms == null) return '—'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const c = ms % 1000
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(c).padStart(3,'0')}`
}

function LedParticles() {
  const balls = Array.from({ length: 18 }, (_, i) => i)
  return (
    <div className="led-particles" aria-hidden="true">
      {balls.map(i => (
        <span key={i} className={`led-particle led-p-${i % 6}`} style={{ '--i': i }} />
      ))}
      <div className="led-orb led-orb-1" />
      <div className="led-orb led-orb-2" />
      <div className="led-orb led-orb-3" />
      <div className="led-pitch" />
    </div>
  )
}

function LedDisplay({ data, onClose }) {
  const { question, results, total, correct_count } = data

  return (
    <div className="led-overlay">
      <LedParticles />

      <div className="led-content">
        {/* Header */}
        <div className="led-header">
          <img
            src={import.meta.env.BASE_URL + 'logo.png'}
            alt="Dadagiri Unlimited"
            className="led-logo-img"
          />
        </div>

        {/* Leaderboard */}
        <div className="led-board-wrap">
          {results.length === 0 ? (
            <p className="led-empty">No answers yet.</p>
          ) : (
            <table className="led-board">
              <thead>
                <tr>
                  <th className="led-col-rank">Rank</th>
                  <th className="led-col-name">Player</th>
                  <th className="led-col-time">Time</th>
                  <th className="led-col-res">Result</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const rank = r.is_correct
                    ? results.filter((x, xi) => x.is_correct && xi <= i).length
                    : null
                  return (
                    <tr key={r.user_id} className={r.is_correct ? 'led-row-correct' : 'led-row-wrong'}>
                      <td className="led-col-rank">
                        {rank === 1 && <span className="led-trophy">🏆</span>}
                        {rank === 2 && <span className="led-trophy">🥈</span>}
                        {rank === 3 && <span className="led-trophy">🥉</span>}
                        {rank !== null && rank > 3 && <span className="led-rank-num">#{rank}</span>}
                        {rank === null && <span className="led-rank-dash">—</span>}
                      </td>
                      <td className="led-col-name">
                        <span className="led-player-name">{r.name}</span>
                        {r.district && <span className="led-player-district">{r.district}</span>}
                      </td>
                      <td className="led-col-time">{fmtTime(r)}</td>
                      <td className="led-col-res">
                        {r.is_correct
                          ? <span className="led-tick">✓</span>
                          : <span className="led-cross">✗</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <button className="led-close" onClick={onClose} title="Close">✕</button>
    </div>
  )
}

export default function QuestionResultPage() {
  const { questionId } = useParams()
  const navigate = useNavigate()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [ledOpen, setLedOpen] = useState(false)

  useEffect(() => {
    api.get(`/questions/${questionId}/result`)
      .then(res => setData(res.data))
      .catch(() => setError('Failed to load results.'))
      .finally(() => setLoading(false))
  }, [questionId])

  if (loading) return <div className="loading-state">Loading...</div>
  if (error)   return <div className="loading-state" style={{ color: '#ef4444' }}>{error}</div>

  const { question, results, total, correct_count } = data

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 8 }}>
            ← Back
          </button>
          <h1 className="page-title">Question Result</h1>
          <p className="page-subtitle qr-question-text">{question.question_text}</p>
        </div>
        <button className="btn btn-led" onClick={() => setLedOpen(true)}>
          💡 LED Display
        </button>
      </div>

      {/* Stats */}
      <div className="qr-stats">
        <div className="qr-stat-card">
          <span className="qr-stat-val">{total}</span>
          <span className="qr-stat-label">Total Answered</span>
        </div>
        <div className="qr-stat-card correct">
          <span className="qr-stat-val">{correct_count}</span>
          <span className="qr-stat-label">Correct</span>
        </div>
        <div className="qr-stat-card wrong">
          <span className="qr-stat-val">{total - correct_count}</span>
          <span className="qr-stat-label">Wrong / Skipped</span>
        </div>
        <div className="qr-stat-card">
          <span className="qr-stat-val" style={{ color: '#a5b4fc' }}>{question.correct_answer}</span>
          <span className="qr-stat-label">Correct Answer</span>
        </div>
      </div>

      {/* User list */}
      {results.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <p>No one has answered this question yet.</p>
        </div>
      ) : (
        <div className="qr-table-wrap">
          <table className="qr-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Answer</th>
                <th>Time Taken</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={r.user_id} className={r.is_correct ? 'qr-row-correct' : 'qr-row-wrong'}>
                  <td className="qr-rank">
                    {r.is_correct ? (
                      <span className="qr-rank-num">{results.filter((x, xi) => x.is_correct && xi <= i).length}</span>
                    ) : (
                      <span className="qr-rank-dash">—</span>
                    )}
                  </td>
                  <td className="qr-name">
                    <span>{r.name}</span>
                    {r.district && <span className="qr-district">{r.district}</span>}
                  </td>
                  <td>
                    <span className={`qr-answer-badge qr-ans-${r.chosen_answer?.toLowerCase() || 'none'}`}>
                      {r.chosen_answer || '—'}
                    </span>
                  </td>
                  <td className="qr-time">{fmtTime(r)}</td>
                  <td className="qr-result">
                    {r.is_correct
                      ? <span className="qr-tick">✓</span>
                      : <span className="qr-cross">✗</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ledOpen && <LedDisplay data={data} onClose={() => setLedOpen(false)} />}
    </div>
  )
}
