import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/axios'

// ── Toss helpers ──────────────────────────────────────────────────────
function LetterBoxInput({ value, onChange }) {
  const inputRef = useRef(null)
  const display  = (value || '').toUpperCase()

  const handleKeyDown = (e) => {
    if (e.key === 'Backspace') { onChange(display.slice(0, -1)); e.preventDefault() }
  }
  const handleInput = (e) => {
    const last = e.target.value.toUpperCase().slice(-1)
    if (/[A-Z0-9 ]/.test(last)) onChange(display + last)
    e.target.value = ''
  }

  return (
    <div className="toss-answer-wrap" onClick={() => inputRef.current?.focus()}>
      <div className="toss-letter-boxes">
        {display.split('').map((ch, i) =>
          ch === ' '
            ? <span key={i} className="toss-letter-gap" />
            : <span key={i} className="toss-letter-box">{ch}</span>
        )}
        <span className="toss-letter-box toss-letter-cursor">_</span>
      </div>
      <input ref={inputRef} className="toss-hidden-input"
        onKeyDown={handleKeyDown} onInput={handleInput}
        autoComplete="off" value="" onChange={() => {}} />
      <p className="toss-answer-hint">Click and type — each letter fills a box. Backspace to erase.</p>
    </div>
  )
}

function AnswerBoxes({ answer }) {
  return (
    <div className="toss-letter-boxes toss-letter-boxes-sm">
      {(answer || '').toUpperCase().split('').map((ch, i) =>
        ch === ' '
          ? <span key={i} className="toss-letter-gap-sm" />
          : <span key={i} className="toss-letter-box-sm revealed">{ch}</span>
      )}
    </div>
  )
}

const emptyForm = {
  question_text: '', option_a: '', option_b: '', option_c: '', option_d: '',
  correct_answer: 'A', order: 0, is_active: true,
  show_option_a: true, show_option_b: true, show_option_c: true, show_option_d: true,
}

