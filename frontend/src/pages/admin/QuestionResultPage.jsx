import React, { useEffect, useRef, useState } from 'react'
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

function LedDisplay({ results, onClose }) {
  return (
    <div className="lb-overlay lb-led-transparent">
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
          {results.length === 0 ? (
            <div className="lb-empty">No users selected.</div>
          ) : (
            results.map((r) => (
              <div key={r.answer_id ?? r.user_id} className={`lb-row ${r.is_correct ? '' : 'lb-row-wrong'}`} style={!r.is_correct ? { opacity: 0.8 } : {}}>
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
  const [data, setData]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [ledOpen, setLedOpen]         = useState(false)
  const [checked, setChecked]         = useState(new Set()) // Set of answer_id
  const [editingTime, setEditingTime] = useState({})
  const [savingTime, setSavingTime]   = useState({})
  const [resetting, setResetting]     = useState(false)
  const selectAllRef                  = useRef(null)

  useEffect(() => {
    api.get(`/questions/${questionId}/result`)
      .then(res => {
        setData(res.data)
        // Default: all checked
        const ids = new Set(res.data.results.map(r => r.answer_id ?? r.user_id))
        setChecked(ids)
      })
      .catch(() => setError('Failed to load results.'))
      .finally(() => setLoading(false))
  }, [questionId])

  // Keep indeterminate state on select-all checkbox
  useEffect(() => {
    if (!selectAllRef.current || !data) return
    const total = data.results.length
    const n = checked.size
    selectAllRef.current.indeterminate = n > 0 && n < total
  }, [checked, data])

  const getKey = r => r.answer_id ?? r.user_id

  const toggleAll = () => {
    const allKeys = data.results.map(getKey)
    if (checked.size === allKeys.length) {
      setChecked(new Set())
    } else {
      setChecked(new Set(allKeys))
    }
  }

  const toggleOne = (key) => {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const handleSaveTime = async (answerId) => {
    const raw = editingTime[answerId]
    if (raw === undefined) return
    const num = parseFloat(raw)
    if (isNaN(num) || num < 0) return
    setSavingTime(prev => ({ ...prev, [answerId]: true }))
    try {
      await api.post('/answers/update-time', { answer_id: answerId, time_seconds: num })
      const ms = Math.round(num * 1000)
      setData(prev => {
        const updated = prev.results.map(r =>
          r.answer_id === answerId
            ? { ...r, time_taken_ms: ms, time_taken_seconds: num }
            : r
        )
        const sorted = [...updated].sort((a, b) => {
          if (b.is_correct !== a.is_correct) return b.is_correct - a.is_correct
          const msA = a.time_taken_ms ?? (a.time_taken_seconds != null ? a.time_taken_seconds * 1000 : Infinity)
          const msB = b.time_taken_ms ?? (b.time_taken_seconds != null ? b.time_taken_seconds * 1000 : Infinity)
          return msA - msB
        })
        return { ...prev, results: sorted }
      })
      setEditingTime(prev => { const n = { ...prev }; delete n[answerId]; return n })
    } catch {
      alert('Failed to update time.')
    }
    setSavingTime(prev => ({ ...prev, [answerId]: false }))
  }

  const handleReset = async () => {
    if (!window.confirm('Delete all answers for this question? This cannot be undone.')) return
    setResetting(true)
    try {
      await api.delete(`/questions/${questionId}/answers`)
      setData(prev => ({ ...prev, results: [], total: 0, correct_count: 0 }))
      setChecked(new Set())
    } catch {
      alert('Failed to reset answers.')
    } finally {
      setResetting(false)
    }
  }

  if (loading) return <div className="loading-state">Loading...</div>
  if (error)   return <div className="loading-state" style={{ color: '#ef4444' }}>{error}</div>

  const { question, results, total, correct_count } = data
  const ledResults = results.filter(r => checked.has(getKey(r)))
  const allChecked = checked.size === results.length

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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="btn btn-danger"
            onClick={handleReset}
            disabled={resetting || results.length === 0}
          >
            {resetting ? 'Resetting…' : '🗑️ Reset Answers'}
          </button>
          <button className="btn btn-led" onClick={() => setLedOpen(true)}>
            💡 LED Display{checked.size < results.length ? ` (${checked.size})` : ''}
          </button>
        </div>
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
                <th style={{ width: 36, textAlign: 'center' }}>
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    title={allChecked ? 'Deselect all' : 'Select all'}
                    style={{ cursor: 'pointer', width: 16, height: 16 }}
                  />
                </th>
                <th>#</th>
                <th>Name</th>
                <th>Answer</th>
                <th>Time Taken</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const key = getKey(r)
                const isChecked = checked.has(key)
                return (
                  <tr key={key} className={r.is_correct ? 'qr-row-correct' : 'qr-row-wrong'} style={{ opacity: isChecked ? 1 : 0.45 }}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(key)}
                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                      />
                    </td>
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
                    <td className="qr-time">
                      {editingTime[r.answer_id] !== undefined ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            autoFocus
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-input"
                            style={{ width: 80, padding: '3px 6px', fontSize: '0.85rem' }}
                            value={editingTime[r.answer_id]}
                            onChange={e => setEditingTime(prev => ({ ...prev, [r.answer_id]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveTime(r.answer_id)
                              if (e.key === 'Escape') setEditingTime(prev => { const n = { ...prev }; delete n[r.answer_id]; return n })
                            }}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>s</span>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ padding: '3px 10px', fontSize: '0.8rem' }}
                            disabled={savingTime[r.answer_id]}
                            onClick={() => handleSaveTime(r.answer_id)}
                          >
                            {savingTime[r.answer_id] ? '…' : 'Submit'}
                          </button>
                          <button
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: '0.8rem', padding: '0 2px' }}
                            onClick={() => setEditingTime(prev => { const n = { ...prev }; delete n[r.answer_id]; return n })}
                          >✕</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{fmtTime(r)}</span>
                          <button
                            onClick={() => {
                              const ms = r.time_taken_ms != null ? r.time_taken_ms : (r.time_taken_seconds != null ? r.time_taken_seconds * 1000 : null)
                              const secs = ms != null ? (ms / 1000).toFixed(2) : ''
                              setEditingTime(prev => ({ ...prev, [r.answer_id]: secs }))
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: '0.8rem', padding: '0 2px', lineHeight: 1 }}
                            title="Edit time"
                          >✏️</button>
                        </div>
                      )}
                    </td>
                    <td className="qr-result">
                      {r.is_correct
                        ? <span className="qr-tick">✓</span>
                        : <span className="qr-cross">✗</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {ledOpen && <LedDisplay results={ledResults} onClose={() => setLedOpen(false)} />}
    </div>
  )
}
