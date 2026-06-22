import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import WB_DISTRICTS from '../data/districts'

export default function RegisterPage() {
  const navigate  = useNavigate()
  const phoneRef  = useRef(null)

  const [step,    setStep]    = useState(1)           // 1 = phone, 2 = details
  const [phone,   setPhone]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // Step-2 state
  const [existing, setExisting] = useState(null)      // existing user object if found
  const [name,     setName]     = useState('')
  const [district, setDistrict] = useState('')
  const [nameErr,  setNameErr]  = useState('')
  const [distErr,  setDistErr]  = useState('')
  const [editing,  setEditing]  = useState(false)

  // ── Step 1: check phone ──────────────────────────────────
  const handlePhoneNext = async (e) => {
    e.preventDefault()
    const p = phone.trim()
    if (!/^[0-9]{10,15}$/.test(p)) { setError('Enter a valid 10–15 digit phone number.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await api.get(`/user/lookup?phone=${encodeURIComponent(p)}`)
      // Phone exists — pre-fill details
      const u = res.data.user
      setExisting(u)
      setName(u.name || '')
      setDistrict(u.district || '')
      setStep(2)
    } catch (err) {
      if (err.response?.status === 404) {
        // New user — go to step 2 blank
        setExisting(null)
        setName('')
        setDistrict('')
        setStep(2)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Save edits for returning user ───────────────────────
  const handleSaveEdit = async (e) => {
    e.preventDefault()
    setNameErr('')
    setDistErr('')
    if (!name.trim()) { setNameErr('Name is required.'); return }
    if (!district)    { setDistErr('Please select your district.'); return }
    setLoading(true)
    try {
      const res = await api.put('/user/update', { id: existing.id, name: name.trim(), district })
      const updated = res.data.user
      setExisting(updated)
      setName(updated.name)
      setDistrict(updated.district)
      setEditing(false)
    } catch {
      setNameErr('Failed to save. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: register or continue ────────────────────────
  const handleDetailsSubmit = async (e) => {
    e.preventDefault()
    setNameErr('')
    setDistErr('')

    if (existing) {
      // Returning user — just navigate
      sessionStorage.setItem('quiz_user', JSON.stringify(existing))
      navigate('/quiz')
      return
    }

    // New user — validate then register
    let hasErr = false
    if (!name.trim()) { setNameErr('Name is required.'); hasErr = true }
    if (!district)    { setDistErr('Please select your district.'); hasErr = true }
    if (hasErr) return

    setLoading(true)
    try {
      const res = await api.post('/register', { name: name.trim(), phone, district })
      sessionStorage.setItem('quiz_user', JSON.stringify(res.data.user))
      navigate('/quiz')
    } catch (err) {
      const errs = err.response?.data?.errors || {}
      if (errs.name)     setNameErr(errs.name[0])
      if (errs.district) setDistErr(errs.district[0])
      if (errs.phone)    { setError(errs.phone[0]); setStep(1) }
    } finally {
      setLoading(false)
    }
  }

  const goBack = () => { setStep(1); setError(''); setExisting(null) }

  return (
    <div className="user-page">
      <div className="user-bg">
        <div className="bg-circle bg-circle-1" />
        <div className="bg-circle bg-circle-2" />
        <div className="bg-circle bg-circle-3" />
      </div>

      <div className="user-container">
        <div className="user-logo-wrap">
          <img src={import.meta.env.BASE_URL + 'logo.png'} alt="Dadagiri Unlimited" className="user-logo" />
        </div>

        <div className="user-card">

          {/* ── STEP 1: Phone ── */}
          {step === 1 && (
            <>
              <div className="user-card-header">
                <h2 className="user-card-title">Join the Quiz!</h2>
                <p className="user-card-subtitle">Enter your phone number to continue</p>
              </div>

              <form onSubmit={handlePhoneNext} className="user-form">
                <div className="user-form-group">
                  <label className="user-label">
                    <span className="user-label-icon">📱</span> Phone Number
                  </label>
                  <input
                    ref={phoneRef}
                    type="tel"
                    className={`user-input${error ? ' user-input-error' : ''}`}
                    placeholder="Enter your phone number"
                    value={phone}
                    onChange={e => { setPhone(e.target.value.replace(/\D/g, '')); setError('') }}
                    maxLength={15}
                    autoFocus
                    required
                  />
                  {error && <span className="user-error">{error}</span>}
                </div>

                <button type="submit" className="user-submit-btn" disabled={loading}>
                  {loading
                    ? <span className="btn-loading"><span className="btn-spinner" /> Checking...</span>
                    : <span>Continue →</span>
                  }
                </button>
              </form>
            </>
          )}

          {/* ── STEP 2: Details ── */}
          {step === 2 && (
            <>
              <div className="user-card-header">
                {existing
                  ? <><h2 className="user-card-title">Welcome back!</h2>
                      <p className="user-card-subtitle">Confirm your details to start playing</p></>
                  : <><h2 className="user-card-title">Create Profile</h2>
                      <p className="user-card-subtitle">Tell us a bit about yourself</p></>
                }
              </div>

              {/* ── Returning user — view mode ── */}
              {existing && !editing && (
                <form onSubmit={handleDetailsSubmit} className="user-form">
                  <div className="user-form-group">
                    <label className="user-label"><span className="user-label-icon">📱</span> Phone Number</label>
                    <div className="user-phone-confirmed">
                      <span>{phone}</span>
                      <button type="button" className="user-change-phone" onClick={goBack}>Change</button>
                    </div>
                  </div>
                  <div className="user-form-group">
                    <label className="user-label"><span className="user-label-icon">👤</span> Full Name</label>
                    <div className="user-input user-input-readonly" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{name}</span>
                    </div>
                  </div>
                  <div className="user-form-group">
                    <label className="user-label"><span className="user-label-icon">📍</span> District</label>
                    <div className="user-input user-input-readonly" style={{ display: 'flex', alignItems: 'center' }}>
                      {district || '—'}
                    </div>
                  </div>
                  <button type="button" className="user-edit-btn" onClick={() => setEditing(true)}>
                    ✏️ Edit Details
                  </button>
                  <button type="submit" className="user-submit-btn" disabled={loading}>
                    {loading
                      ? <span className="btn-loading"><span className="btn-spinner" /> Please wait...</span>
                      : <span>Start Playing 🎯</span>
                    }
                  </button>
                </form>
              )}

              {/* ── Returning user — edit mode ── */}
              {existing && editing && (
                <form onSubmit={handleSaveEdit} className="user-form">
                  <div className="user-form-group">
                    <label className="user-label"><span className="user-label-icon">👤</span> Full Name</label>
                    <input
                      type="text"
                      className={`user-input${nameErr ? ' user-input-error' : ''}`}
                      placeholder="Enter your full name"
                      value={name}
                      onChange={e => { setName(e.target.value); setNameErr('') }}
                      autoFocus
                    />
                    {nameErr && <span className="user-error">{nameErr}</span>}
                  </div>
                  <div className="user-form-group">
                    <label className="user-label"><span className="user-label-icon">📍</span> District (West Bengal)</label>
                    <div className="user-select-wrap">
                      <select
                        className={`user-select${distErr ? ' user-input-error' : ''}`}
                        value={district}
                        onChange={e => { setDistrict(e.target.value); setDistErr('') }}
                      >
                        <option value="">-- Select your district --</option>
                        {WB_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <span className="user-select-arrow">▾</span>
                    </div>
                    {distErr && <span className="user-error">{distErr}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="user-edit-btn" onClick={() => { setEditing(false); setNameErr(''); setDistErr('') }} style={{ flex: 1 }}>
                      Cancel
                    </button>
                    <button type="submit" className="user-submit-btn" disabled={loading} style={{ flex: 2 }}>
                      {loading
                        ? <span className="btn-loading"><span className="btn-spinner" /> Saving...</span>
                        : <span>Save Changes ✓</span>
                      }
                    </button>
                  </div>
                </form>
              )}

              {/* ── New user ── */}
              {!existing && (
                <form onSubmit={handleDetailsSubmit} className="user-form">
                  <div className="user-form-group">
                    <label className="user-label"><span className="user-label-icon">📱</span> Phone Number</label>
                    <div className="user-phone-confirmed">
                      <span>{phone}</span>
                      <button type="button" className="user-change-phone" onClick={goBack}>Change</button>
                    </div>
                  </div>
                  <div className="user-form-group">
                    <label className="user-label"><span className="user-label-icon">👤</span> Full Name</label>
                    <input
                      type="text"
                      className={`user-input${nameErr ? ' user-input-error' : ''}`}
                      placeholder="Enter your full name"
                      value={name}
                      onChange={e => { setName(e.target.value); setNameErr('') }}
                      autoFocus
                      required
                    />
                    {nameErr && <span className="user-error">{nameErr}</span>}
                  </div>
                  <div className="user-form-group">
                    <label className="user-label"><span className="user-label-icon">📍</span> District (West Bengal)</label>
                    <div className="user-select-wrap">
                      <select
                        className={`user-select${distErr ? ' user-input-error' : ''}`}
                        value={district}
                        onChange={e => { setDistrict(e.target.value); setDistErr('') }}
                        required
                      >
                        <option value="">-- Select your district --</option>
                        {WB_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <span className="user-select-arrow">▾</span>
                    </div>
                    {distErr && <span className="user-error">{distErr}</span>}
                  </div>
                  <button type="submit" className="user-submit-btn" disabled={loading}>
                    {loading
                      ? <span className="btn-loading"><span className="btn-spinner" /> Please wait...</span>
                      : <span>Register & Start Playing 🎯</span>
                    }
                  </button>
                </form>
              )}
            </>
          )}

        </div>

        <p className="user-footer-note">
          Your phone number will be used to identify your entry. No duplicates allowed.
        </p>
      </div>
    </div>
  )
}
