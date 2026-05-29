import React, { useEffect, useState } from 'react'
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

export default function QuestionFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isEdit) {
      api.get(`/questions/${id}`)
        .then(res => setForm(res.data))
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
        await api.post('/questions', form)
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
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Update Question' : 'Add Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
