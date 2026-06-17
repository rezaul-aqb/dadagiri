import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/axios'

export default function EpisodeRoundScoresPage() {
  const { episodeId } = useParams()
  const navigate      = useNavigate()

  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [activeTab, setActiveTab] = useState(0) // index; last = district

  useEffect(() => {
    api.get(`/episodes/${episodeId}/score-sheet`)
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load score sheet.'))
      .finally(() => setLoading(false))
  }, [episodeId])

  const handleScoreSaved = (roundId, userId, questionNumber, score) => {
    setData(prev => {
      const users = prev.users.map(u => {
        if (u.user_id !== userId) return u
        const prevRound    = u.scores[roundId] ?? { questions: {}, total: 0 }
        const questions    = { ...prevRound.questions, [questionNumber]: score }
        const roundTotal   = Object.values(questions).reduce((s, v) => s + (v ?? 0), 0)
        const scores       = { ...u.scores, [roundId]: { questions, total: roundTotal } }
        const total        = Object.values(scores).reduce((s, v) => s + (v.total ?? 0), 0)
        return { ...u, scores, total_score: total }
      })
      // recompute districts
      const districtMap = {}
      users.forEach(u => {
        const d = u.district || '—'
        if (!districtMap[d]) districtMap[d] = { district: d, players: [], total_score: 0, player_count: 0 }
        districtMap[d].players.push(u)
        districtMap[d].total_score += u.total_score
      })
      const districts = Object.values(districtMap).map(d => ({
        ...d,
        player_count: d.players.length,
        top_player: [...d.players].sort((a, b) => b.total_score - a.total_score)[0],
        players: [...d.players].sort((a, b) => b.total_score - a.total_score),
      })).sort((a, b) => b.total_score - a.total_score)

      return { ...prev, users, districts }
    })
  }

  if (loading) return <div className="loading-state">Loading...</div>
  if (error)   return <div className="loading-state" style={{ color: '#ef4444' }}>{error}</div>
  if (!data)   return null

  const { episode, rounds, users, districts } = data
  const TOTAL_TAB    = rounds.length       // index after all rounds
  const DISTRICT_TAB = rounds.length + 1  // last tab

  // Per-round totals for tab header badge
  const roundTotals = rounds.map(r =>
    users.reduce((s, u) => s + (u.scores[r.id]?.total ?? 0), 0)
  )

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 8 }}>
            ← Back
          </button>
          <h1 className="page-title">Score Management</h1>
          <p className="page-subtitle">EP {episode.episode_no} — {episode.name}</p>
        </div>
      </div>

      {/* Summary bar */}
      <div className="qr-stats" style={{ marginBottom: 20 }}>
        <div className="qr-stat-card">
          <span className="qr-stat-val">{users.length}</span>
          <span className="qr-stat-label">Selected Players</span>
        </div>
        <div className="qr-stat-card" style={{ borderColor: 'rgba(129,140,248,0.4)' }}>
          <span className="qr-stat-val" style={{ color: '#818cf8' }}>
            {users.reduce((s, u) => s + u.total_score, 0)}
          </span>
          <span className="qr-stat-label">Total Points</span>
        </div>
        <div className="qr-stat-card">
          <span className="qr-stat-val" style={{ color: '#a5b4fc' }}>{districts.length}</span>
          <span className="qr-stat-label">Districts</span>
        </div>
        <div className="qr-stat-card">
          <span className="qr-stat-val" style={{ color: '#a5b4fc' }}>{rounds.length}</span>
          <span className="qr-stat-label">Rounds</span>
        </div>
      </div>

      {/* Round tabs + District tab */}
      <div className="sc-tabs">
        {rounds.map((r, i) => (
          <button
            key={r.id}
            className={`sc-tab${activeTab === i ? ' active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            <span className="sc-tab-name">{r.name}</span>
            {roundTotals[i] > 0 && (
              <span className="sc-tab-total">{roundTotals[i]} pts</span>
            )}
          </button>
        ))}
        <button
          className={`sc-tab${activeTab === TOTAL_TAB ? ' active total' : ''}`}
          onClick={() => setActiveTab(TOTAL_TAB)}
        >
          <span className="sc-tab-name">Total Score</span>
          {users.reduce((s, u) => s + u.total_score, 0) > 0 && (
            <span className="sc-tab-total" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
              {users.reduce((s, u) => s + u.total_score, 0)} pts
            </span>
          )}
        </button>
        <button
          className={`sc-tab${activeTab === DISTRICT_TAB ? ' active district' : ''}`}
          onClick={() => setActiveTab(DISTRICT_TAB)}
        >
          🗺️ District
        </button>
      </div>

      {/* Round tab content */}
      {activeTab < rounds.length && (
        <RoundScoreTab
          round={rounds[activeTab]}
          users={users}
          episodeId={Number(episodeId)}
          onScoreSaved={handleScoreSaved}
        />
      )}

      {/* Total Score tab */}
      {activeTab === TOTAL_TAB && (
        <TotalScoreTab users={users} rounds={rounds} />
      )}

      {/* District tab content */}
      {activeTab === DISTRICT_TAB && (
        <DistrictTab districts={districts} rounds={rounds} />
      )}
    </div>
  )
}

const Q_COUNT = 8

/* ── ROUND SCORE TAB ─────────────────────────────────────────── */
function RoundScoreTab({ round, users, episodeId, onScoreSaved }) {
  const roundTotal = users.reduce((s, u) => s + (u.scores[round.id]?.total ?? 0), 0)
  const maxScore   = Math.max(...users.map(u => u.scores[round.id]?.total ?? 0), 0)
  const hasScores  = users.some(u => (u.scores[round.id]?.total ?? 0) > 0)

  const sorted = [...users].sort((a, b) =>
    (b.scores[round.id]?.total ?? -1) - (a.scores[round.id]?.total ?? -1)
  )

  if (users.length === 0) return (
    <div className="empty-state" style={{ marginTop: 24 }}>
      <div className="empty-icon">👤</div>
      <p>No selected players yet for this episode.</p>
    </div>
  )

  return (
    <div className="sc-round-panel">
      <div className="sc-round-header">
        <span className="sc-round-title">{round.name}</span>
        <span className="sc-round-subtitle">{users.length} selected players</span>
      </div>

      <div className="sc-q-table">
        {/* Column headers */}
        <div className="sc-q-header">
          <span className="sc-q-col-name">Player / District</span>
          {Array.from({ length: Q_COUNT }, (_, i) => (
            <span key={i + 1} className="sc-q-col-q">Q{i + 1}</span>
          ))}
          <span className="sc-q-col-total">Total</span>
        </div>

        {/* Player rows */}
        {sorted.map((u, i) => {
          const roundScore = u.scores[round.id]
          const total      = roundScore?.total ?? 0
          const isWinner   = hasScores && total > 0 && total === maxScore
          return (
            <ScoreEntryRow
              key={u.user_id}
              rank={i + 1}
              user={u}
              questions={roundScore?.questions ?? {}}
              total={total}
              isWinner={isWinner}
              roundId={round.id}
              episodeId={episodeId}
              onSaved={onScoreSaved}
            />
          )
        })}

      </div>
    </div>
  )
}

/* ── SCORE ENTRY ROW ─────────────────────────────────────────── */
function ScoreEntryRow({ rank, user, questions, total, isWinner, roundId, episodeId, onSaved }) {
  const [vals, setVals]     = useState(() => {
    const init = {}
    for (let q = 1; q <= Q_COUNT; q++) init[q] = questions[q] != null ? String(questions[q]) : ''
    return init
  })
  const [saving, setSaving] = useState(null) // question number being saved
  const [saved,  setSaved]  = useState(null)
  const timerRef            = useRef(null)

  // Sync if parent data updates
  useEffect(() => {
    setVals(prev => {
      const next = { ...prev }
      for (let q = 1; q <= Q_COUNT; q++) {
        next[q] = questions[q] != null ? String(questions[q]) : ''
      }
      return next
    })
  }, [questions])

  const computedTotal = Object.values(vals).reduce((s, v) => {
    const n = parseFloat(v)
    return s + (isNaN(n) ? 0 : n)
  }, 0)

  const save = async (qNum, v) => {
    const num = parseFloat(v)
    if (isNaN(num) || num < 0) return
    setSaving(qNum)
    try {
      await api.post('/round-scores/update', {
        episode_id:      episodeId,
        round_id:        roundId,
        user_id:         user.user_id,
        question_number: qNum,
        score:           num,
      })
      onSaved(roundId, user.user_id, qNum, num)
      setSaved(qNum)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setSaved(null), 1500)
    } catch {}
    setSaving(null)
  }

  return (
    <div className={`sc-q-row${isWinner ? ' sc-winner' : ''}`}>
      <span className="sc-q-col-name">
        <span className="sc-player-name">
          {isWinner && <span className="sc-win-star">🏆 </span>}
          {user.name}
          {isWinner && <span className="sc-winner-tag">Winner</span>}
        </span>
        <span className="sc-col-district">{user.district || '—'}</span>
      </span>

      {Array.from({ length: Q_COUNT }, (_, i) => {
        const qNum = i + 1
        return (
          <span key={qNum} className="sc-q-col-q">
            <input
              className={`sc-q-input${isWinner ? ' winner' : ''}`}
              type="number"
              min="0"
              step="1"
              placeholder="—"
              value={vals[qNum]}
              onChange={e => setVals(p => ({ ...p, [qNum]: e.target.value }))}
              onBlur={() => {
                const prev = questions[qNum] != null ? String(questions[qNum]) : ''
                if (vals[qNum] !== '' && vals[qNum] !== prev) save(qNum, vals[qNum])
              }}
              onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
            />
            {saving === qNum && <span className="sc-saving">…</span>}
            {saved  === qNum && <span className="sc-saved">✓</span>}
          </span>
        )
      })}

      <span className={`sc-q-col-total${isWinner ? ' sc-winner-total' : ''}`}>
        {computedTotal > 0 ? computedTotal : '—'}
      </span>
    </div>
  )
}

/* ── TOTAL SCORE TAB ─────────────────────────────────────────── */
function TotalScoreTab({ users, rounds }) {
  const sorted  = [...users].sort((a, b) => b.total_score - a.total_score)
  const maxScore = sorted[0]?.total_score ?? 0
  const grandTotal = users.reduce((s, u) => s + u.total_score, 0)

  if (users.length === 0) return (
    <div className="empty-state" style={{ marginTop: 24 }}>
      <div className="empty-icon">🏅</div>
      <p>No scores entered yet.</p>
    </div>
  )

  return (
    <div className="sc-round-panel">
      <div className="sc-round-header">
        <span className="sc-round-title">Total Score</span>
        <span className="sc-round-subtitle">{users.length} players · {grandTotal} pts combined</span>
      </div>

      <div className="sc-score-list">
        {/* Header */}
        <div className="sc-score-header-row" style={{ gridTemplateColumns: '40px 1fr 140px' + rounds.map(() => ' 80px').join('') + ' 100px' }}>
          <span className="sc-col-rank">#</span>
          <span className="sc-col-name">Player</span>
          <span className="sc-col-district">District</span>
          {rounds.map(r => (
            <span key={r.id} style={{ textAlign: 'center' }} title={r.name}>
              {r.name.split(' ')[0]}
            </span>
          ))}
          <span style={{ textAlign: 'center' }}>Total</span>
        </div>

        {sorted.map((u, i) => {
          const isWinner = u.total_score > 0 && u.total_score === maxScore
          return (
            <div
              key={u.user_id}
              className={`sc-score-row${isWinner ? ' sc-winner' : ''}`}
              style={{ gridTemplateColumns: '40px 1fr 140px' + rounds.map(() => ' 80px').join('') + ' 100px' }}
            >
              <span className="sc-col-rank">
                {isWinner
                  ? <span className="sc-win-star">🏆</span>
                  : i === 1 ? <span>🥈</span>
                  : i === 2 ? <span>🥉</span>
                  : <span className="sc-rank-num">{i + 1}</span>}
              </span>
              <span className="sc-col-name">
                <span className="sc-player-name">{u.name}</span>
                {isWinner && <span className="sc-winner-tag">Winner</span>}
              </span>
              <span className="sc-col-district">{u.district || '—'}</span>
              {rounds.map(r => (
                <span key={r.id} style={{ textAlign: 'center', color: (u.scores[r.id]?.total ?? 0) > 0 ? '#818cf8' : 'var(--text-faint)', fontWeight: 600 }}>
                  {(u.scores[r.id]?.total ?? 0) > 0 ? u.scores[r.id].total : '—'}
                </span>
              ))}
              <span style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.05rem', color: isWinner ? '#22c55e' : '#f1f5f9' }}>
                {u.total_score}
              </span>
            </div>
          )
        })}

        {/* Grand total footer */}
        <div className="sc-round-footer">
          <span className="sc-footer-label">Grand Total</span>
          <span className="sc-footer-total" style={{ color: '#fbbf24' }}>{grandTotal} pts</span>
        </div>
      </div>
    </div>
  )
}

/* ── DISTRICT TAB ────────────────────────────────────────────── */
function DistrictTab({ districts, rounds }) {
  const [expanded, setExpanded] = useState({})
  const toggle = d => setExpanded(p => ({ ...p, [d]: !p[d] }))

  if (districts.length === 0) return (
    <div className="empty-state" style={{ marginTop: 24 }}>
      <div className="empty-icon">🗺️</div>
      <p>No district data yet. Enter scores first.</p>
    </div>
  )

  return (
    <div className="sc-round-panel">
      <div className="sc-round-header">
        <span className="sc-round-title">District-wise Scores</span>
        <span className="sc-round-subtitle">{districts.length} districts</span>
      </div>

      <div className="sc-district-list">
        {/* Header */}
        <div className="sc-dist-header-row">
          <span className="sc-dcol-rank">#</span>
          <span className="sc-dcol-dist">District</span>
          <span className="sc-dcol-players">Players</span>
          {rounds.map(r => (
            <span key={r.id} className="sc-dcol-round" title={r.name}>
              {r.name.split(' ')[0]}
            </span>
          ))}
          <span className="sc-dcol-total">Total</span>
          <span className="sc-dcol-expand"></span>
        </div>

        {districts.map((d, i) => (
          <React.Fragment key={d.district}>
            {/* District row */}
            <div
              className={`sc-dist-row${i === 0 ? ' sc-dist-winner' : ''}`}
              onClick={() => toggle(d.district)}
            >
              <span className="sc-dcol-rank">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="sc-rank-num">{i + 1}</span>}
              </span>
              <span className="sc-dcol-dist">
                <span className="sc-dist-name">{d.district}</span>
                {d.top_player && (
                  <span className="sc-dist-top">Top: {d.top_player.name}</span>
                )}
              </span>
              <span className="sc-dcol-players">{d.player_count}</span>
              {rounds.map(r => {
                const rTotal = d.players.reduce((s, u) => s + (u.scores[r.id]?.total ?? 0), 0)
                return <span key={r.id} className="sc-dcol-round">{rTotal || '—'}</span>
              })}
              <span className="sc-dcol-total sc-dist-total">{d.total_score}</span>
              <span className="sc-dcol-expand">{expanded[d.district] ? '▲' : '▼'}</span>
            </div>

            {/* Expanded players */}
            {expanded[d.district] && d.players.map((u, pi) => (
              <div key={u.user_id} className="sc-dist-player-row">
                <span className="sc-dcol-rank sc-rank-num">{pi + 1}</span>
                <span className="sc-dcol-dist">
                  <span className="sc-player-name">{u.name}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>{u.phone}</span>
                </span>
                <span className="sc-dcol-players">—</span>
                {rounds.map(r => (
                  <span key={r.id} className="sc-dcol-round" style={{ color: (u.scores[r.id]?.total ?? 0) > 0 ? '#818cf8' : 'var(--text-faint)' }}>
                    {(u.scores[r.id]?.total ?? 0) > 0 ? u.scores[r.id].total : '—'}
                  </span>
                ))}
                <span className="sc-dcol-total" style={{ color: '#22c55e', fontWeight: 700 }}>{u.total_score}</span>
                <span className="sc-dcol-expand"></span>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
