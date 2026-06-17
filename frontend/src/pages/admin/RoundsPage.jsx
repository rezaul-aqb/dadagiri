import React, { useEffect, useState } from 'react'
import api from '../../api/axios'

export default function RoundsPage() {
  const [rounds, setRounds]   = useState([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)

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
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r, i) => (
              <tr key={r.id} className={r.status === 'active' ? 'round-row-active' : ''}>
                <td className="round-sl">{i + 1}</td>
                <td className="round-name">{r.name}</td>
                <td>
                  <span className={`round-badge ${r.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                    {r.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button
                    className={`btn btn-sm ${r.status === 'active' ? 'btn-danger' : 'btn-primary'}`}
                    onClick={() => handleToggle(r)}
                    disabled={toggling === r.id}
                  >
                    {toggling === r.id
                      ? '...'
                      : r.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
