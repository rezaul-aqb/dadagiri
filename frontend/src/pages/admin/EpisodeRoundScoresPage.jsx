import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/axios'

export default function EpisodeRoundScoresPage() {
  const { episodeId } = useParams()
  const navigate      = useNavigate()

  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [activeTab, setActiveTab] = useState(0)
  const [checkedUsers, setCheckedUsers] = useState(new Set())

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

  const toggleCheck = userId => {
    setCheckedUsers(prev => {
      const next = new Set(prev)
      next.has(userId) ? next.delete(userId) : next.add(userId)
      return next
    })
  }

  // Sync to localStorage whenever selection or scores change
  useEffect(() => {
    if (!data?.users) return
    const allRounds  = data.rounds || []
    const selected   = data.users.filter(u => checkedUsers.has(u.user_id))
    localStorage.setItem(`led_score_display_${episodeId}`, JSON.stringify({
      episodeId,
      rounds: allRounds.map(r => ({ id: r.id, name: r.name })),
      users: selected.map(u => ({
        user_id:     u.user_id,
        name:        u.name,
        district:    u.district,
        total_score: u.total_score,
        round_scores: Object.fromEntries(
          allRounds.map(r => [r.id, u.scores?.[r.id]?.total ?? 0])
        ),
      })),
    }))
  }, [checkedUsers, data, episodeId])

  const handleShowLED = () => {
    window.open(`/dadagiri/admin/episodes/${episodeId}/led`, '_blank')
  }

  if (loading) return <div className="loading-state">Loading...</div>
  if (error)   return <div className="loading-state" style={{ color: '#ef4444' }}>{error}</div>
  if (!data)   return null

  const { episode, rounds, users, districts } = data
  const TOTAL_TAB    = rounds.length
  const DISTRICT_TAB = rounds.length + 1

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
        {checkedUsers.size > 0 && (
          <button className="btn btn-led" onClick={handleShowLED}>
            📺 Show on LED ({checkedUsers.size})
          </button>
        )}
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
          checkedUsers={checkedUsers}
          onToggleCheck={toggleCheck}
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

/* ── ROUND SCORE TAB ─────────────────────────────────────────── */
function RoundScoreTab({ round, users, episodeId, onScoreSaved, checkedUsers, onToggleCheck }) {
  const scores    = users.map(u => u.scores[round.id]?.total ?? null)
  const entered   = scores.filter(s => s !== null)
  const maxScore  = entered.length ? Math.max(...entered) : 0
  const hasScores = entered.length > 0

  const sorted = [...users].sort((a, b) =>
    (b.scores[round.id]?.total ?? -Infinity) - (a.scores[round.id]?.total ?? -Infinity)
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
        <div className="sc-q-header sc-single-score-grid">
          <span className="sc-q-col-check"></span>
          <span className="sc-q-col-name">Player / District</span>
          <span className="sc-q-col-total" style={{ textAlign: 'center' }}>Score</span>
          <span className="sc-q-col-total sc-q-col-alltotal">All Total</span>
        </div>

        {/* Player rows */}
        {sorted.map((u, i) => {
          const roundScore = u.scores[round.id]
          const total      = roundScore?.total ?? null
          const isWinner   = hasScores && total !== null && total === maxScore
          return (
            <ScoreEntryRow
              key={u.user_id}
              rank={i + 1}
              user={u}
              savedScore={roundScore?.questions?.[1] ?? null}
              total={total}
              allTotal={u.total_score}
              isWinner={isWinner}
              roundId={round.id}
              episodeId={episodeId}
              onSaved={onScoreSaved}
              checked={checkedUsers.has(u.user_id)}
              onToggleCheck={onToggleCheck}
            />
          )
        })}
      </div>
    </div>
  )
}

/* ── SCORE ENTRY ROW ─────────────────────────────────────────── */
function ScoreEntryRow({ rank, user, savedScore, total, allTotal, isWinner, roundId, episodeId, onSaved, checked, onToggleCheck }) {
  const [val,     setVal]     = useState(savedScore != null ? String(savedScore) : '')
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const timerRef              = useRef(null)

  // Sync when parent data updates
  useEffect(() => {
    setVal(savedScore != null ? String(savedScore) : '')
  }, [savedScore])

  const save = async (v) => {
    const num = parseFloat(v)
    if (isNaN(num)) return
    setSaving(true)
    try {
      await api.post('/round-scores/update', {
        episode_id:      episodeId,
        round_id:        roundId,
        user_id:         user.user_id,
        question_number: 1,
        score:           num,
      })
      onSaved(roundId, user.user_id, 1, num)
      setSaved(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setSaved(false), 1500)
    } catch {}
    setSaving(false)
  }

  return (
    <div className={`sc-q-row sc-single-score-grid${isWinner ? ' sc-winner' : ''}`}>
      <span className="sc-q-col-check">
        <input
          type="checkbox"
          className="sc-led-check"
          checked={checked}
          onChange={() => onToggleCheck(user.user_id)}
          title="Show on LED"
        />
      </span>
      <span className="sc-q-col-name">
        <span className="sc-player-name">
          {user.name}
        </span>
        <span className="sc-col-district">{user.district || '—'}</span>
      </span>

      <span className="sc-q-col-total" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
        <input
          className={`sc-q-input sc-single-input${isWinner ? ' winner' : ''}`}
          type="number"
          step="any"
          placeholder="—"
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={() => {
            const prev = savedScore != null ? String(savedScore) : ''
            if (val !== '' && val !== prev) save(val)
          }}
          onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
        />
        {saving && <span className="sc-saving">…</span>}
        {saved  && <span className="sc-saved">✓</span>}
      </span>

      <span className="sc-q-col-total sc-q-col-alltotal" style={{ color: allTotal !== 0 ? '#fbbf24' : 'var(--text-faint)', fontWeight: 800 }}>
        {allTotal !== 0 ? allTotal : '—'}
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
