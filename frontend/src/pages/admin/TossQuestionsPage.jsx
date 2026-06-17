import React, { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../../api/axios'

const EMPTY_FORM = {
  question_text: '',
  hint_1: '', hint_2: '', hint_3: '', hint_4: '', hint_5: '', hint_6: '',
  answer: '',
}

// ── Letter-box answer input ───────────────────────────────────────────
function LetterBoxInput({ value, onChange }) {
  const inputRef = useRef(null)
  const display  = (value || '').toUpperCase()

  const handleKeyDown = (e) => {
    if (e.key === 'Backspace') {
      onChange(display.slice(0, -1))
      e.preventDefault()
    }
  }

  const handleInput = (e) => {
    const raw  = e.target.value.toUpperCase()
    const last = raw.slice(-1)
    if (/[A-Z0-9 ]/.test(last)) {
      onChange(display + last)
    }
    e.target.value = ''
  }

  const chars = display.split('')

  return (
    <div className="toss-answer-wrap" onClick={() => inputRef.current?.focus()}>
      <div className="toss-letter-boxes">
        {chars.map((ch, i) =>
          ch === ' '
            ? <span key={i} className="toss-letter-gap" />
            : <span key={i} className="toss-letter-box">{ch}</span>
        )}
        <span className="toss-letter-box toss-letter-cursor">_</span>
      </div>
      <input
        ref={inputRef}
        className="toss-hidden-input"
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        autoComplete="off"
        readOnly={false}
        value=""
        onChange={() => {}}
      />
      <p className="toss-answer-hint">
        Click above and type your answer — letters fill in one by one. Backspace to erase.
      </p>
    </div>
  )
}

// ── Read-only answer display ──────────────────────────────────────────
function AnswerDisplay({ answer, revealed = false }) {
  const chars = (answer || '').toUpperCase().split('')
  return (
    <div className="toss-letter-boxes toss-letter-boxes-sm">
      {chars.map((ch, i) =>
        ch === ' '
          ? <span key={i} className="toss-letter-gap-sm" />
          : <span key={i} className={`toss-letter-box-sm${revealed ? ' revealed' : ''}`}>
              {revealed ? ch : ''}
            </span>
      )}
    </div>
  )
}

export default function TossQuestionsPage() {
  const { episodeId } = useParams()
  const [questions, setQuestions] = useState([])
  const [episode,   setEpisode]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [editItem,  setEditItem]  = useState(null)
  const [deleteId,  setDeleteId]  = useState(null)
  const [deleting,  setDeleting]  = useState(false)
  const [acting,    setActing]    = useState({})   // { [id]: true } spinner per button

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get(`/toss-questions?episode_id=${episodeId}`),
      api.get(`/episodes/${episodeId}`),
    ]).then(([tRes, eRes]) => {
      setQuestions(tRes.data)
      setEpisode(eRes.data)
    }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [episodeId])

  const act = async (id, fn) => {
    setActing(a => ({ ...a, [id]: true }))
    try { await fn() } finally { setActing(a => ({ ...a, [id]: false })) }
  }

  const goLive = (q) => act(q.id, async () => {
    await api.post(`/toss-questions/${q.id}/live`)
    load()
  })

  const stopLive = () => act('stop', async () => {
    await api.delete('/toss-questions/live')
    load()
  })

  const revealHint = (q) => act(`hint-${q.id}`, async () => {
    await api.post(`/toss-questions/${q.id}/reveal-hint`)
    load()
  })

  const resetHints = (q) => act(`reset-${q.id}`, async () => {
    await api.post(`/toss-questions/${q.id}/reset-hints`)
    load()
  })

  const handleDelete = async () => {
    setDeleting(true)
    await api.delete(`/toss-questions/${deleteId}`)
    setDeleteId(null)
    setDeleting(false)
    load()
  }

  const liveQ = questions.find(q => q.is_live == 1)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">
            <Link to="/admin/episodes">Episodes</Link>
            {episode && <> / <Link to={`/admin/episodes/${episodeId}/questions`}>EP {episode.episode_no}</Link></>}
            {' '}/ Toss Round
          </div>
          <h1 className="page-title">Toss Round</h1>
          <p className="page-subtitle">{questions.length} question{questions.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowForm(true) }}>
          + Add Question
        </button>
      </div>

      {/* Live control bar */}
      {liveQ && (
        <div className="toss-live-bar">
          <div className="toss-live-bar-left">
            <span className="toss-live-dot" />
            <span className="toss-live-label">LIVE — Toss Round</span>
            <span className="toss-live-hints">{liveQ.hints_revealed}/6 hints revealed</span>
          </div>
          <div className="toss-live-bar-right">
            <button
              className="btn btn-sm btn-success"
              onClick={() => revealHint(liveQ)}
              disabled={acting[`hint-${liveQ.id}`] || liveQ.hints_revealed >= 6}
            >
              {acting[`hint-${liveQ.id}`] ? '…' : `Reveal Hint ${liveQ.hints_revealed + 1}`}
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => resetHints(liveQ)}
              disabled={acting[`reset-${liveQ.id}`]}
            >
              {acting[`reset-${liveQ.id}`] ? '…' : 'Reset Hints'}
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={stopLive}
              disabled={acting['stop']}
            >
              {acting['stop'] ? '…' : 'Stop Live'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-state">Loading...</div>
      ) : questions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <p>No toss questions yet. Add your first one!</p>
        </div>
      ) : (
        <div className="toss-list">
          {questions.map(q => {
            const isLive     = q.is_live == 1
            const revealed   = (int => int)(parseInt(q.hints_revealed) || 0)
            const hints      = [q.hint_1, q.hint_2, q.hint_3, q.hint_4, q.hint_5, q.hint_6]
            const allRevealed = revealed >= 6

            return (
              <div key={q.id} className={`toss-card${isLive ? ' toss-card-live' : ''}`}>
                {/* Header */}
                <div className="toss-card-header">
                  {isLive && <span className="toss-badge-live">● LIVE</span>}
                  <div className="toss-card-actions">
                    {!isLive ? (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => goLive(q)}
                        disabled={acting[q.id]}
                      >
                        {acting[q.id] ? '…' : '▶ Go Live'}
                      </button>
                    ) : (
                      <>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => revealHint(q)}
                          disabled={acting[`hint-${q.id}`] || allRevealed}
                        >
                          {acting[`hint-${q.id}`] ? '…' : allRevealed ? 'All Revealed' : `Hint ${revealed + 1} ›`}
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => resetHints(q)}
                          disabled={acting[`reset-${q.id}`]}
                        >
                          {acting[`reset-${q.id}`] ? '…' : '↺ Reset'}
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={stopLive}
                          disabled={acting['stop']}
                        >
                          {acting['stop'] ? '…' : '■ Stop'}
                        </button>
                      </>
                    )}
                    <button className="btn btn-sm btn-secondary" onClick={() => { setEditItem(q); setShowForm(true) }}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => setDeleteId(q.id)}>Delete</button>
                  </div>
                </div>

                {/* Question */}
                {q.question_text && (
                  <p className="toss-question-text">{q.question_text}</p>
                )}

                {/* Hints grid */}
                <div className="toss-hints-grid">
                  {hints.map((h, i) => {
                    const num       = i + 1
                    const isRevealed = num <= revealed
                    return (
                      <div key={i} className={`toss-hint${isRevealed ? ' toss-hint-revealed' : ' toss-hint-hidden'}`}>
                        <span className="toss-hint-num">Hint {num}</span>
                        <span className="toss-hint-text">{isRevealed ? (h || '—') : (h ? '••••••' : '—')}</span>
                        {isRevealed && <span className="toss-hint-check">✓</span>}
                      </div>
                    )
                  })}
                </div>

                {/* Answer */}
                <div className="toss-answer-section">
                  <span className="toss-answer-label">Answer</span>
                  <AnswerDisplay answer={q.answer} revealed={true} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <TossFormModal
          item={editItem}
          episodeId={episodeId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">🗑️</div>
            <h2 className="modal-title">Delete Toss Question?</h2>
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

function TossFormModal({ item, episodeId, onClose, onSaved }) {
  const isEdit = Boolean(item)
  const [form, setForm]     = useState(item ? {
    question_text: item.question_text || '',
    hint_1: item.hint_1 || '', hint_2: item.hint_2 || '',
    hint_3: item.hint_3 || '', hint_4: item.hint_4 || '',
    hint_5: item.hint_5 || '', hint_6: item.hint_6 || '',
    answer: item.answer || '',
  } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.answer.trim()) { setError('Answer is required'); return }
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, episode_id: episodeId }
      if (isEdit) await api.put(`/toss-questions/${item.id}`, payload)
      else        await api.post('/toss-questions', payload)
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

        {/* Question text */}
        <div className="form-group">
          <label className="form-label">Question Text <span className="form-optional">(optional)</span></label>
          <textarea
            className="form-input"
            rows={2}
            value={form.question_text}
            onChange={e => set('question_text', e.target.value)}
            placeholder="Enter the question (shown to admin only)"
          />
        </div>

        {/* Hints */}
        <div className="toss-hints-form">
          <label className="form-label">Hints (reveal one by one)</label>
          {[1,2,3,4,5,6].map(n => (
            <div key={n} className="toss-hint-row">
              <span className="toss-hint-num-badge">{n}</span>
              <input
                className="form-input"
                placeholder={`Hint ${n}`}
                value={form[`hint_${n}`]}
                onChange={e => set(`hint_${n}`, e.target.value)}
              />
            </div>
          ))}
        </div>

        {/* Answer */}
        <div className="form-group">
          <label className="form-label">Answer <span className="form-required">*</span></label>
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
