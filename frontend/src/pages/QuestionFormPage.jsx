import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/axios'

const emptyForm = {
  question_text: '',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  correct_answer: 'A',
  order: 0,
  is_active: true,
}

function ImageUploadSection({ label, imageField, endpoint, currentUrl, onUploaded, onDeleted, disabled }) {
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [preview, setPreview] = useState(null)
  const inputRef = useRef()

  const imageUrl = preview || currentUrl

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    const fd = new FormData()
    fd.append('image', file)
    setUploading(true)
    try {
      const res = await api.post(endpoint, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      onUploaded(res.data)
      setPreview(null)
    } catch {
      setPreview(null)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(endpoint)
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {imageUrl ? (
        <div className="image-preview-wrap">
          <img src={imageUrl} alt={label} className="image-preview" />
          <div className="image-preview-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading || deleting || disabled}
            >
              {uploading ? 'Uploading…' : 'Replace'}
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleDelete}
              disabled={uploading || deleting || disabled || preview}
            >
              {deleting ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`image-drop-zone ${disabled ? 'image-drop-zone--disabled' : ''}`}
          onClick={() => !disabled && inputRef.current?.click()}
        >
          {uploading ? (
            <span>Uploading…</span>
          ) : disabled ? (
            <span>Save the question first to upload image</span>
          ) : (
            <>
              <span className="image-drop-icon">🖼</span>
              <span>Click to upload image</span>
              <span className="image-drop-hint">JPG, PNG, GIF, WebP — max 5 MB</span>
            </>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile}
        disabled={uploading || disabled}
      />
    </div>
  )
}

export default function QuestionFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState(isEdit ? Number(id) : null)
  const [questionImage, setQuestionImage] = useState(null)
  const [answerImage, setAnswerImage] = useState(null)

  useEffect(() => {
    if (isEdit) {
      api.get(`/questions/${id}`)
        .then(res => {
          setForm(res.data)
          setQuestionImage(res.data.image ? `/dadagiri/uploads/questions/${res.data.image}` : null)
          setAnswerImage(res.data.answer_image ? `/dadagiri/uploads/questions/${res.data.answer_image}` : null)
        })
        .catch(() => navigate('/admin/questions'))
        .finally(() => setLoading(false))
    }
  }, [id])

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrors({})
    setSaving(true)
    try {
      if (isEdit) {
        await api.put(`/questions/${id}`, form)
      } else {
        const res = await api.post('/questions', form)
        setSavedId(res.data.id)
        // stay on page so images can be uploaded
        return
      }
      navigate('/admin/questions')
    } catch (err) {
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading-state">Loading...</div>

  const qImageEndpoint = savedId ? `/questions/${savedId}/image` : null
  const aImageEndpoint = savedId ? `/questions/${savedId}/answer-image` : null

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEdit ? 'Edit Question' : 'Add New Question'}</h1>
          <p className="page-subtitle">{isEdit ? 'Update question details' : 'Create a new quiz question'}</p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/admin/questions')}>
          ← Back
        </button>
      </div>

      {savedId && !isEdit && (
        <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
          Question saved! You can now upload images below, then{' '}
          <button className="btn-link" onClick={() => navigate('/admin/questions')}>go back to questions</button>.
        </div>
      )}

      <div className="form-card">
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h3 className="section-title">Question</h3>
            <div className="form-group">
              <label className="form-label">Question Text *</label>
              <textarea
                className={`form-input form-textarea ${errors.question_text ? 'input-error' : ''}`}
                placeholder="Enter the question..."
                value={form.question_text}
                onChange={e => set('question_text', e.target.value)}
                rows={3}
                required
              />
              {errors.question_text && <span className="error-text">{errors.question_text[0]}</span>}
            </div>
          </div>

          <div className="form-section">
            <h3 className="section-title">Answer Options</h3>
            <p className="section-hint">Mark the correct answer by clicking the radio button</p>

            {['A', 'B', 'C', 'D'].map(letter => (
              <div key={letter} className={`option-row ${form.correct_answer === letter ? 'option-row-correct' : ''}`}>
                <label className="option-radio-label">
                  <input
                    type="radio"
                    name="correct_answer"
                    value={letter}
                    checked={form.correct_answer === letter}
                    onChange={() => set('correct_answer', letter)}
                    className="option-radio"
                  />
                  <span className={`option-badge ${form.correct_answer === letter ? 'badge-correct' : 'badge-neutral'}`}>
                    {letter}
                  </span>
                </label>
                <input
                  type="text"
                  className={`form-input option-input ${errors[`option_${letter.toLowerCase()}`] ? 'input-error' : ''}`}
                  placeholder={`Option ${letter}`}
                  value={form[`option_${letter.toLowerCase()}`]}
                  onChange={e => set(`option_${letter.toLowerCase()}`, e.target.value)}
                  required
                />
                {form.correct_answer === letter && (
                  <span className="correct-indicator">✓ Correct</span>
                )}
              </div>
            ))}
            {errors.correct_answer && <span className="error-text">{errors.correct_answer[0]}</span>}
          </div>

          <div className="form-section">
            <h3 className="section-title">Slide Images</h3>
            <div className="form-row">
              <ImageUploadSection
                label="Question Slide Image"
                imageField="image"
                endpoint={qImageEndpoint}
                currentUrl={questionImage}
                onUploaded={data => setQuestionImage(`/dadagiri/uploads/questions/${data.image}`)}
                onDeleted={() => setQuestionImage(null)}
                disabled={!savedId}
              />
              <ImageUploadSection
                label="Answer Slide Image"
                imageField="answer_image"
                endpoint={aImageEndpoint}
                currentUrl={answerImage}
                onUploaded={data => setAnswerImage(`/dadagiri/uploads/questions/${data.answer_image}`)}
                onDeleted={() => setAnswerImage(null)}
                disabled={!savedId}
              />
            </div>
          </div>

          <div className="form-section">
            <h3 className="section-title">Settings</h3>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Display Order</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.order}
                  onChange={e => set('order', parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => set('is_active', e.target.checked)}
                    className="toggle-input"
                  />
                  <span className="toggle-slider" />
                  <span className="toggle-text">{form.is_active ? 'Active' : 'Inactive'}</span>
                </label>
              </div>
            </div>
          </div>

          <div className="form-footer">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/admin/questions')} disabled={saving}>
              {savedId && !isEdit ? 'Done' : 'Cancel'}
            </button>
            {(!savedId || isEdit) && (
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : isEdit ? 'Update Question' : 'Add Question'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
