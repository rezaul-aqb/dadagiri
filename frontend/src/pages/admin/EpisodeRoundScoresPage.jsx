import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/axios'

function fmtMs(ms) {
  if (!ms) return '—'
  const s   = Math.floor(ms / 1000)
  const m   = Math.floor(s / 60)
  const ss  = s % 60
  const mmm = ms % 1000
  return m > 0
    ? `${m}:${String(ss).padStart(2,'0')}.${String(mmm).padStart(3,'0')}`
    : `${ss}.${String(mmm).padStart(3,'0')}s`
}

export default function EpisodeRoundScoresPage() {
  const { episodeId } = useParams()
  const navigate      = useNavigate()

  const [data, setData]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [activeRound, setActiveRound] = useState(0)

  const load = () => {
    setLoading(true)
    api.get(`/episodes/${episodeId}/round-scores`)
      .then(r => { setData(r.data); setActiveRound(prev => prev) })
      .catch(() => setError('Failed to load round scores.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [episodeId])

  const handleScoreSaved = (roundIdx, userId, score, note) => {
    setData(prev => {
      const rounds = prev.rounds.map((r, i) => {
        if (i !== roundIdx) return r
        return {
          ...r,
          participants: r.participants.map(p =>
            p.user_id === userId ? { ...p, manual_score: score, score_note: note } : p
          ),
        }
      })
      return { ...prev, rounds }
    })
  }

  if (loading) return <div className="loading-state">Loading...</div>
  if (error)   return <div className="loading-state" style={{ color: '#ef4444' }}>{error}</div>
  if (!data)   return null

  const { episode, rounds } = data

  if (!rounds.length) return (
    <div className="page">
      <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 12 }}>← Back</button>
      <div className="empty-state">
        <div className="empty-icon">📊</div>
        <p>No round data available yet for this episode.</p>
      </div>
    </div>
  )

  const round = rounds[activeRound]

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 8 }}>
            ← Back
          </button>
          <h1 className="page-title">Round Scores</h1>
          <p className="page-subtitle">EP {episode.episode_no} — {episode.name}</p>
        </div>
      </div>

      {/* Round tabs */}
      <div className="rs-round-tabs">
        {rounds.map((r, i) => (
          <button
            key={r.id}
            className={`rs-round-tab${activeRound === i ? ' active' : ''}`}
            onClick={() => setActiveRound(i)}
          >
            {r.name}
            {r.type === 'toss' && <span className="rs-tab-badge toss">Toss</span>}
            {r.requires_selection && r.type !== 'toss' && <span className="rs-tab-badge sel">⭐</span>}
          </button>
        ))}
      </div>

      <RoundScorePanel
        key={round.id}
        round={round}
        roundIdx={activeRound}
        episodeId={Number(episodeId)}
        onScoreSaved={handleScoreSaved}
      />
    </div>
  )
}

