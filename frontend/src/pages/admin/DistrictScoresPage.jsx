import React, { useEffect, useState } from 'react'
import api from '../../api/axios'

export default function DistrictScoresPage() {
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    api.get('/district-scores')
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load district scores.'))
      .finally(() => setLoading(false))
  }, [])

  const toggle = d => setExpanded(p => ({ ...p, [d]: !p[d] }))

  if (loading) return <div className="loading-state">Loading...</div>
  if (error)   return <div className="loading-state" style={{ color: '#ef4444' }}>{error}</div>
  if (!data)   return null

  const { episodes, districts } = data
  const maxScore = districts[0]?.total_score ?? 0

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">District Scores</h1>
          <p className="page-subtitle">{districts.length} districts · across {episodes.length} episode{episodes.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {districts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🗺️</div>
          <p>No scores entered yet. Enter scores in the Score Management section first.</p>
        </div>
      ) : (
        <div className="ds-table-wrap">
          {/* Header */}
          <div className="ds-header-row ds-simple">
            <span className="ds-col-rank">#</span>
            <span className="ds-col-district">District</span>
            <span className="ds-col-total">Total Score</span>
            <span className="ds-col-expand"></span>
          </div>

          {districts.map((d, i) => {
            const isLeader = d.total_score > 0 && d.total_score === maxScore
            const isOpen   = expanded[d.district]

            // Collect all players across all episodes for this district
            const allPlayers = {}
            episodes.forEach(ep => {
              const players = d.by_episode[ep.id]?.players ?? []
              players.forEach(p => {
                if (!allPlayers[p.user_id]) allPlayers[p.user_id] = { ...p, total: 0 }
                allPlayers[p.user_id].total += p.score
              })
            })
            const playerList = Object.values(allPlayers).sort((a, b) => b.total - a.total)

            return (
              <React.Fragment key={d.district}>
                {/* District row */}
                <div
                  className={`ds-row ds-simple${isLeader ? ' ds-leader' : ''}`}
                  onClick={() => toggle(d.district)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="ds-col-rank">
                    {isLeader
                      ? <span className="ds-crown">🏆</span>
                      : i === 1 ? <span>🥈</span>
                      : i === 2 ? <span>🥉</span>
                      : <span className="ds-rank-num">{i + 1}</span>}
                  </span>
                  <span className="ds-col-district">
                    <span className="ds-dist-name">{d.district}</span>
                    {isLeader && <span className="ds-leader-tag">Leader</span>}
                  </span>
                  <span className={`ds-col-total${isLeader ? ' ds-leader-score' : ''}`}>
                    {d.total_score > 0 ? d.total_score : '—'}
                  </span>
                  <span className="ds-col-expand">{isOpen ? '▲' : '▼'}</span>
                </div>

                {/* Expanded: player list */}
                {isOpen && (
                  <div className="ds-players-panel">
                    <div className="ds-players-header">
                      <span className="ds-ph-name">Player</span>
                      <span className="ds-ph-score">Score</span>
                    </div>
                    {playerList.length === 0 ? (
                      <div style={{ padding: '12px 24px', color: 'var(--text-faint)', fontSize: '0.85rem' }}>
                        No players yet
                      </div>
                    ) : playerList.map((p, pi) => (
                      <div key={p.user_id} className={`ds-player-row${pi === 0 && p.total > 0 ? ' ds-player-top' : ''}`}>
                        <span className="ds-player-rank">
                          {pi === 0 && p.total > 0 ? '🏅' : <span className="ds-rank-num">{pi + 1}</span>}
                        </span>
                        <span className="ds-player-name">{p.name}</span>
                        <span className="ds-player-score">{p.total > 0 ? p.total : '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
