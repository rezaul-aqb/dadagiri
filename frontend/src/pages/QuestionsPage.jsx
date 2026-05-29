import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'

export default function QuestionsPage() {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const fetchQuestions = () => {
    setLoading(true)
    api.get('/questions')
      .then(res => setQuestions(res.data))
      .catch(() => setError('Failed to load questions'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchQuestions() }, [])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/questions/${deleteId}`)
      setDeleteId(null)
      fetchQuestions()
    } catch {
      setError('Failed to delete question')
    } finally {
      setDeleting(false)
    }
  }

  const optionLabels = { A: 'A', B: 'B', C: 'C', D: 'D' }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Questions</h1>
          <p className="page-subtitle">{questions.length} question{questions.length !== 1 ? 's' : ''} total</p>
        </div>
        <Link to="/admin/questions/new" className="btn btn-primary">
          + Add Question
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-state">Loading questions...</div>
      ) : questions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <p>No questions yet. Add your first question!</p>
          <Link to="/admin/questions/new" className="btn btn-primary">Add Question</Link>
        </div>
      ) : (
        <div className="question-list">
          {questions.map((q, i) => (
            <div key={q.id} className="question-card">
              <div className="question-card-header">
                <span className="question-number">Q{i + 1}</span>
                <div className="question-actions">
                  <Link to={`/admin/questions/${q.id}/edit`} className="btn btn-sm btn-secondary">
                    Edit
                  </Link>
                  <button className="btn btn-sm btn-danger" onClick={() => setDeleteId(q.id)}>
                    Delete
                  </button>
                </div>
              </div>

              <p className="question-text">{q.question_text}</p>

              <div className="options-grid">
                {['A', 'B', 'C', 'D'].map(letter => (
                  <div key={letter} className={`option-item ${q.correct_answer === letter ? 'correct' : ''}`}>
                    <span className="option-label">{letter}</span>
                    <span className="option-text">{q[`option_${letter.toLowerCase()}`]}</span>
                    {q.correct_answer === letter && <span className="correct-badge">✓</span>}
                  </div>
                ))}
              </div>

              <div className="question-meta">
                <span className={`status-badge ${q.is_active ? 'active' : 'inactive'}`}>
                  {q.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="order-badge">Order: {q.order}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteId && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">🗑️</div>
            <h2 className="modal-title">Delete Question?</h2>
            <p className="modal-text">This action cannot be undone. All related answers will also be deleted.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)} disabled={deleting}>
                Cancel
              </button>
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
