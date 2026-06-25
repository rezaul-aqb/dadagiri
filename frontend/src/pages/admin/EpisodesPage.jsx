import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'

const STATUS_COLORS = {
  draft:     { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', label: 'Draft' },
  active:    { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e', label: 'Active' },
  completed: { bg: 'rgba(99,102,241,0.15)',  color: '#818cf8', label: 'Completed' },
}

export default function EpisodesPage() {
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetch = () => {
    setLoading(true)
    api.get('/episodes').then(r => setEpisodes(r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { fetch() }, [])

  const openAdd  = () => { setEditItem(null); setShowForm(true) }
  const openEdit = (ep) => { setEditItem(ep); setShowForm(true) }

  const handleDelete = async () => {
    setDeleting(true)
    await api.delete(`/episodes/${deleteId}`)
    setDeleteId(null)
    setDeleting(false)
    fetch()
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Episodes</h1>
          <p className="page-subtitle">{episodes.length} episode{episodes.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ New Episode</button>
      </div>

      {loading ? <div className="loading-state">Loading...</div> : (
        <div className="ep-grid">
          {episodes.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🎬</div>
              <p>No episodes yet. Create your first episode!</p>
            </div>
          )}
          {episodes.map(ep => {
            const s = STATUS_COLORS[ep.status] || STATUS_COLORS.draft
            return (
              <div key={ep.id} className={`ep-card${ep.status === 'completed' ? ' ep-card-completed' : ''}`}>
                <div className="ep-card-top">
                  <div className="ep-number">
                    <span className="ep-season">S{ep.season ?? 1}</span>
                    <span>EP {ep.episode_no}</span>
                  </div>
                  <span className="status-badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                </div>
                <h3 className="ep-name">{ep.name}</h3>
                <div className="ep-meta">
                  {ep.start_date && <span>📅 {ep.start_date}</span>}
                  {ep.end_date   && <span>→ {ep.end_date}</span>}
                </div>
                <div className="ep-stats">
                  <div className="ep-stat">
                    <span className="ep-stat-val">{ep.question_count}</span>
                    <span className="ep-stat-label">Questions</span>
                  </div>
                  <div className="ep-stat">
                    <span className="ep-stat-val">{ep.participant_count}</span>
                    <span className="ep-stat-label">Participants</span>
                  </div>
                  <div className="ep-stat" style={{ display: 'none' }}>
                    <span className="ep-stat-val">{ep.time_per_question ?? 30}s</span>
                    <span className="ep-stat-label">Per Q</span>
                  </div>
                </div>
                <div className="ep-actions">
                  <Link to={`/admin/episodes/${ep.id}/questions`} className="btn btn-sm btn-primary">
                    📝 Questions
                  </Link>
                  <Link to={`/admin/episodes/${ep.id}/participants`} className="btn btn-sm btn-secondary">
                    👥 Participants
                  </Link>
                  <Link to={`/admin/episodes/${ep.id}/round-scores`} className="btn btn-sm btn-secondary">
                    📊 Scores
                  </Link>
                  <button className="btn btn-sm btn-secondary" onClick={() => openEdit(ep)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => setDeleteId(ep.id)}>Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <EpisodeFormModal
          item={editItem}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetch() }}
        />
      )}

      {deleteId && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">🗑️</div>
            <h2 className="modal-title">Delete Episode?</h2>
            <p className="modal-text">All questions and results for this episode will also be deleted.</p>
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

function EpisodeFormModal({ item, onClose, onSaved }) {
  const isEdit = Boolean(item)
  const [form, setForm]     = useState(item || { season: 1, name: '', episode_no: '', status: 'draft', start_date: '', end_date: '', time_per_question: 30 })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      if (isEdit) await api.put(`/episodes/${item.id}`, form)
      else        await api.post('/episodes', form)
      onSaved()
    } catch (err) {
      if (err.response?.data?.errors) setErrors(err.response.data.errors)
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460, textAlign: 'left' }} onClick={e => e.stopPropagation()}>
        <h2 className="modal-title" style={{ textAlign: 'left', marginBottom: 20 }}>
          {isEdit ? 'Edit Episode' : 'New Episode'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Season</label>
              <input className="form-input" type="number" value={form.season} onChange={e => set('season', e.target.value)} required min={1} placeholder="1" />
            </div>
            <div className="form-group">
              <label className="form-label">Episode No.</label>
              <input className="form-input" type="number" value={form.episode_no} onChange={e => set('episode_no', e.target.value)} required min={1} />
              {errors.episode_no && <span className="error-text">{errors.episode_no[0]}</span>}
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Episode Name</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Episode 1" />
              {errors.name && <span className="error-text">{errors.name[0]}</span>}
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="form-group" style={{ display: 'none' }}>
              <label className="form-label">Time per Question (sec)</label>
              <input
                className="form-input"
                type="number"
                min={5}
                max={120}
                value={form.time_per_question}
                onChange={e => set('time_per_question', e.target.value)}
              />
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: 20 }}>
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input className="form-input" type="date" value={form.start_date || ''} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input className="form-input" type="date" value={form.end_date || ''} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>
          <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Create Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
