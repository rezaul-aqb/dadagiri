import React, { useEffect, useState } from 'react'
import api from '../../api/axios'

export default function DistrictScoresPage() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
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

  const { rounds, episodes, districts } = data
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
          <div className="ds-header-row">
            <span className="ds-col-rank">#</span>
            <span className="ds-col-district">District</span>
            {rounds.map(r => (
              <span key={r.id} className="ds-col-round" title={r.name}>
                {r.name.replace(' Round', '').replace('Bapi Bari Ja', 'Bapi')}
              </span>
            ))}
            <span className="ds-col-total">Total</span>
            <span className="ds-col-expand"></span>
          </div>

          {districts.map((d, i) => {
            const isLeader  = d.total_score > 0 && d.total_score === maxScore
            const isOpen    = expanded[d.district]
            // sum across all episodes per round
            const roundTotals = rounds.map(r =>
              episodes.reduce((s, ep) => s + (d.by_episode[ep.id]?.rounds[r.id] ?? 0), 0)
            )

            return (
              <React.Fragment key={d.district}>
                {/* District row */}
                <div
                  className={`ds-row${isLeader ? ' ds-leader' : ''}`}
                  onClick={() => toggle(d.district)}
                  style={{ cursor: episodes.length > 1 ? 'pointer' : 'default' }}
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
                  {roundTotals.map((val, ri) => (
                    <span key={rounds[ri].id} className="ds-col-round" style={{ color: val > 0 ? '#818cf8' : 'var(--text-faint)', fontWeight: 700 }}>
                      {val > 0 ? val : '—'}
                    </span>
                  ))}
                  <span className={`ds-col-total${isLeader ? ' ds-leader-score' : ''}`}>
                    {d.total_score > 0 ? d.total_score : '—'}
                  </span>
                  <span className="ds-col-expand">
                    {episodes.length > 1 ? (isOpen ? '▲' : '▼') : ''}
                  </span>
                </div>

                {/* Episode breakdown (expanded) */}
                {isOpen && episodes.map(ep => {
                  const epData    = d.by_episode[ep.id]
                  const epRounds  = rounds.map(r => epData?.rounds[r.id] ?? 0)
                  const epTotal   = epData?.total ?? 0
                  return (
                    <div key={ep.id} className="ds-episode-row">
                      <span className="ds-col-rank"></span>
                      <span className="ds-col-district" style={{ paddingLeft: 24 }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                          EP {ep.episode_no} — {ep.name}
                        </span>
                      </span>
                      {epRounds.map((val, ri) => (
                        <span key={rounds[ri].id} className="ds-col-round" style={{ color: val > 0 ? '#a5b4fc' : 'var(--text-faint)', fontSize: '0.85rem' }}>
                          {val > 0 ? val : '—'}
                        </span>
                      ))}
                      <span className="ds-col-total" style={{ color: epTotal > 0 ? '#a5b4fc' : 'var(--text-faint)', fontSize: '0.9rem' }}>
                        {epTotal > 0 ? epTotal : '—'}
                      </span>
                      <span className="ds-col-expand"></span>
                    </div>
                  )
                })}
              </React.Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
