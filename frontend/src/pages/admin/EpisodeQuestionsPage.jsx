import React, { useEffect, useRef, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import api from '../../api/axios'

const emptyForm = {
  question_text: '', option_a: '', option_b: '', option_c: '', option_d: '',
  correct_answer: 'A', order: 0, is_active: true,
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

  // Drag state
  const dragIdx  = useRef(null)
  const overIdx  = useRef(null)
  const [dragOver, setDragOver] = useState(null)

  const fetchData = () => {
    setLoading(true)
    Promise.all([
      api.get(`/episodes/${episodeId}`),
      api.get(`/questions?episode_id=${episodeId}`),
    ]).then(([ep, qs]) => {
      setEpisode(ep.data)
      setQuestions(qs.data)
    }).finally(() => setLoading(false))
  }
  useEffect(() => { fetchData() }, [episodeId])

  const handleDelete = async () => {
    setDeleting(true)
    await api.delete(`/questions/${deleteId}`)
    setDeleteId(null)
    setDeleting(false)
    fetchData()
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
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
            📥 Import Excel
          </button>
          <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowForm(true) }}>
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

      {questions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <p>No questions for this episode yet.</p>
          <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowForm(true) }}>Add First Question</button>
        </div>
      ) : (
        <div className="question-list">
          {questions.map((q, i) => (
            <div
              key={q.id}
              className={`question-card${dragOver === i ? ' drag-over' : ''}`}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragEnter={() => onDragEnter(i)}
              onDragEnd={onDragEnd}
              onDrop={onDrop}
              onDragOver={e => e.preventDefault()}
            >
              <div className="question-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="drag-handle" title="Drag to reorder">⠿</span>
                  <span className="question-number">Q{i + 1}</span>
                </div>
                <div className="question-actions">
                  <button className="btn btn-sm btn-secondary" onClick={() => { setEditItem(q); setShowForm(true) }}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => setDeleteId(q.id)}>Delete</button>
                </div>
              </div>
              <p className="question-text">{q.question_text}</p>
              <div className="options-grid">
                {['A','B','C','D'].map(l => (
                  <div key={l} className={`option-item ${q.correct_answer === l ? 'correct' : ''}`}>
                    <span className="option-label">{l}</span>
                    <span className="option-text">{q[`option_${l.toLowerCase()}`]}</span>
                    {q.correct_answer === l && <span className="correct-badge">✓</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <QuestionFormModal
          item={editItem}
          episodeId={episodeId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchData() }}
        />
      )}

      {showImport && (
        <ImportModal
          episodeId={episodeId}
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); fetchData() }}
        />
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

function QuestionFormModal({ item, episodeId, onClose, onSaved }) {
  const isEdit = Boolean(item)
  const [form, setForm]     = useState(item || { ...emptyForm, episode_id: episodeId })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault(); setErrors({}); setSaving(true)
    try {
      if (isEdit) await api.put(`/questions/${item.id}`, form)
      else        await api.post('/questions', { ...form, episode_id: episodeId })
      onSaved()
    } catch (err) {
      if (err.response?.data?.errors) setErrors(err.response.data.errors)
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, textAlign: 'left', padding: 28 }} onClick={e => e.stopPropagation()}>
        <h2 className="modal-title" style={{ textAlign: 'left', marginBottom: 20 }}>
          {isEdit ? 'Edit Question' : 'Add Question'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Question Text</label>
            <textarea className="form-input form-textarea" value={form.question_text}
              onChange={e => set('question_text', e.target.value)} required rows={3} placeholder="Enter question..." />
            {errors.question_text && <span className="error-text">{errors.question_text[0]}</span>}
          </div>
          <p className="section-hint" style={{ marginBottom: 10 }}>Select the radio button next to the correct answer</p>
          {['A','B','C','D'].map(l => (
            <div key={l} className={`option-row ${form.correct_answer === l ? 'option-row-correct' : ''}`} style={{ marginBottom: 8 }}>
              <label className="option-radio-label">
                <input type="radio" name="correct" value={l} checked={form.correct_answer === l}
                  onChange={() => set('correct_answer', l)} className="option-radio" />
                <span className={`option-badge ${form.correct_answer === l ? 'badge-correct' : 'badge-neutral'}`}>{l}</span>
              </label>
              <input className="form-input option-input" placeholder={`Option ${l}`}
                value={form[`option_${l.toLowerCase()}`]}
                onChange={e => set(`option_${l.toLowerCase()}`, e.target.value)} required />
              {form.correct_answer === l && <span className="correct-indicator">✓ Correct</span>}
            </div>
          ))}
          <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
