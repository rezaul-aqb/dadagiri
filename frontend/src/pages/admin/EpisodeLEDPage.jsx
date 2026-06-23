import React, { useEffect, useRef, useState } from 'react'
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
  const { episodeId }   = useParams()
  const [users, setUsers] = useState(() => readLEDData(episodeId))
  const [isFS, setIsFS]   = useState(false)
  const wrapRef           = useRef(null)

  // Auto-request fullscreen on mount
  useEffect(() => {
    const el = wrapRef.current
    if (el?.requestFullscreen) {
      el.requestFullscreen().catch(() => {})
    } else if (el?.webkitRequestFullscreen) {
      el.webkitRequestFullscreen()
    }
  }, [])

  // Track fullscreen state changes
  useEffect(() => {
    const onChange = () => setIsFS(!!document.fullscreenElement || !!document.webkitFullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  // Poll localStorage every 2s so TV screen auto-updates when admin changes selection
  useEffect(() => {
    const interval = setInterval(() => setUsers(readLEDData(episodeId)), 2000)
    return () => clearInterval(interval)
  }, [episodeId])

  const toggleFullscreen = () => {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)
    } else {
      const el = wrapRef.current
      if (el?.requestFullscreen) el.requestFullscreen().catch(() => {})
      else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen()
    }
  }

  const sorted = [...users].sort((a, b) => b.total_score - a.total_score)

  return (
    <div ref={wrapRef} className="lb-overlay" style={{ position: 'fixed', cursor: 'pointer' }} onClick={toggleFullscreen}>
      <div className="lb-bg" />
      <div className="lb-grid" />

      {/* Fullscreen hint */}
      {!isFS && (
        <div style={{
          position: 'absolute', bottom: 18, right: 22, zIndex: 10,
          color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', letterSpacing: '0.05em',
          pointerEvents: 'none',
        }}>
          Click to enter fullscreen
        </div>
      )}

      <div className="lb-board" onClick={e => e.stopPropagation()}>
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
