import React, { useEffect, useState } from 'react'
import api from '../../api/axios'

export default function RoundsPage() {
  const [rounds, setRounds]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [toggling, setToggling] = useState(null)
  const [editId, setEditId]     = useState(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    api.get('/rounds')
      .then(res => setRounds(res.data))
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (round) => {
    const next = round.status === 'active' ? 'inactive' : 'active'
    setToggling(round.id)
    try {
      const res = await api.put(`/rounds/${round.id}/status`, { status: next })
      setRounds(prev => prev.map(r => r.id === round.id ? res.data : r))
    } finally {
      setToggling(null)
    }
  }

  const startEdit = (round) => {
    setEditId(round.id)
    setEditName(round.name)
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditName('')
  }

  const handleSave = async (id) => {
    if (!editName.trim()) return
    setSaving(true)
    try {
      const res = await api.put(`/rounds/${id}`, { name: editName.trim() })
      setRounds(prev => prev.map(r => r.id === id ? res.data : r))
      cancelEdit()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading-state">Loading...</div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Round Master</h1>
          <p className="page-subtitle">Manage quiz round statuses</p>
        </div>
      </div>

      <div className="rounds-table-wrap">
        <table className="rounds-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Round Name</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r, i) => (
              <tr key={r.id} className={r.status === 'active' ? 'round-row-active' : ''}>
                <td className="round-sl">{i + 1}</td>
                <td className="round-name">
                  {editId === r.id ? (
                    <input
                      className="form-input"
                      style={{ padding: '4px 8px', fontSize: '0.9rem', width: '100%', maxWidth: 260 }}
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSave(r.id); if (e.key === 'Escape') cancelEdit() }}
                      autoFocus
                    />
                  ) : (
                    r.name
                  )}
                </td>
                <td>
                  <span className={`round-badge ${r.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                    {r.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {editId === r.id ? (
                    <>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleSave(r.id)}
                        disabled={saving || !editName.trim()}
                      >
                        {saving ? '...' : 'Save'}
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={cancelEdit} disabled={saving}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => startEdit(r)}
                        disabled={toggling === r.id}
                      >
                        Edit
                      </button>
                      <button
                        className={`btn btn-sm ${r.status === 'active' ? 'btn-danger' : 'btn-primary'}`}
                        onClick={() => handleToggle(r)}
                        disabled={toggling === r.id}
                      >
                        {toggling === r.id
                          ? '...'
                          : r.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
