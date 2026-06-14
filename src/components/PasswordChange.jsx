import { useState } from 'react'
import { changePassword } from '../services/profiles'
import { toast } from 'react-toastify'
import { getPasswordStrength, RULES } from '../security/validators'

/**
 * Reusable password change form with strength indicator.
 * Uses unified validation rules from validators.js.
 *
 * Props:
 * - onSuccess: () => void — callback after successful change
 */
export default function PasswordChange({ onSuccess }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  function validate() {
    const errs = {}
    if (!newPassword) {
      errs.newPassword = RULES.password.messages.required
    } else if (newPassword.length < RULES.password.minLength) {
      errs.newPassword = RULES.password.messages.minLength
    } else if (!RULES.password.pattern.test(newPassword)) {
      errs.newPassword = RULES.password.messages.pattern
    }

    if (!confirmPassword) errs.confirmPassword = 'Please confirm your password'
    else if (newPassword !== confirmPassword) errs.confirmPassword = 'Passwords do not match'

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return

    try {
      setSaving(true)
      await changePassword(newPassword)
      toast.success('Password changed successfully!')
      setNewPassword('')
      setConfirmPassword('')
      setErrors({})
      onSuccess?.()
    } catch (err) {
      toast.error(err.message || 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  const strength = getPasswordStrength(newPassword)

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label className="form-label-custom" htmlFor="password-change-new">New Password</label>
        <div style={{ position: 'relative' }}>
          <input
            id="password-change-new"
            type={showPassword ? 'text' : 'password'}
            className={`form-input-custom ${errors.newPassword ? 'error' : ''}`}
            placeholder="Min 8 characters, uppercase, lowercase, number, special"
            value={newPassword}
            onChange={e => { setNewPassword(e.target.value); setErrors(prev => ({ ...prev, newPassword: null })) }}
            maxLength={128}
            autoComplete="new-password"
            style={{ paddingRight: 44 }}
          />
          <button
            type="button"
            className="password-toggle-btn"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
          </button>
        </div>
        {errors.newPassword && (
          <span className="form-error"><i className="bi bi-exclamation-circle" />{errors.newPassword}</span>
        )}

        {/* Strength meter */}
        {newPassword && (
          <div className="mt-2">
            <div className="password-strength-meter">
              <div
                className="password-strength-fill"
                style={{
                  width: `${(strength.level / 5) * 100}%`,
                  background: strength.color
                }}
              />
            </div>
            <span className="password-strength-label" style={{ color: strength.color }}>
              {strength.label}
            </span>
            <div className="password-requirements">
              {[
                { key: 'length8', label: '8+ chars' },
                { key: 'uppercase', label: 'A-Z' },
                { key: 'lowercase', label: 'a-z' },
                { key: 'digit', label: '0-9' },
                { key: 'special', label: 'Special' },
              ].map(req => (
                <span key={req.key} className={`password-req-item ${strength.checks[req.key] ? 'met' : ''}`}>
                  <i className={`bi ${strength.checks[req.key] ? 'bi-check-circle-fill' : 'bi-circle'}`} />
                  {req.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mb-4">
        <label className="form-label-custom" htmlFor="password-change-confirm">Confirm New Password</label>
        <input
          id="password-change-confirm"
          type={showPassword ? 'text' : 'password'}
          className={`form-input-custom ${errors.confirmPassword ? 'error' : ''}`}
          placeholder="Re-enter your new password"
          value={confirmPassword}
          onChange={e => { setConfirmPassword(e.target.value); setErrors(prev => ({ ...prev, confirmPassword: null })) }}
          maxLength={128}
          autoComplete="new-password"
        />
        {errors.confirmPassword && (
          <span className="form-error"><i className="bi bi-exclamation-circle" />{errors.confirmPassword}</span>
        )}
      </div>

      <button
        id="password-change-submit"
        type="submit"
        className="btn-primary-custom"
        disabled={saving || !newPassword || !confirmPassword}
        style={{ padding: '10px 24px' }}
      >
        {saving ? (
          <><div className="spinner-custom" style={{ width: 18, height: 18, borderWidth: 2 }} /> Changing...</>
        ) : (
          <><i className="bi bi-shield-lock" /> Update Password</>
        )}
      </button>
    </form>
  )
}