export default function EpisodeQuestionsPage() {
  const { episodeId } = useParams()
  const navigate = useNavigate()
  const [episode, setEpisode]     = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editItem, setEditItem]   = useState(null)
  const [deleteId, setDeleteId]   = useState(null)
  const [deleting, setDeleting]   = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [liveId, setLiveId]       = useState(null)
  const [livePreview, setLivePreview] = useState(null)
  const [liveSlide, setLiveSlide] = useState('question') // 'question' | 'answer'
  const [rounds, setRounds]       = useState([])
  const [filterRound, setFilterRound] = useState('all')

  // Toss state
  const [tossQuestions, setTossQuestions] = useState([])
  const [showTossForm,  setShowTossForm]  = useState(false)
  const [editToss,      setEditToss]      = useState(null)
  const [tossDeleteId,  setTossDeleteId]  = useState(null)
  const [tossDel,       setTossDel]       = useState(false)
  const [tossActing,    setTossActing]    = useState({})

  // Drag state
  const dragIdx  = useRef(null)
  const overIdx  = useRef(null)
  const [dragOver, setDragOver] = useState(null)

  const fetchData = () => {
    setLoading(true)
    Promise.all([
      api.get(`/episodes/${episodeId}`),
      api.get(`/questions?episode_id=${episodeId}`),
      api.get('/rounds'),
      api.get(`/toss-questions?episode_id=${episodeId}`),
    ]).then(([ep, qs, rs, tqs]) => {
      setEpisode(ep.data)
      setQuestions(qs.data)
      setRounds(rs.data)
      setTossQuestions(tqs.data)
      const live = qs.data.find(q => q.is_live == 1)
      if (live) setLiveId(live.id)
    }).finally(() => setLoading(false))
  }
  useEffect(() => { fetchData() }, [episodeId])

  const handleGoLive = async (q) => {
    await api.post(`/questions/${q.id}/live`)
    setLiveId(q.id)
    setLivePreview(q)
    setLiveSlide('question')
  }

  const handleAnswerSlide = (q) => {
    // Only changes admin LED to answer slide — no API call, no user-side effect
    setLivePreview(q)
    setLiveSlide('answer')
  }

  const handleStopLive = async () => {
    await api.delete('/questions/live')
    setLiveId(null)
    setLivePreview(null)
    setLiveSlide('question')
  }

  const handleDelete = async () => {
    setDeleting(true)
    await api.delete(`/questions/${deleteId}`)
    setDeleteId(null)
    setDeleting(false)
    fetchData()
  }

  // ── Toss handlers ─────────────────────────────────────
  const tossAct = async (key, fn) => {
    setTossActing(a => ({ ...a, [key]: true }))
    try { await fn() } finally { setTossActing(a => ({ ...a, [key]: false })) }
  }
  const tossGoLive      = (q) => tossAct(q.id, async () => { await api.post(`/toss-questions/${q.id}/live`); fetchData() })
  const tossStopLive    = ()  => tossAct('stop', async () => { await api.delete('/toss-questions/live'); fetchData() })
  const tossToggleHint  = (q, n) => tossAct(`h${q.id}-${n}`, async () => {
    const res = await api.post(`/toss-questions/${q.id}/toggle-hint`, { hint: n })
    setTossQuestions(prev => prev.map(tq => tq.id === q.id ? res.data : tq))
  })
  const tossReset       = (q) => tossAct(`r${q.id}`, async () => { await api.post(`/toss-questions/${q.id}/reset-hints`); fetchData() })
  const tossDoDelete  = async () => {
    setTossDel(true)
    await api.delete(`/toss-questions/${tossDeleteId}`)
    setTossDeleteId(null); setTossDel(false); fetchData()
  }

  // ── Drag handlers ──────────────────────────────────────
  const onDragStart = (i) => { dragIdx.current = i }
  const onDragEnter = (i) => { overIdx.current = i; setDragOver(i) }
  const onDragEnd   = () => { setDragOver(null); dragIdx.current = null; overIdx.current = null }

  const onDrop = async () => {
    const from = dragIdx.current
    const to   = overIdx.current
    if (from === null || to === null || from === to) { onDragEnd(); return }

    const reordered = [...questions]
    const [moved]   = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    setQuestions(reordered)
    setDragOver(null)
    dragIdx.current = null
    overIdx.current = null

    setSaving(true)
    try {
      await api.post('/questions/reorder', { order: reordered.map(q => q.id) })
    } catch {
      fetchData() // revert on error
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading-state">Loading...</div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/episodes')} style={{ marginBottom: 8 }}>
            ← Episodes
          </button>
          <h1 className="page-title">
            EP {episode?.episode_no} — {episode?.name}
          </h1>
          <p className="page-subtitle">
            {questions.length} / 12 questions added
            {saving && <span className="reorder-saving"> · Saving order…</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
<button className="btn btn-primary" onClick={() => {
            // Pre-select the active filter round so admin doesn't have to pick it again
            const preRound = filterRound !== 'all' && filterRound !== 'none' ? filterRound : ''
            setEditItem(preRound ? { round_id: preRound } : null)
            setShowForm(true)
          }}>
            + Add Question
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="q-progress-wrap">
        <div className="q-progress-bar">
          <div className="q-progress-fill" style={{ width: `${Math.min((questions.length / 12) * 100, 100)}%` }} />
        </div>
        <span className="q-progress-label">{questions.length}/12</span>
      </div>

      {/* Round filter */}
      {rounds.length > 0 && (
        <div className="round-filter-bar">
          <button
            className={`round-filter-btn${filterRound === 'all' ? ' active' : ''}`}
            onClick={() => setFilterRound('all')}
          >
            All Rounds
          </button>
          {rounds.map(r => (
            <button
              key={r.id}
              className={`round-filter-btn${filterRound === r.id ? ' active' : ''}`}
              onClick={() => setFilterRound(r.id)}
            >
              {r.name}
            </button>
          ))}
          <button
            className={`round-filter-btn${filterRound === 'none' ? ' active' : ''}`}
            onClick={() => setFilterRound('none')}
          >
            No Round
          </button>
        </div>
      )}

      {(() => {
        const tossRound = rounds.find(r => r.name?.toLowerCase().includes('toss'))

        const filtered = filterRound === 'all'
          ? questions
          : filterRound === 'none'
            ? questions.filter(q => !q.round_id)
            : questions.filter(q => q.round_id == filterRound)

        const showTossGroup = filterRound === 'all' || (tossRound && String(filterRound) === String(tossRound.id))

        // Build groups from regular questions
        const grouped = []
        const seen = {}
        filtered.forEach((q, i) => {
          const key = q.round_id ?? 'none'
          if (!seen[key]) {
            seen[key] = true
            grouped.push({ round_id: q.round_id, round_name: q.round_name || null, items: [], isToss: false })
          }
          grouped.find(g => (g.round_id ?? 'none') === key).items.push({ q, i })
        })
        // Mark any existing toss group
        grouped.forEach(g => { if (g.round_name?.toLowerCase().includes('toss')) g.isToss = true })
        // Inject toss group if not already in list
        if (showTossGroup && tossRound && !seen[tossRound.id]) {
          grouped.push({ round_id: tossRound.id, round_name: tossRound.name, items: [], isToss: true })
        }

        if (grouped.length === 0 && questions.length === 0) return (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <p>No questions for this episode yet.</p>
            <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowForm(true) }}>Add First Question</button>
          </div>
        )
        if (grouped.length === 0) return (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <p>No questions in this round.</p>
          </div>
        )

        return grouped.map(group => (
          <div key={group.round_id ?? 'none'} className="round-group">
            <div className="round-group-header">
              {group.round_name
                ? <><span className="round-group-icon">{group.isToss ? '🎯' : '🏏'}</span>{group.round_name}</>
                : <><span className="round-group-icon">📋</span>No Round Assigned</>
              }
              <span className="round-group-count">
                {group.isToss ? tossQuestions.length : group.items.length} question{(group.isToss ? tossQuestions.length : group.items.length) !== 1 ? 's' : ''}
              </span>
            </div>

            {group.isToss ? (
              /* ── Toss question cards ── */
              tossQuestions.length === 0 ? (
                <div className="toss-empty">
                  <span>No toss question yet. Use <strong>+ Add Question</strong> and select Toss Round.</span>
                </div>
              ) : (
                <div className="toss-list">
                  {tossQuestions.map(q => {
                    const isLive   = q.is_live == 1
                    const revealed = parseInt(q.hints_revealed) || 0
                    const hints    = [q.hint_1, q.hint_2, q.hint_3, q.hint_4, q.hint_5, q.hint_6]
                    return (
                      <div key={q.id} className={`toss-card${isLive ? ' toss-card-live' : ''}`}>
                        <div className="toss-card-header">
                          {isLive && <span className="toss-badge-live">● LIVE</span>}
                          <div className="toss-card-actions">
                            {!isLive ? (
                              <button className="btn btn-sm btn-success" onClick={() => tossGoLive(q)} disabled={tossActing[q.id]}>
                                {tossActing[q.id] ? '…' : '▶ Go Live'}
                              </button>
                            ) : (
                              <>
                                <button className="btn btn-sm btn-secondary"
                                  onClick={() => tossReset(q)} disabled={tossActing[`r${q.id}`]}>
                                  {tossActing[`r${q.id}`] ? '…' : '↺ Reset Hints'}
                                </button>
                                <button className="btn btn-sm btn-danger" onClick={tossStopLive} disabled={tossActing['stop']}>
                                  {tossActing['stop'] ? '…' : '■ Stop'}
                                </button>
                              </>
                            )}
                            <button className="btn btn-sm btn-secondary" onClick={() => { setEditToss(q); setShowTossForm(true) }}>Edit</button>
                            <button className="btn btn-sm btn-danger" onClick={() => setTossDeleteId(q.id)}>Delete</button>
                          </div>
                        </div>
                        {q.question_text && <p className="toss-question-text">{q.question_text}</p>}
                        <div className="toss-hints-grid">
                          {hints.map((h, i) => {
                            const num     = i + 1
                            const showKey = `show_hint_${num}`
                            const shown   = q[showKey] == 1
                            return (
                              <div key={i} className={`toss-hint${shown ? ' toss-hint-revealed' : ' toss-hint-hidden'}`}>
                                <div className="toss-hint-top">
                                  <span className="toss-hint-num">Hint {num}</span>
                                  <label className="toss-hint-toggle" title={shown ? 'Hide from users' : 'Show to users'}>
                                    <input
                                      type="checkbox"
                                      checked={shown}
                                      disabled={!!tossActing[`h${q.id}-${num}`]}
                                      onChange={() => tossToggleHint(q, num)}
                                    />
                                    <span>{shown ? 'Visible' : 'Hidden'}</span>
                                  </label>
                                </div>
                                <span className="toss-hint-text">{h || '—'}</span>
                              </div>
                            )
                          })}
                        </div>
                        <div className="toss-answer-section">
                          <span className="toss-answer-label">Answer ({(q.answer || '').replace(/ /g, '').length} letters)</span>
                          <AnswerBoxes answer={q.answer} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : (
              /* ── Regular question cards ── */
              <div className="question-list">
                {group.items.map(({ q, i }) => (
                  <div
                    key={q.id}
                    className={`question-card${!q.image ? ' no-image' : ''}${liveId === q.id ? ' is-live' : ''}${dragOver === i ? ' drag-over' : ''}`}
                    draggable
                    onDragStart={() => onDragStart(i)}
                    onDragEnter={() => onDragEnter(i)}
                    onDragEnd={onDragEnd}
                    onDrop={onDrop}
                    onDragOver={e => e.preventDefault()}
                  >
                    {/* Two slide image panels */}
                    <div className="q-slides-wrap">
                      <div className="q-slide-panel">
                        <div className="q-slide-label">Question Slide</div>
                        {q.image ? (
                          <img src={`/dadagiri/uploads/questions/${q.image}`} alt="question slide" className="q-slide-img" />
                        ) : (
                          <div className="q-slide-empty">
                            <span>🖼️</span><span>No Image</span>
                          </div>
                        )}
                        <button
                          className={`btn btn-sm btn-live-start q-slide-btn${liveId === q.id && liveSlide === 'question' ? ' active-slide' : ''}`}
                          onClick={() => handleGoLive(q)}
                        >
                          ▶ Question Start
                        </button>
                      </div>

                      <div className="q-slide-panel">
                        <div className="q-slide-label">Answer Slide</div>
                        {q.answer_image ? (
                          <img src={`/dadagiri/uploads/questions/${q.answer_image}`} alt="answer slide" className="q-slide-img" />
                        ) : (
                          <div className="q-slide-empty">
                            <span>🖼️</span><span>No Image</span>
                          </div>
                        )}
                        <button
                          className={`btn btn-sm btn-answer-start q-slide-btn${liveSlide === 'answer' && livePreview?.id === q.id ? ' active-slide' : ''}`}
                          onClick={() => handleAnswerSlide(q)}
                        >
                          ▶ Answer Start
                        </button>
                      </div>
                    </div>

                    <div className="question-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="drag-handle" title="Drag to reorder">⠿</span>
                        <span className="question-number">Q{i + 1}</span>
                        {liveId === q.id && (
                          <span className={`live-slide-badge ${liveSlide === 'answer' ? 'badge-answer' : 'badge-question'}`}>
                            {liveSlide === 'answer' ? '● Answer Live' : '● Question Live'}
                          </span>
                        )}
                      </div>
                      <div className="question-actions">
                        {liveId === q.id && (
                          <button className="btn btn-sm btn-live-stop" onClick={handleStopLive}>⏹ Stop</button>
                        )}
                        <button className="btn btn-sm btn-result" onClick={() => navigate(`/admin/questions/${q.id}/result`)}>📊 Result</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => { setEditItem(q); setShowForm(true) }}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => setDeleteId(q.id)}>Delete</button>
                      </div>
                    </div>
                    <p className="question-text">{q.question_text}</p>
                    <div className="options-grid">
                      {['A','B','C','D'].map(l => {
                        const showKey = `show_option_${l.toLowerCase()}`
                        const visible = q[showKey] == null || Number(q[showKey]) === 1
                        return (
                          <div key={l} className={`option-item ${q.correct_answer === l ? 'correct' : ''} ${!visible ? 'option-item-hidden' : ''}`}>
                            <label className="opt-card-cb" title={visible ? 'Click to hide from users' : 'Click to show to users'}
                              onClick={e => e.stopPropagation()}>
                              <input type="checkbox" checked={visible}
                                onChange={async () => {
                                  const res = await api.post(`/questions/${q.id}/toggle-option`, { option: l.toLowerCase() })
                                  setQuestions(prev => prev.map(pq =>
                                    pq.id === q.id ? { ...pq, [showKey]: res.data.show ? 1 : 0 } : pq
                                  ))
                                }}
                              />
                            </label>
                            <span className="option-label">{l}</span>
                            <span className="option-text">{q[`option_${l.toLowerCase()}`]}</span>
                            {q.correct_answer === l && <span className="correct-badge">✓</span>}
                            {!visible && <span className="option-hidden-badge">Hidden</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      })()}


      {showTossForm && (
        <TossFormModal
          item={editToss}
          episodeId={episodeId}
          rounds={rounds}
          onClose={() => setShowTossForm(false)}
          onSaved={() => { setShowTossForm(false); fetchData() }}
        />
      )}

      {tossDeleteId && (
        <div className="modal-overlay" onClick={() => !tossDel && setTossDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">🗑️</div>
            <h2 className="modal-title">Delete Toss Question?</h2>
            <p className="modal-text">This cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setTossDeleteId(null)} disabled={tossDel}>Cancel</button>
              <button className="btn btn-danger" onClick={tossDoDelete} disabled={tossDel}>
                {tossDel ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <QuestionFormModal
          item={editItem}
          episodeId={episodeId}
          rounds={rounds}
          onClose={() => setShowForm(false)}
          onSaved={(savedQ) => {
            setShowForm(false)
            if (!savedQ) { fetchData(); return }
            setQuestions(prev => {
              const idx = prev.findIndex(q => q.id === savedQ.id)
              if (idx >= 0) {
                const updated = [...prev]; updated[idx] = savedQ; return updated
              }
              return [...prev, savedQ]
            })
            fetchData()
          }}
        />
      )}

      {showImport && (
        <ImportModal
          episodeId={episodeId}
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); fetchData() }}
        />
      )}

      {livePreview && (
        <div className="live-preview-fullscreen">
          {/* Top bar */}
          <div className="live-preview-topbar">
            <div className="live-slide-switcher">
              <button
                className={`live-slide-tab ${liveSlide === 'question' ? 'active' : ''}`}
                onClick={() => setLiveSlide('question')}
              >
                ▶ Question Slide
              </button>
              <button
                className={`live-slide-tab ${liveSlide === 'answer' ? 'active' : ''}`}
                onClick={() => setLiveSlide('answer')}
              >
                ▶ Answer Slide
              </button>
            </div>
            <button className="live-preview-close" onClick={handleStopLive} title="Stop & Close">⏹ Stop</button>
          </div>

          {/* Slide display */}
          {liveSlide === 'question' ? (
            livePreview.image ? (
              <img
                src={`/dadagiri/uploads/questions/${livePreview.image}`}
                alt="question slide"
                className="live-preview-img"
              />
            ) : (
              <div className="live-preview-noimg">
                <div className="live-preview-logo-top"><img src="/dadagiri/logo.png" alt="Dadagiri" /></div>
                <p className="live-preview-qtext">{livePreview.question_text}</p>
                <div className="live-preview-opts">
                  {['A','B','C','D'].map(l => {
                    const showKey = `show_option_${l.toLowerCase()}`
                    const visible = livePreview[showKey] == null || Number(livePreview[showKey]) === 1
                    if (!visible) return null
                    return (
                      <div key={l} className="live-preview-opt">
                        <span className="live-preview-opt-label">{l}</span>
                        <span className="live-preview-opt-text">{livePreview[`option_${l.toLowerCase()}`]}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          ) : (
            livePreview.answer_image ? (
              <img
                src={`/dadagiri/uploads/questions/${livePreview.answer_image}`}
                alt="answer slide"
                className="live-preview-img"
              />
            ) : (
              <div className="live-preview-noimg">
                <div className="live-preview-logo-top"><img src="/dadagiri/logo.png" alt="Dadagiri" /></div>
                <p className="live-preview-qtext" style={{ color: '#22c55e' }}>No answer slide image uploaded.</p>
              </div>
            )
          )}
        </div>
      )}

      {deleteId && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">🗑️</div>
            <h2 className="modal-title">Delete Question?</h2>
            <p className="modal-text">This cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const CSV_TEMPLATE =
  'data:text/csv;charset=utf-8,' +
  encodeURIComponent(
    'Question,Option 1,Option 2,Option 3,Option 4,Correct Answer\n' +
    'What is the capital of Bangladesh?,Dhaka,Chittagong,Sylhet,Rajshahi,A\n' +
    'In which year did India gain independence?,1945,1946,1947,1948,C\n'
  )

function ImportModal({ episodeId, onClose, onDone }) {
  const fileRef  = useRef(null)
  const [status, setStatus]   = useState('idle') // idle | uploading | done | error
  const [result, setResult]   = useState(null)
  const [errMsg, setErrMsg]   = useState('')

  const handleUpload = async () => {
    const file = fileRef.current?.files[0]
    if (!file) { setErrMsg('Please choose a file first.'); return }
    setErrMsg('')
    setStatus('uploading')
    const fd = new FormData()
    fd.append('episode_id', episodeId)
    fd.append('file', file)
    try {
      const res = await api.post('/admin/questions/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(res.data)
      setStatus('done')
    } catch (err) {
      setErrMsg(err.response?.data?.message || 'Upload failed. Please try again.')
      setStatus('error')
    }
  }

  return (
    <div className="modal-overlay" onClick={status !== 'uploading' ? onClose : undefined}>
      <div className="import-modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title" style={{ textAlign: 'left', marginBottom: 10 }}>📥 Import Questions</h2>

        <div className="import-format-table">
          <div className="import-format-row header">
            <span>Col 1</span><span>Col 2</span><span>Col 3</span><span>Col 4</span><span>Col 5</span><span>Col 6</span>
          </div>
          <div className="import-format-row">
            <span className="col-q">Question</span>
            <span>Option 1</span><span>Option 2</span><span>Option 3</span><span>Option 4</span>
            <span className="col-ans">Answer<br/><small>A/B/C/D or 1/2/3/4</small></span>
          </div>
        </div>



        {status !== 'done' && (
          <div className="import-file-wrap">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx"
              className="import-file-input"
              id="imp-file"
              onChange={() => { setErrMsg(''); setStatus('idle') }}
            />
            <label htmlFor="imp-file" className="import-file-label">
              {fileRef.current?.files[0]?.name || 'Choose file (.csv or .xlsx)'}
            </label>
          </div>
        )}

        {errMsg && <p className="import-error">{errMsg}</p>}

        {status === 'done' && result && (
          <div className="import-result">
            <div className="import-result-ok">
              ✅ <strong>{result.inserted}</strong> question{result.inserted !== 1 ? 's' : ''} imported successfully
            </div>
            {result.skipped?.length > 0 && (
              <div className="import-skipped">
                <p>⚠ {result.skipped.length} row{result.skipped.length !== 1 ? 's' : ''} skipped:</p>
                <ul>
                  {result.skipped.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={status === 'uploading'}>
            {status === 'done' ? 'Close' : 'Cancel'}
          </button>
          {status !== 'done' && (
            <button className="btn btn-primary" onClick={handleUpload} disabled={status === 'uploading'}>
              {status === 'uploading' ? 'Uploading...' : 'Upload & Import'}
            </button>
          )}
          {status === 'done' && result?.inserted > 0 && (
            <button className="btn btn-primary" onClick={onDone}>
              View Questions
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const TOSS_EMPTY = { question_text: '', hint_1: '', hint_2: '', hint_3: '', hint_4: '', hint_5: '', hint_6: '', answer: '' }

function TossFormModal({ item, episodeId, rounds = [], onClose, onSaved }) {
  const isEdit = Boolean(item)
  const [form, setForm] = useState(item ? {
    question_text: item.question_text || '',
    hint_1: item.hint_1 || '', hint_2: item.hint_2 || '',
    hint_3: item.hint_3 || '', hint_4: item.hint_4 || '',
    hint_5: item.hint_5 || '', hint_6: item.hint_6 || '',
    answer: item.answer || '',
  } : { ...TOSS_EMPTY })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.answer.trim()) { setError('Answer is required'); return }
    setSaving(true); setError('')
    try {
      if (isEdit) await api.put(`/toss-questions/${item.id}`, { ...form, episode_id: episodeId })
      else        await api.post('/toss-questions', { ...form, episode_id: episodeId })
      onSaved()
    } catch (e) {
      setError(e.response?.data?.message || 'Save failed')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal toss-modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">{isEdit ? 'Edit' : 'Add'} Toss Question</h2>

        <div className="form-group">
          <label className="form-label">Round</label>
          {(() => {
            const tossRoundId = String(item?.round_id || rounds.find(r => r.name?.toLowerCase().includes('toss'))?.id || '')
            return (
              <select className="form-input" value={tossRoundId} disabled>
                <option value="">— No Round —</option>
                {rounds.map(r => <option key={r.id} value={String(r.id)}>{r.name}</option>)}
              </select>
            )
          })()}
        </div>

        <div className="form-group">
          <label className="form-label">Question Text <span className="form-optional">(optional — admin reference)</span></label>
          <textarea className="form-input" rows={2} value={form.question_text}
            onChange={e => set('question_text', e.target.value)} placeholder="Enter the question..." />
        </div>

        <div className="toss-hints-form">
          <label className="form-label">Hints</label>
          {[1,2,3,4,5,6].map(n => (
            <div key={n} className="toss-hint-row">
              <span className="toss-hint-num-badge">{n}</span>
              <input className="form-input" placeholder={`Hint ${n}`}
                value={form[`hint_${n}`]} onChange={e => set(`hint_${n}`, e.target.value)} />
            </div>
          ))}
        </div>

        <div className="form-group">
          <label className="form-label">Answer <span style={{ color: '#ef4444' }}>*</span></label>
          <LetterBoxInput value={form.answer} onChange={v => set('answer', v)} />
        </div>

        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Question'}
          </button>
        </div>
      </div>
    </div>
  )
}

function QuestionFormModal({ item, episodeId, rounds = [], onClose, onSaved }) {
  // item with only round_id means "pre-select round, still adding new"
  const isEdit   = Boolean(item && item.id)
  const preRound = item?.round_id ?? ''
  const initForm = isEdit
    ? {
        ...item,
        show_option_a: item.show_option_a == null ? true : Boolean(Number(item.show_option_a)),
        show_option_b: item.show_option_b == null ? true : Boolean(Number(item.show_option_b)),
        show_option_c: item.show_option_c == null ? true : Boolean(Number(item.show_option_c)),
        show_option_d: item.show_option_d == null ? true : Boolean(Number(item.show_option_d)),
        hint_1: '', hint_2: '', hint_3: '', hint_4: '', hint_5: '', hint_6: '',
        toss_answer: '',
      }
    : {
        ...emptyForm, episode_id: episodeId, round_id: preRound,
        hint_1: '', hint_2: '', hint_3: '', hint_4: '', hint_5: '', hint_6: '',
        toss_answer: '',
      }

  const [form, setForm]       = useState(initForm)
  const [errors, setErrors]   = useState({})
  const [saving, setSaving]   = useState(false)
  const [imageFile, setImageFile]           = useState(null)
  const [imagePreview, setImagePreview]     = useState(item?.image ? `/dadagiri/uploads/questions/${item.image}` : null)
  const [removingImg, setRemovingImg]       = useState(false)
  const [answerImageFile, setAnswerImageFile]         = useState(null)
  const [answerImagePreview, setAnswerImagePreview]   = useState(item?.answer_image ? `/dadagiri/uploads/questions/${item.answer_image}` : null)
  const [removingAnswerImg, setRemovingAnswerImg]     = useState(false)
  const imgInputRef       = useRef(null)
  const answerImgInputRef = useRef(null)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const selectedRound = rounds.find(r => String(r.id) === String(form.round_id))
  const isToss = selectedRound?.name?.toLowerCase().includes('toss')

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleRemoveImage = async () => {
    if (!isEdit || !item.image) { setImageFile(null); setImagePreview(null); return }
    setRemovingImg(true)
    try {
      await api.delete(`/questions/${item.id}/image`)
      setImagePreview(null); setImageFile(null)
    } finally { setRemovingImg(false) }
  }

  const handleAnswerImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setAnswerImageFile(file)
    setAnswerImagePreview(URL.createObjectURL(file))
  }

  const handleRemoveAnswerImage = async () => {
    if (!isEdit || !item.answer_image) { setAnswerImageFile(null); setAnswerImagePreview(null); return }
    setRemovingAnswerImg(true)
    try {
      await api.delete(`/questions/${item.id}/answer-image`)
      setAnswerImagePreview(null); setAnswerImageFile(null)
    } finally { setRemovingAnswerImg(false) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setErrors({}); setSaving(true)
    try {
      if (isToss) {
        // Save as toss question
        if (!form.toss_answer.trim()) { setErrors({ _global: 'Answer is required' }); setSaving(false); return }
        const payload = {
          episode_id: episodeId,
          round_id: form.round_id,
          question_text: form.question_text,
          hint_1: form.hint_1, hint_2: form.hint_2, hint_3: form.hint_3,
          hint_4: form.hint_4, hint_5: form.hint_5, hint_6: form.hint_6,
          answer: form.toss_answer,
        }
        await api.post('/toss-questions', payload)
        onSaved(null) // no regular question returned
      } else {
        let savedQ
        if (isEdit) {
          const res = await api.put(`/questions/${item.id}`, form)
          savedQ = res.data
        } else {
          const res = await api.post('/questions', { ...form, episode_id: episodeId })
          savedQ = res.data
        }
        if (imageFile && savedQ?.id) {
          const fd = new FormData()
          fd.append('image', imageFile)
          const imgRes = await api.post(`/questions/${savedQ.id}/image`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          savedQ = { ...savedQ, image: imgRes.data.image }
        }
        if (answerImageFile && savedQ?.id) {
          const fd = new FormData()
          fd.append('image', answerImageFile)
          const imgRes = await api.post(`/questions/${savedQ.id}/answer-image`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          savedQ = { ...savedQ, answer_image: imgRes.data.answer_image }
        }
        onSaved(savedQ)
      }
    } catch (err) {
      if (err.response?.data?.errors) setErrors(err.response.data.errors)
      else if (err.response?.data?.message) setErrors({ _global: err.response.data.message })
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 580, textAlign: 'left', padding: 28 }} onClick={e => e.stopPropagation()}>
        <h2 className="modal-title" style={{ textAlign: 'left', marginBottom: 20 }}>
          {isEdit ? 'Edit Question' : isToss ? '🎯 Add Toss Question' : 'Add Question'}
        </h2>
        <form onSubmit={handleSubmit}>

          {/* Round selector */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Round</label>
            <select className="form-input" value={form.round_id || ''}
              onChange={e => set('round_id', e.target.value)}>
              <option value="">— No Round —</option>
              {rounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          {/* Question text */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Question Text</label>
            <textarea className="form-input form-textarea" value={form.question_text}
              onChange={e => set('question_text', e.target.value)}
              required={!isToss} rows={3} placeholder="Enter question..." />
            {errors.question_text && <span className="error-text">{errors.question_text[0]}</span>}
          </div>

          {isToss ? (
            /* ── Toss fields ── */
            <>
              <div className="toss-hints-form" style={{ marginBottom: 16 }}>
                <label className="form-label">Hints (revealed one by one)</label>
                {[1,2,3,4,5,6].map(n => (
                  <div key={n} className="toss-hint-row">
                    <span className="toss-hint-num-badge">{n}</span>
                    <input className="form-input" placeholder={`Hint ${n}`}
                      value={form[`hint_${n}`]}
                      onChange={e => set(`hint_${n}`, e.target.value)} />
                  </div>
                ))}
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Answer <span style={{ color: '#ef4444' }}>*</span></label>
                <LetterBoxInput value={form.toss_answer} onChange={v => set('toss_answer', v)} />
              </div>
            </>
          ) : (
            /* ── Regular MCQ fields ── */
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Question Slide Image <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>(optional)</span></label>
                  {imagePreview ? (
                    <div className="q-img-preview-wrap">
                      <img src={imagePreview} alt="question preview" className="q-img-preview" />
                      <button type="button" className="q-img-remove" onClick={handleRemoveImage} disabled={removingImg}>
                        {removingImg ? '…' : '✕'}
                      </button>
                    </div>
                  ) : (
                    <>
                      <input ref={imgInputRef} type="file" accept="image/*" id="q-img-input"
                        style={{ display: 'none' }} onChange={handleImageChange} />
                      <label htmlFor="q-img-input" className="q-img-upload-label">
                        🖼 Click to upload image (jpg, png, webp — max 5MB)
                      </label>
                    </>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Answer Slide Image <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>(optional)</span></label>
                  {answerImagePreview ? (
                    <div className="q-img-preview-wrap">
                      <img src={answerImagePreview} alt="answer preview" className="q-img-preview" />
                      <button type="button" className="q-img-remove" onClick={handleRemoveAnswerImage} disabled={removingAnswerImg}>
                        {removingAnswerImg ? '…' : '✕'}
                      </button>
                    </div>
                  ) : (
                    <>
                      <input ref={answerImgInputRef} type="file" accept="image/*" id="q-answer-img-input"
                        style={{ display: 'none' }} onChange={handleAnswerImageChange} />
                      <label htmlFor="q-answer-img-input" className="q-img-upload-label">
                        🖼 Click to upload image (jpg, png, webp — max 5MB)
                      </label>
                    </>
                  )}
                </div>
              </div>
              <p className="section-hint" style={{ marginBottom: 10 }}>
                Check to show option to users · Select radio button for correct answer
              </p>
              {['A','B','C','D'].map(l => {
                const showKey  = `show_option_${l.toLowerCase()}`
                const isVisible = !!form[showKey]
                const isCorrect = form.correct_answer === l
                return (
                  <div key={l} className={`option-row ${isCorrect ? 'option-row-correct' : ''} ${!isVisible ? 'option-row-hidden' : ''}`} style={{ marginBottom: 8 }}>
                    <label className="opt-show-cb" title={isVisible ? 'Visible to users' : 'Hidden from users'}>
                      <input type="checkbox" checked={isVisible} onChange={e => set(showKey, e.target.checked)} />
                    </label>
                    <label className="option-radio-label">
                      <input type="radio" name="correct" value={l} checked={isCorrect}
                        onChange={() => set('correct_answer', l)} className="option-radio" />
                      <span className={`option-badge ${isCorrect ? 'badge-correct' : 'badge-neutral'}`}>{l}</span>
                    </label>
                    <input className={`form-input option-input ${!isVisible ? 'option-input-hidden' : ''}`}
                      placeholder={`Option ${l}`} value={form[`option_${l.toLowerCase()}`]}
                      onChange={e => set(`option_${l.toLowerCase()}`, e.target.value)} />
                    {isCorrect && <span className="correct-indicator">✓ Correct</span>}
                    {!isVisible && <span className="hidden-indicator">Hidden</span>}
                  </div>
                )
              })}
            </>
          )}

          {errors._global && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: 8 }}>{errors._global}</p>}
          <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Update' : isToss ? 'Add Toss Question' : 'Add Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
