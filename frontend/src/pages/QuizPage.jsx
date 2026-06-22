import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'

const DEFAULT_Q_TIME = 30

export default function QuizPage() {
  const navigate = useNavigate()

  // ── Refs (safe to read inside async callbacks / intervals) ────────
  const sessionRef     = useRef(null)
  const userRef        = useRef(null)
  const episodeRef     = useRef(null)
  const questionsRef   = useRef([])
  const qTimeRef       = useRef(DEFAULT_Q_TIME)
  const phaseRef       = useRef('loading')
  const liveQRef       = useRef(null)       // mirrors liveQuestion state
  const answeredMapRef = useRef({})         // { [question_id]: answer object }
  const prevLiveIdRef  = useRef(null)       // last live ID seen by poller
  const startRef       = useRef(0)
  const lockedRef      = useRef(false)
  const timerRef       = useRef(null)
  const roundNameRef   = useRef(null)

  // ── State ─────────────────────────────────────────────────────────
  const [phase, setPhaseRaw]    = useState('loading')
  const setPhase = (p) => { phaseRef.current = p; setPhaseRaw(p) }

  const [episode, setEpisode]         = useState(null)
  const [user, setUser]               = useState(null)
  const [error, setError]             = useState('')
  const [liveQuestion, setLiveQState] = useState(null)
  const [roundName, setRoundName]     = useState(null)
  const [elapsedMs, setElapsedMs]     = useState(0)
  const [selected, setSelected]       = useState(null)
  const [doneCount, setDoneCount]     = useState(0)

  // ── Toss round state ──────────────────────────────────────────────
  const [tossQuestion, setTossQuestion]   = useState(null)
  const [tossEligible, setTossEligible]   = useState(false)
  const [tossAnswer,   setTossAnswer]     = useState('')
  const [tossSubmitted, setTossSubmitted] = useState(false)
  const [tossSubmitting, setTossSubmitting] = useState(false)
  const prevTossIdRef   = useRef(null)
  const tossEligChecked = useRef(false)

  // ── Selection status (checked after each answered question) ──────
  const [isSelected, setIsSelected] = useState(false)
  const isSelectedRef = useRef(false)
  const setIsSelectedSync = (val) => { isSelectedRef.current = val; setIsSelected(val) }

  const setLiveQuestion = (q) => { liveQRef.current = q; setLiveQState(q) }

  // ── Init ──────────────────────────────────────────────────────────
  useEffect(() => {
    const raw = sessionStorage.getItem('quiz_user')
    if (!raw) { navigate('/register'); return }
    const u = JSON.parse(raw)
    setUser(u)
    userRef.current = u

    api.get('/quiz/active-episode')
      .then(res => {
        setEpisode(res.data)
        episodeRef.current = res.data
        qTimeRef.current   = res.data.time_per_question || DEFAULT_Q_TIME
        questionsRef.current = res.data.questions
        setPhase('waiting')
        // Check if user is already selected (e.g. returning player who won before)
        api.get(`/toss/eligibility?episode_id=${res.data.id}&user_id=${u.id}`)
          .then(r => {
            if (r.data.eligible) {
              setIsSelectedSync(true)
              setTossEligible(true)
              tossEligChecked.current = true
            }
          })
          .catch(() => {})
      })
      .catch(err => {
        if (err.response?.status !== 404) setError('Failed to load quiz. Please try again.')
        setPhase('noEpisode')
      })
  }, [])

  // ── Lazy session creation (called when first question goes live) ──
  const ensureSession = async () => {
    if (sessionRef.current) return true
    try {
      const res = await api.post('/quiz/start', {
        user_id:    userRef.current.id,
        episode_id: episodeRef.current.id,
      })
      sessionRef.current = res.data.session_id
      return true
    } catch (err) {
      if (err.response?.status === 409) setPhase('alreadyCompleted')
      return false
    }
  }

  // ── Save a single answer immediately to DB ───────────────────────
  const saveAnswer = async (answerObj) => {
    try {
      await api.post('/quiz/answer', {
        session_id:         sessionRef.current,
        user_id:            userRef.current.id,
        question_id:        answerObj.question_id,
        chosen_answer:      answerObj.chosen_answer,
        time_taken_ms:      answerObj.time_taken_ms,
        time_taken_seconds: answerObj.time_taken_seconds,
      })
    } catch {}
  }

  // ── Complete the session (tally from DB) ─────────────────────────
  const completeSession = async () => {
    try {
      await api.post('/quiz/complete', {
        session_id: sessionRef.current,
        user_id:    userRef.current.id,
      })
    } catch {}
    setPhase('done')
  }

  // ── Record an answer, save immediately, then complete if all done ─
  const recordAnswer = (chosen) => {
    clearInterval(timerRef.current)
    const q = liveQRef.current
    if (!q) return

    // Already answered this question (e.g. double-trigger guard)
    if (answeredMapRef.current[q.id]) return

    const ms = Math.min(Date.now() - startRef.current, qTimeRef.current * 1000)
    const answerObj = {
      question_id:        q.id,
      chosen_answer:      chosen,
      time_taken_ms:      ms,
      time_taken_seconds: Math.floor(ms / 1000),
    }
    answeredMapRef.current[q.id] = answerObj

    // Persist immediately — don't wait for the full quiz to end
    saveAnswer(answerObj)

    const newCount = Object.keys(answeredMapRef.current).length
    setDoneCount(newCount)

    if (newCount >= questionsRef.current.length) {
      setPhase('submitting')
      completeSession()
    } else {
      setPhase('waiting')
      // Check if this answer made the user selected (winner) for next round
      if (episodeRef.current && userRef.current && !isSelected) {
        api.get(`/toss/eligibility?episode_id=${episodeRef.current.id}&user_id=${userRef.current.id}`)
          .then(r => {
            if (r.data.eligible) {
              setIsSelectedSync(true)
              setTossEligible(true)           // pre-set so toss screen is ready instantly
              tossEligChecked.current = true  // skip re-check when toss question appears
            }
          })
          .catch(() => {})
      }
    }
  }

  // ── Poll for live question (admin-controlled) ─────────────────────
  useEffect(() => {
    const poll = async () => {
      try {
        const res   = await api.get('/quiz/live')
        const lq    = res.data || null
        const newId = lq?.id ?? null

        const sameQuestion = newId === prevLiveIdRef.current
        prevLiveIdRef.current = newId

        if (newId && !answeredMapRef.current[newId] && episodeRef.current) {
          if (lq?.round_name) { roundNameRef.current = lq.round_name; setRoundName(lq.round_name) }

          // Non-selected user on a restricted round → watching only
          if (lq?.round_requires_selection && !isSelectedRef.current) {
            if (phaseRef.current !== 'watching') setPhase('watching')
            return
          }

          // Always update liveQuestion so admin-toggled option visibility refreshes immediately
          const ok = await ensureSession()
          if (!ok) return
          setLiveQuestion(lq)
          if (sameQuestion) return  // same question already playing — only refresh data, don't reset timer/state
          setSelected(null)
          lockedRef.current = false
          // Use server's live_started_at to avoid client poll-latency skew
          startRef.current = lq.live_started_at
            ? new Date(lq.live_started_at).getTime()
            : Date.now()
          setElapsedMs(Date.now() - startRef.current)
          setPhase('playing')
        } else if (!newId) {
          if (phaseRef.current === 'playing') {
            // Admin stopped the question while user was still answering
            lockedRef.current = true
            recordAnswer(null)
          } else if (phaseRef.current === 'watching') {
            setPhase('waiting')
          }
        }
      } catch {}
    }

    poll()
    const id = setInterval(poll, 1500)
    return () => clearInterval(id)
  }, [])

  // ── Poll for live toss question ──────────────────────────────────
  useEffect(() => {
    const poll = async () => {
      if (!episodeRef.current) return
      try {
        const res = await api.get('/toss/live')
        const tq  = res.data || null
        const newId = tq?.id ?? null

        if (newId !== prevTossIdRef.current) {
          prevTossIdRef.current = newId
          setTossQuestion(tq)
          if (tq && !tossEligChecked.current && userRef.current && episodeRef.current) {
            tossEligChecked.current = true
            try {
              const er = await api.get(`/toss/eligibility?episode_id=${episodeRef.current.id}&user_id=${userRef.current.id}`)
              setTossEligible(er.data.eligible)
            } catch {}
          }
          if (!tq) {
            tossEligChecked.current = false
            setTossSubmitted(false)
            setTossAnswer('')
          }
        } else if (tq && newId === prevTossIdRef.current) {
          // Same question — update hints in place
          setTossQuestion(tq)
        }
      } catch {}
    }
    poll()
    const id = setInterval(poll, 1500)
    return () => clearInterval(id)
  }, [])

  // ── Toss answer submission ────────────────────────────────────────
  const handleTossSubmit = async () => {
    if (!tossAnswer.trim() || tossSubmitting || tossSubmitted) return
    setTossSubmitting(true)
    try {
      await api.post('/toss/answer', {
        toss_question_id: tossQuestion.id,
        episode_id:       episodeRef.current.id,
        user_id:          userRef.current.id,
        answer:           tossAnswer.trim().toUpperCase(),
      })
      setTossSubmitted(true)
    } catch {}
    setTossSubmitting(false)
  }

  // ── Timer (active only while playing) ────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') { clearInterval(timerRef.current); return }

    const id = setInterval(() => {
      const ms = Date.now() - startRef.current
      setElapsedMs(ms)
      if (ms >= qTimeRef.current * 1000 && !lockedRef.current) {
        lockedRef.current = true
        recordAnswer(null)
      }
    }, 50)

    timerRef.current = id
    return () => clearInterval(id)
  }, [phase])

  // ── User taps an option ───────────────────────────────────────────
  const handleSelect = (opt) => {
    if (lockedRef.current || selected !== null) return
    lockedRef.current = true
    clearInterval(timerRef.current)
    setSelected(opt)
    setTimeout(() => recordAnswer(opt), 700)
  }

  // ── Logout ────────────────────────────────────────────────────────
  const handleLogout = () => {
    sessionStorage.removeItem('quiz_user')
    navigate('/')
  }

  // ── Stopwatch formatter ───────────────────────────────────────────
  const fmtStopwatch = (ms) => {
    const m   = Math.floor(ms / 60000)
    const s   = Math.floor((ms % 60000) / 1000)
    const mss = ms % 1000
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(mss).padStart(3,'0')}`
  }

  // ── Screens ───────────────────────────────────────────────────────
  const total = questionsRef.current.length

  // ── Toss round screen (overrides normal flow when live) ──────────
  if (tossQuestion && phase !== 'loading' && phase !== 'noEpisode') {
    const hints = [1,2,3,4,5,6].map(n => ({
      n,
      text: tossQuestion[`hint_${n}`],
      shown: tossQuestion[`show_hint_${n}`] == 1,
    })).filter(h => h.text)

    const answerLen = (tossQuestion.answer || '').replace(/ /g, '').length

    return (
      <div className="toss-user-screen">
        <div className="toss-user-header">
          <img src={import.meta.env.BASE_URL + 'logo.png'} alt="Dadagiri" className="toss-user-logo" />
          <div className="toss-user-round-badge">🎯 Toss Round</div>
        </div>

        <div className="toss-user-body">
          {/* Question */}
          {tossQuestion.question_text && (
            <div className="toss-user-question">{tossQuestion.question_text}</div>
          )}

          {/* Hints */}
          <div className="toss-user-hints">
            {hints.map(h => (
              <div key={h.n} className={`toss-user-hint${h.shown ? ' visible' : ' hidden'}`}>
                <span className="toss-user-hint-num">Hint {h.n}</span>
                <span className="toss-user-hint-text">{h.shown ? h.text : '?'}</span>
              </div>
            ))}
          </div>

          {/* Answer boxes (blank — shows letter count) */}
          <div className="toss-user-answer-boxes">
            {Array.from({ length: answerLen }).map((_, i) => (
              <span key={i} className="toss-user-ans-box" />
            ))}
          </div>

          {/* Input section for eligible users */}
          {tossEligible ? (
            tossSubmitted ? (
              <div className="toss-user-submitted">
                <div className="toss-submitted-icon">✓</div>
                <p>Answer submitted!</p>
                <p className="quiz-muted">Wait for the host to announce the result.</p>
              </div>
            ) : (
              <div className="toss-user-input-wrap">
                <input
                  className="toss-user-input"
                  type="text"
                  placeholder="Type your answer…"
                  value={tossAnswer}
                  onChange={e => setTossAnswer(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTossSubmit()}
                  autoFocus
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                />
                <button
                  className="toss-user-submit-btn"
                  onClick={handleTossSubmit}
                  disabled={!tossAnswer.trim() || tossSubmitting}
                >
                  {tossSubmitting ? 'Submitting…' : 'Submit Answer'}
                </button>
              </div>
            )
          ) : (
            <div className="toss-user-watching">
              <p>Watching — you are not in this round.</p>
            </div>
          )}
        </div>

        <div className="quiz-name-row" style={{ padding: '0 16px 16px' }}>
          <div className="toss-user-name">{user?.name}</div>
          <button className="quiz-logout-btn" onClick={handleLogout}>← Exit</button>
        </div>
      </div>
    )
  }

  if (phase === 'watching') return (
    <div className="quiz-screen">
      <div className="quiz-watching-card">
        <img src={import.meta.env.BASE_URL + "logo.png"} alt="Dadagiri" className="quiz-logo-sm" />
        <div className="quiz-watching-icon">👀</div>
        <h2 className="quiz-watching-title">{roundName || 'Next Round'}</h2>
        <p className="quiz-watching-msg">This round is for selected participants only.</p>
        <p className="quiz-muted">You can watch along — better luck next time!</p>
        <div className="quiz-name-row" style={{ marginTop: 24 }}>
          <div className="quiz-name-tag">{user?.name}</div>
          <button className="quiz-logout-btn" onClick={handleLogout}>← Exit</button>
        </div>
      </div>
    </div>
  )

  if (phase === 'loading') return (
    <div className="quiz-screen">
      <div className="quiz-center">
        <span className="quiz-spinner" />
        <p>Loading quiz...</p>
      </div>
    </div>
  )

  if (phase === 'noEpisode') return (
    <div className="quiz-screen">
      <div className="quiz-msg-card">
        <img src={import.meta.env.BASE_URL + "logo.png"} alt="Dadagiri" className="quiz-logo-sm" />
        <div className="quiz-msg-icon">🎬</div>
        <h2>No Quiz Available</h2>
        <p>There's no active episode right now. Check back soon!</p>
        {error && <p className="quiz-err-txt">{error}</p>}
        <button className="quiz-logout-btn" onClick={handleLogout} style={{ marginTop: 20 }}>← Exit</button>
      </div>
    </div>
  )

  if (phase === 'alreadyCompleted') return (
    <div className="quiz-screen">
      <div className="quiz-msg-card">
        <img src={import.meta.env.BASE_URL + "logo.png"} alt="Dadagiri" className="quiz-logo-sm" />
        <div className="quiz-msg-icon">✅</div>
        <h2>Already Played!</h2>
        <p>You've already completed Episode {episode?.episode_no}.</p>
        <p className="quiz-muted">Results will be announced when the episode closes.</p>
        <div className="quiz-name-row">
          <div className="quiz-name-tag">{user?.name}</div>
          <button className="quiz-logout-btn" onClick={handleLogout}>← Exit</button>
        </div>
      </div>
    </div>
  )

  if (phase === 'waiting') return (
    <div className="quiz-screen">
      <div className="quiz-waiting-card">
        <img
          src={import.meta.env.BASE_URL + "logo.png"}
          alt="Dadagiri"
          className={`quiz-logo${doneCount > 0 ? ' quiz-logo-btn' : ''}`}
          onClick={doneCount > 0 ? () => navigate('/quiz') : undefined}
          title={doneCount > 0 ? 'Wait for next question' : undefined}
        />
        {roundName && <div className="quiz-round-badge">{roundName}</div>}
        {doneCount === 0 ? (
          <>
            <div className="quiz-waiting-dots"><span /><span /><span /></div>
            <h2 className="quiz-waiting-title">Get Ready!</h2>
            <p className="quiz-muted">Waiting for the host to start…</p>
          </>
        ) : (
          <>
            <h2 className="quiz-thankyou-inline">Thank You!</h2>
            <p className="quiz-muted">Your answer has been recorded.</p>
            <p className="quiz-muted" style={{ marginTop: 8 }}>Waiting for next question…</p>
          </>
        )}
        {isSelected && (
          <div className="quiz-selected-status">
            <span className="quiz-selected-star">⭐</span>
            <span>You're selected for the next round!</span>
          </div>
        )}
        <div className="quiz-name-row" style={{ marginTop: 16 }}>
          <div className="quiz-name-tag">{user?.name}</div>
          <button className="quiz-logout-btn" onClick={handleLogout}>← Exit</button>
        </div>
      </div>
    </div>
  )

  if (phase === 'submitting') return (
    <div className="quiz-screen">
      <div className="quiz-center">
        <span className="quiz-spinner" />
        <p>Calculating your score...</p>
      </div>
    </div>
  )

  if (phase === 'done') return (
    <div className="quiz-screen">
      <div className="quiz-thankyou-card">
        <img src={import.meta.env.BASE_URL + "logo.png"} alt="Dadagiri" className="quiz-logo" />
        <div className="quiz-thankyou-icon">🙏</div>
        <h2 className="quiz-thankyou-title">Thank You!</h2>
        <p className="quiz-thankyou-msg">Your answers have been submitted successfully.</p>
        <p className="quiz-thankyou-note">Results will be announced soon. Stay tuned!</p>
        <button className="quiz-home-btn" onClick={handleLogout}>🏠 Home</button>
      </div>
    </div>
  )

  // ── Playing ───────────────────────────────────────────────────────
  const q          = liveQuestion
  const maxMs      = qTimeRef.current * 1000
  const timerPct   = Math.min((elapsedMs / maxMs) * 100, 100)
  const nearEnd    = elapsedMs >= (maxMs - 10000)
  const opts = [
    { k: 'A', v: q?.option_a, show: q?.show_option_a == null || Number(q?.show_option_a) === 1 },
    { k: 'B', v: q?.option_b, show: q?.show_option_b == null || Number(q?.show_option_b) === 1 },
    { k: 'C', v: q?.option_c, show: q?.show_option_c == null || Number(q?.show_option_c) === 1 },
    { k: 'D', v: q?.option_d, show: q?.show_option_d == null || Number(q?.show_option_d) === 1 },
  ].filter(o => o.show)

  return (
    <div className="quiz-screen quiz-playing">
      <div className="quiz-topbar">
        <span className="quiz-q-count">Q{doneCount + 1}/{total}</span>
        <div className={`quiz-timer-badge${nearEnd ? ' warn' : ''}`}>{fmtStopwatch(elapsedMs)}</div>
        <span className="quiz-ep-tag">EP{episode?.episode_no}</span>
      </div>
      {roundName && <div className="quiz-round-strip">{roundName}</div>}

      <div className="quiz-tbar">
        <div
          className={`quiz-tbar-fill${nearEnd ? ' warn' : ''}`}
          style={{
            width: `${timerPct}%`,
            transition: elapsedMs > 100 ? 'width 0.05s linear' : 'none',
          }}
        />
      </div>

      <div className="quiz-body">
        <div className="quiz-opts">
          {opts.map(o => (
            <button
              key={o.k}
              className={[
                'quiz-opt',
                selected === o.k ? 'chosen' : '',
                selected && selected !== o.k ? 'faded' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => handleSelect(o.k)}
              disabled={!!selected}
            >
              <span className="quiz-opt-k">{o.k}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="quiz-foot">
        <div className="quiz-dots">
          {questionsRef.current.map((_, i) => (
            <span
              key={i}
              className={`quiz-dot${i < doneCount ? ' done' : i === doneCount ? ' active' : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
