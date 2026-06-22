import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../api/axios'

export default function EpisodeLEDPage() {
  const { episodeId } = useParams()
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get(`/results?episode_id=${episodeId}`),
    ]).then(([r]) => {
      setResults(r.data)
    }).finally(() => setLoading(false))
  }, [episodeId])

  const sorted = [...results].sort((a, b) =>
    b.total_correct - a.total_correct || a.total_time_seconds - b.total_time_seconds
  )

  if (loading) {
    return (
      <div style={{ background: '#020830', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.5rem' }}>
        Loading...
      </div>
    )
  }

  return (
    <div className="lb-overlay" style={{ position: 'fixed' }}>
      <div className="lb-bg" />
      <div className="lb-grid" />

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
            <span className="lb-th-score">SCORE</span>
          </div>
        </div>

        <div className="lb-rows">
          {sorted.length === 0 ? (
            <div className="lb-empty">No results yet.</div>
          ) : (
            sorted.map((r) => (
              <div key={r.id} className="lb-row">
                <div className="lb-row-left" />
                <div className="lb-row-blue">
                  <div className="lb-col-name">{r.user?.name}</div>
                  <div className="lb-col-district">{(r.user?.district || '—').toUpperCase()}</div>
                </div>
                <div className="lb-row-score">{r.total_correct}</div>
                <div className="lb-row-right" />
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
