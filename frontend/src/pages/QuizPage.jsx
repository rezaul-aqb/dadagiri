import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'

const DEFAULT_Q_TIME = 30

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function QuizPage() {
  const navigate = useNavigate()

  // Phase: loading | noEpisode | alreadyCompleted | ready | playing | submitting | done
  const [phase, setPhase]     = useState('loading')
  const [episode, setEpisode] = useState(null)
  const [user, setUser]       = useState(null)
  const [error, setError]     = useState('')

  // Render state for playing phase
  const [currentIdx, setCurrentIdx] = useState(0)
  const [timeLeft, setTimeLeft]     = useState(DEFAULT_Q_TIME)
  const [selected, setSelected]     = useState(null)
  const [result, setResult]         = useState(null)

  // Refs — stable values accessible inside closures without stale captures
  const questionsRef = useRef([])
  const answersRef   = useRef([])
  const sessionRef   = useRef(null)
  const userRef      = useRef(null)
  const idxRef       = useRef(0)
  const startRef     = useRef(0)
  const lockedRef    = useRef(false)
  const timerRef     = useRef(null)
  const qTimeRef     = useRef(DEFAULT_Q_TIME)

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
        qTimeRef.current = res.data.time_per_question || DEFAULT_Q_TIME
        questionsRef.current = res.data.questions
        setPhase('ready')
      })
      .catch(err => {
        if (err.response?.status !== 404) setError('Failed to load quiz. Please try again.')
        setPhase('noEpisode')
      })
  }, [])

  // ── Timer — single interval for entire playing phase ──────────────
  useEffect(() => {
    if (phase !== 'playing') return

    startRef.current = Date.now()
    lockedRef.current = false
    setTimeLeft(qTimeRef.current)
    setSelected(null)

    const id = setInterval(() => {
      const elapsed    = Math.floor((Date.now() - startRef.current) / 1000)
      const remaining  = Math.max(0, qTimeRef.current - elapsed)
      setTimeLeft(remaining)

      if (remaining <= 0 && !lockedRef.current) {
        lockedRef.current = true
        advance(null)
      }
    }, 1000)

    timerRef.current = id
    return () => clearInterval(id)
  }, [phase, currentIdx]) // restart timer when question changes

  // ── Move to next question or finish ──────────────────────────────
  const advance = (chosen) => {
    clearInterval(timerRef.current)
    const elapsed = Math.min(
      Math.floor((Date.now() - startRef.current) / 1000),
      qTimeRef.current
    )
    const q = questionsRef.current[idxRef.current]
    answersRef.current = [...answersRef.current, {
      question_id:        q.id,
      chosen_answer:      chosen,
      time_taken_seconds: elapsed,
    }]

    const next = idxRef.current + 1
    if (next >= questionsRef.current.length) {
      setPhase('submitting')
      doSubmit(answersRef.current)
    } else {
      idxRef.current = next
      setSelected(null)
      setCurrentIdx(next)
      startRef.current = Date.now()
      lockedRef.current = false
    }
  }

  // ── User taps an option ───────────────────────────────────────────
  const handleSelect = (opt) => {
    if (lockedRef.current || selected !== null) return
    lockedRef.current = true
    clearInterval(timerRef.current)
    setSelected(opt)
    setTimeout(() => advance(opt), 700)
  }

  // ── Start quiz session ────────────────────────────────────────────
  const startQuiz = async () => {
    setError('')
    try {
      const res = await api.post('/quiz/start', {
        user_id:    userRef.current.id,
        episode_id: episode.id,
      })
      sessionRef.current = res.data.session_id
      answersRef.current = []
      idxRef.current     = 0
      setCurrentIdx(0)
      setPhase('playing')
    } catch (err) {
      if (err.response?.status === 409) setPhase('alreadyCompleted')
      else setError(err.response?.data?.message || 'Failed to start. Try again.')
    }
  }

  // ── Submit all answers ────────────────────────────────────────────
  const doSubmit = async (allAnswers) => {
    try {
      const res = await api.post('/quiz/submit', {
        session_id: sessionRef.current,
        user_id:    userRef.current.id,
        answers:    allAnswers,
      })
      setResult(res.data)
      setPhase('done')
    } catch (err) {
      setError('Submission failed. Please contact support.')
      setPhase('done')
    }
  }

  // ── Screens ───────────────────────────────────────────────────────

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
        <div className="quiz-name-tag">{user?.name}</div>
      </div>
    </div>
  )

  if (phase === 'ready') return (
    <div className="quiz-screen">
      <div className="quiz-ready-card">
        <img src={import.meta.env.BASE_URL + "logo.png"} alt="Dadagiri" className="quiz-logo" />
        <h2 className="quiz-ep-no">Episode {episode?.episode_no}</h2>
        <p className="quiz-ep-name">{episode?.name}</p>
        <div className="quiz-ready-chips">
          <span className="quiz-chip">📋 {questionsRef.current.length} Questions</span>
          <span className="quiz-chip">⏱️ {qTimeRef.current}s each</span>
        </div>
        <p className="quiz-welcome">Welcome, <strong>{user?.name}</strong>!</p>
        {error && <p className="quiz-err-txt">{error}</p>}
        <button className="quiz-start-btn" onClick={startQuiz}>
          🎯 Start Quiz
        </button>
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

  if (phase === 'done') {
    return (
      <div className="quiz-screen">
        <div className="quiz-thankyou-card">
          <img src={import.meta.env.BASE_URL + "logo.png"} alt="Dadagiri" className="quiz-logo" />
          <div className="quiz-thankyou-icon">🙏</div>
          <h2 className="quiz-thankyou-title">Thank You!</h2>
          <p className="quiz-thankyou-msg">
            Your answers have been submitted successfully.
          </p>
          <p className="quiz-thankyou-note">
            Results will be announced soon. Stay tuned!
          </p>
          <button
            className="quiz-home-btn"
            onClick={() => { sessionStorage.removeItem('quiz_user'); navigate('/') }}
          >
            🏠 Home
          </button>
        </div>
      </div>
    )
  }

  // ── Playing ───────────────────────────────────────────────────────
  const q       = questionsRef.current[currentIdx]
  const timerPct = (timeLeft / qTimeRef.current) * 100
  const opts = [
    { k: 'A', v: q?.option_a },
    { k: 'B', v: q?.option_b },
    { k: 'C', v: q?.option_c },
    { k: 'D', v: q?.option_d },
  ]

  return (
    <div className="quiz-screen quiz-playing">
      {/* Top bar */}
      <div className="quiz-topbar">
        <span className="quiz-q-count">
          Q{currentIdx + 1}/{questionsRef.current.length}
        </span>
        <div className={`quiz-timer-badge${timeLeft <= 10 ? ' warn' : ''}`}>
          {timeLeft}
        </div>
        <span className="quiz-ep-tag">EP{episode?.episode_no}</span>
      </div>

      {/* Timer bar */}
      <div className="quiz-tbar">
        <div
          className={`quiz-tbar-fill${timeLeft <= 10 ? ' warn' : ''}`}
          style={{
            width: `${timerPct}%`,
            transition: timeLeft < qTimeRef.current ? 'width 1s linear' : 'none',
          }}
        />
      </div>

      {/* Question + options */}
      <div className="quiz-body">
        <p className="quiz-q-text">{q?.question_text}</p>
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

      {/* Progress dots */}
      <div className="quiz-foot">
        <div className="quiz-dots">
          {questionsRef.current.map((_, i) => (
            <span
              key={i}
              className={`quiz-dot${i < currentIdx ? ' done' : i === currentIdx ? ' active' : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
