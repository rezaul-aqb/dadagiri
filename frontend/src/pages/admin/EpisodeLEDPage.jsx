import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

function readLEDData(episodeId) {
  try {
    const raw = localStorage.getItem(`led_score_display_${episodeId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.users) ? parsed.users : []
  } catch {
    return []
  }
}

export default function EpisodeLEDPage() {
  const { episodeId } = useParams()
  const [users, setUsers] = useState(() => readLEDData(episodeId))

  // Poll localStorage every 2s so TV screen auto-updates when admin changes selection
  useEffect(() => {
    const interval = setInterval(() => {
      setUsers(readLEDData(episodeId))
    }, 2000)
    return () => clearInterval(interval)
  }, [episodeId])

  const sorted = [...users].sort((a, b) => b.total_score - a.total_score)

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
            <div className="lb-empty">Waiting for selection…</div>
          ) : (
            sorted.map((u) => (
              <div key={u.user_id} className="lb-row">
                <div className="lb-row-left" />
                <div className="lb-row-blue">
                  <div className="lb-col-name">{u.name}</div>
                  <div className="lb-col-district">{(u.district || '—').toUpperCase()}</div>
                </div>
                <div className="lb-row-score">{u.total_score}</div>
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
