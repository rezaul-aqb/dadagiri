import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]')
    const prev = link?.href
    if (link) link.href = import.meta.env.BASE_URL + 'admin-manifest.webmanifest'
    return () => { if (link && prev) link.href = prev }
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
    navigate('/admin/login')
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={import.meta.env.BASE_URL + "logo.png"} alt="Dadagiri Unlimited" className="sidebar-logo" />
          <span className="brand-sub">Admin Panel</span>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/admin/episodes" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span className="nav-icon">🎬</span> Episodes
          </NavLink>
          <NavLink to="/admin/users" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span className="nav-icon">👥</span> Users
          </NavLink>
          <NavLink to="/admin/rounds" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span className="nav-icon">🏏</span> Round Master
          </NavLink>
          <NavLink to="/admin/district-scores" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span className="nav-icon">🗺️</span> District Scores
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.name?.[0] || 'A'}</div>
            <div>
              <div className="user-name">{user?.name}</div>
              <div className="user-role">Administrator</div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? '...' : '⏏ Logout'}
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