function RoundScorePanel({ round, roundIdx, episodeId, onScoreSaved }) {
  const { participants, questions, type } = round

  const totalPlayers  = participants.length
  const selectedCount = participants.filter(p => p.is_selected).length
  const avgCorrect    = totalPlayers
    ? (participants.reduce((s, p) => s + p.correct, 0) / totalPlayers).toFixed(1)
    : 0
  const totalScore    = participants.reduce((s, p) => s + (p.manual_score ?? 0), 0)

  return (
    <div className="rs-panel">
      <div className="qr-stats" style={{ marginBottom: 20 }}>
        <div className="qr-stat-card">
          <span className="qr-stat-val">{totalPlayers}</span>
          <span className="qr-stat-label">Players</span>
        </div>
        <div className="qr-stat-card" style={{ borderColor: 'rgba(251,191,36,0.4)' }}>
          <span className="qr-stat-val" style={{ color: '#fbbf24' }}>{selectedCount}</span>
          <span className="qr-stat-label">Won a Q</span>
        </div>
        <div className="qr-stat-card correct">
          <span className="qr-stat-val">{avgCorrect}</span>
          <span className="qr-stat-label">Avg Correct</span>
        </div>
        <div className="qr-stat-card" style={{ borderColor: 'rgba(129,140,248,0.4)' }}>
          <span className="qr-stat-val" style={{ color: '#818cf8' }}>{totalScore}</span>
          <span className="qr-stat-label">Total Pts</span>
        </div>
      </div>

      {participants.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <p>No participants have played this round yet.</p>
        </div>
      ) : (
        <div className="rs-table-wrap">
          <table className="rs-table">
            <thead>
              <tr>
                <th className="rs-th-rank">#</th>
                <th>Player</th>
                <th>District</th>
                {questions.map((q, i) => (
                  <th key={q.id} className="rs-th-q" title={q.text}>Q{i + 1}</th>
                ))}
                <th className="rs-th-score">Correct</th>
                <th className="rs-th-time">Time</th>
                <th className="rs-th-pts">Points</th>
                <th className="rs-th-note">Note</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {participants.map(p => (
                <ScoreRow
                  key={p.user_id}
                  participant={p}
                  questions={questions}
                  roundId={round.id}
                  roundIdx={roundIdx}
                  episodeId={episodeId}
                  onSaved={onScoreSaved}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ScoreRow({ participant: p, questions, roundId, roundIdx, episodeId, onSaved }) {
  const [editing, setEditing]   = useState(false)
  const [scoreVal, setScoreVal] = useState(p.manual_score ?? '')
  const [noteVal, setNoteVal]   = useState(p.score_note ?? '')
  const [saving, setSaving]     = useState(false)
  const scoreRef = useRef(null)

  const startEdit = () => {
    setScoreVal(p.manual_score ?? '')
    setNoteVal(p.score_note ?? '')
    setEditing(true)
    setTimeout(() => scoreRef.current?.focus(), 50)
  }

  const cancel = () => {
    setEditing(false)
    setScoreVal(p.manual_score ?? '')
    setNoteVal(p.score_note ?? '')
  }

  const save = async () => {
    const score = scoreVal === '' ? 0 : parseFloat(scoreVal)
    if (isNaN(score)) return
    setSaving(true)
    try {
      await api.post('/round-scores/update', {
        episode_id: episodeId,
        round_id:   roundId,
        user_id:    p.user_id,
        score,
        note: noteVal || null,
      })
      onSaved(roundIdx, p.user_id, score, noteVal || null)
      setEditing(false)
    } catch {}
    setSaving(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') cancel()
  }

  return (
    <tr className={`rs-row${p.is_selected ? ' rs-row-winner' : ''}`}>
      <td className="rs-td-rank">
        {p.rank === 1 ? <span className="rs-gold">🥇</span>
          : p.rank === 2 ? <span className="rs-silver">🥈</span>
          : p.rank === 3 ? <span className="rs-bronze">🥉</span>
          : <span className="rs-rank-num">{p.rank}</span>}
      </td>
      <td>
        <div className="rs-player-cell">
          <span className="rs-player-name">{p.name}</span>
          {p.is_selected && <span className="rs-winner-tag">⭐ Selected</span>}
        </div>
      </td>
      <td className="rs-td-district">{p.district || '—'}</td>
      {questions.map(q => {
        const ans = p.answers[q.id]
        if (!ans) return <td key={q.id} className="rs-td-q rs-ans-none">—</td>
        return (
          <td key={q.id}
              className={`rs-td-q ${ans.correct ? 'rs-ans-correct' : 'rs-ans-wrong'}`}
              title={`${ans.chosen || '—'} • ${fmtMs(ans.time_ms)}`}>
            {ans.correct ? <span className="rs-tick">✓</span> : <span className="rs-cross">✗</span>}
            {p.won_q_ids.includes(q.id) && <span className="rs-fastest">⚡</span>}
          </td>
        )
      })}
      <td className="rs-td-score">
        <span className="rs-score-val">{p.correct}</span>
        <span className="rs-score-total">/{questions.length}</span>
      </td>
      <td className="rs-td-time">{fmtMs(p.total_ms)}</td>

      {/* Editable score */}
      <td className="rs-td-pts">
        {editing ? (
          <input
            ref={scoreRef}
            className="rs-score-input"
            type="number"
            step="0.5"
            value={scoreVal}
            onChange={e => setScoreVal(e.target.value)}
            onKeyDown={handleKey}
            style={{ width: 64 }}
          />
        ) : (
          <span
            className={`rs-pts-val${p.manual_score != null ? ' rs-pts-set' : ' rs-pts-empty'}`}
            onClick={startEdit}
            title="Click to edit score"
          >
            {p.manual_score != null ? p.manual_score : '—'}
          </span>
        )}
      </td>

      {/* Editable note */}
      <td className="rs-td-note">
        {editing ? (
          <input
            className="rs-note-input"
            type="text"
            placeholder="Optional note…"
            value={noteVal}
            onChange={e => setNoteVal(e.target.value)}
            onKeyDown={handleKey}
            maxLength={120}
          />
        ) : (
          <span
            className="rs-note-val"
            onClick={startEdit}
            title={p.score_note || 'Click to add note'}
          >
            {p.score_note || <span style={{ opacity: 0.3 }}>—</span>}
          </span>
        )}
      </td>

      <td>
        {editing ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
              {saving ? '…' : 'Save'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={cancel} disabled={saving}>✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {p.is_selected
              ? <span className="ep-part-badge ep-part-badge-selected">Selected</span>
              : <span className="ep-part-badge ep-part-badge-played">Played</span>}
            <button className="rs-edit-btn" onClick={startEdit} title="Edit score">✏️</button>
          </div>
        )}
      </td>
    </tr>
  )
}
