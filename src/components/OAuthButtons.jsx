import { useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'

/**
 * Google + GitHub social sign-in buttons.
 * Works for both login and registration (Supabase creates the account on first
 * OAuth login). Clicking a button redirects to the provider.
 */
export default function OAuthButtons({ label = 'or continue with' }) {
  const { signInWithProvider } = useAuth()
  const [busy, setBusy] = useState('')

  async function go(provider) {
    try {
      setBusy(provider)
      await signInWithProvider(provider)
      // Page redirects to the provider; nothing else runs here on success.
    } catch (err) {
      toast.error(err.message || 'Could not start sign-in. Please try again.')
      setBusy('')
    }
  }

  return (
    <div>
      <div className="d-flex align-items-center gap-2 my-3" aria-hidden="true">
        <div style={{ flex: 1, height: 1, background: 'var(--gray-200)' }} />
        <span style={{ fontSize: 12, color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>{label}</span>
        <div style={{ flex: 1, height: 1, background: 'var(--gray-200)' }} />
      </div>

      <div className="d-flex gap-2">
        <button
          type="button"
          className="btn-outline-custom w-100 justify-content-center"
          onClick={() => go('google')}
          disabled={!!busy}
          aria-label="Continue with Google"
        >
          {busy === 'google'
            ? <div className="spinner-custom" style={{ width: 18, height: 18, borderWidth: 2 }} />
            : <><i className="bi bi-google" style={{ color: '#EA4335' }} /> Google</>}
        </button>
        <button
          type="button"
          className="btn-outline-custom w-100 justify-content-center"
          onClick={() => go('github')}
          disabled={!!busy}
          aria-label="Continue with GitHub"
        >
          {busy === 'github'
            ? <div className="spinner-custom" style={{ width: 18, height: 18, borderWidth: 2 }} />
            : <><i className="bi bi-github" style={{ color: '#181717' }} /> GitHub</>}
        </button>
      </div>
    </div>
  )
}
