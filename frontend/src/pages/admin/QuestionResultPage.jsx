import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/axios'

function fmtTime(r) {
  const ms = r.time_taken_ms != null
    ? r.time_taken_ms
    : r.time_taken_seconds != null ? r.time_taken_seconds * 1000 : null
  if (ms == null) return '—'
  const s = Math.floor(ms / 1000)
  const c = Math.floor((ms % 1000) / 10)
  return `${s}.${String(c).padStart(2, '0')}s`
}

function fmtScore(r) {
  const ms = r.time_taken_ms != null
    ? r.time_taken_ms
    : r.time_taken_seconds != null ? r.time_taken_seconds * 1000 : null
  if (!r.is_correct) return null
  if (ms == null) return '✓'
  return String(Math.round(ms / 100))
}

function LedDisplay({ data, onClose }) {
  const { results } = data

  return (
    <div className="lb-overlay">
      <div className="lb-bg" />
      <div className="lb-grid" />
      <button className="lb-close" onClick={onClose}>✕</button>

      <div className="lb-board">

        {/* Top stripe decorations */}
        <div className="lb-top-deco">
          <div className="lb-deco-tl" />
          <div className="lb-deco-tr" />
        </div>

        {/* Header */}
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

        {/* Rows */}
        <div className="lb-rows">
          {results.length === 0 ? (
            <div className="lb-empty">No answers yet.</div>
          ) : (
            results.map((r) => (
              <div key={r.user_id} className={`lb-row ${r.is_correct ? '' : 'lb-row-wrong'}`}>
                <div className="lb-row-left" />
                <div className="lb-row-blue">
                  <div className="lb-col-name">{r.name}</div>
                  <div className="lb-col-district">{(r.district || '—').toUpperCase()}</div>
                </div>
                <div className={`lb-row-score ${!r.is_correct ? 'lb-score-wrong' : ''}`}>
                  {r.is_correct ? fmtTime(r) : '✗'}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom stripe decorations */}
        <div className="lb-bot-deco">
          <div className="lb-deco-bl" />
          <div className="lb-deco-br" />
        </div>

      </div>
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
