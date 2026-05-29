import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import WB_DISTRICTS from '../data/districts'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm]         = useState({ name: '', phone: '', district: '' })
  const [errors, setErrors]     = useState({})
  const [loading, setLoading]   = useState(false)
  const [phoneExists, setPhoneExists] = useState(false)

  const set = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: null }))
    if (field === 'phone') setPhoneExists(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrors({})
    setPhoneExists(false)
    setLoading(true)
    try {
      const res = await api.post('/register', form)
      sessionStorage.setItem('quiz_user', JSON.stringify(res.data.user))
      navigate('/quiz')
    } catch (err) {
      const errs = err.response?.data?.errors
      if (errs) {
        setErrors(errs)
        if (errs.phone?.[0]?.includes('already registered')) setPhoneExists(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleContinueExisting = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/user/lookup?phone=${encodeURIComponent(form.phone)}`)
      sessionStorage.setItem('quiz_user', JSON.stringify(res.data.user))
      navigate('/quiz')
    } catch {
      setErrors({ phone: ['Could not find your registration. Please contact support.'] })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="user-page">
      {/* Background stars/particles */}
      <div className="user-bg">
        <div className="bg-circle bg-circle-1" />
        <div className="bg-circle bg-circle-2" />
        <div className="bg-circle bg-circle-3" />
      </div>

      <div className="user-container">
        {/* Logo */}
        <div className="user-logo-wrap">
          <img src={import.meta.env.BASE_URL + "logo.png"} alt="Dadagiri Unlimited" className="user-logo" />
        </div>

        {/* Form Card */}
        <div className="user-card">
          <div className="user-card-header">
            <h2 className="user-card-title">Join the Quiz!</h2>
            <p className="user-card-subtitle">Fill in your details to start playing</p>
          </div>

          <form onSubmit={handleSubmit} className="user-form">

            {/* Name */}
            <div className="user-form-group">
              <label className="user-label">
                <span className="user-label-icon">👤</span> Full Name
              </label>
              <input
                type="text"
                className={`user-input ${errors.name ? 'user-input-error' : ''}`}
                placeholder="Enter your full name"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                required
                autoFocus
              />
              {errors.name && <span className="user-error">{errors.name[0]}</span>}
            </div>

            {/* Phone */}
            <div className="user-form-group">
              <label className="user-label">
                <span className="user-label-icon">📱</span> Phone Number
              </label>
              <input
                type="tel"
                className={`user-input ${errors.phone ? 'user-input-error' : ''}`}
                placeholder="Enter your phone number"
                value={form.phone}
                onChange={e => set('phone', e.target.value.replace(/\D/g, ''))}
                maxLength={15}
                required
              />
              {errors.phone && <span className="user-error">{errors.phone[0]}</span>}
              {phoneExists && (
                <button
                  type="button"
                  className="user-already-btn"
                  onClick={handleContinueExisting}
                  disabled={loading}
                >
                  Already registered? Continue to Quiz →
                </button>
              )}
            </div>

            {/* District */}
            <div className="user-form-group">
              <label className="user-label">
                <span className="user-label-icon">📍</span> District (West Bengal)
              </label>
              <div className="user-select-wrap">
                <select
                  className={`user-select ${errors.district ? 'user-input-error' : ''}`}
                  value={form.district}
                  onChange={e => set('district', e.target.value)}
                  required
                >
                  <option value="">-- Select your district --</option>
                  {WB_DISTRICTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <span className="user-select-arrow">▾</span>
              </div>
              {errors.district && <span className="user-error">{errors.district[0]}</span>}
            </div>

            <button
              type="submit"
              className="user-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <span className="btn-loading"><span className="btn-spinner" /> Registering...</span>
              ) : (
                <span>Start Playing  🎯</span>
              )}
            </button>

          </form>
        </div>

        <p className="user-footer-note">
          Your phone number will be used to identify your entry. No duplicates allowed.
        </p>
      </div>
    </div>
  )
}
