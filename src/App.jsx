import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import { makeStorage } from './db'
import TaskManager from './TaskManager'
import { LogOut, Loader2, CheckCircle2 } from 'lucide-react'

const accent = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'

// ---------------------------------------------------------------------------
// Auth gate: shows an auth screen until there is a session, then mounts the
// TaskManager with window.storage wired to the signed-in user.
// ---------------------------------------------------------------------------
export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  // When Supabase sends a recovery link the user lands back here with a
  // PASSWORD_RECOVERY event; we show the "set a new password" screen then.
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(sess)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <Centered>
        <Loader2 size={28} className="ptm-spin" />
      </Centered>
    )
  }

  if (recovery) {
    return <ResetPasswordScreen onDone={() => setRecovery(false)} />
  }

  if (!session) {
    return <AuthScreen />
  }

  return <Authed session={session} />
}

// Sets window.storage for the signed-in user, then mounts TaskManager. The
// `key` forces a clean remount if the user changes.
function Authed({ session }) {
  const user = session.user
  const storage = useMemo(() => makeStorage(user.id), [user.id])

  // Set synchronously during render. React runs child effects before parent
  // effects, so TaskManager's mount effect would otherwise see no storage.
  if (window.storage !== storage) window.storage = storage

  useEffect(() => {
    window.storage = storage
    return () => {
      if (window.storage === storage) delete window.storage
    }
  }, [storage])

  return (
    <div style={{ minHeight: '100vh' }}>
      <SignOutBar email={user.email} />
      {/* window.storage is set synchronously above before first paint of
          TaskManager's effects; key remounts per user. */}
      <TaskManager key={user.id} />
    </div>
  )
}

function SignOutBar({ email }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
        padding: '8px 16px',
        fontSize: 13,
        background: 'rgba(127,127,127,0.08)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(127,127,127,0.15)',
      }}
    >
      <span style={{ opacity: 0.7 }}>{email}</span>
      <button
        onClick={() => supabase.auth.signOut()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 8,
          border: '1px solid rgba(127,127,127,0.25)',
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
        }}
      >
        <LogOut size={14} /> Sign out
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sign in / sign up / forgot password
// ---------------------------------------------------------------------------
function AuthScreen() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setNotice(
          'Account created. If email confirmation is on, check your inbox; ' +
            'otherwise sign in now.'
        )
        setMode('signin')
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setNotice('Password reset link sent. Check your email.')
      }
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Centered>
      <form onSubmit={submit} style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: accent,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              marginBottom: 12,
            }}
          >
            <CheckCircle2 size={26} />
          </div>
          <h1 style={{ margin: 0, fontSize: 22 }}>
            {mode === 'signup'
              ? 'Create account'
              : mode === 'forgot'
                ? 'Reset password'
                : 'Welcome back'}
          </h1>
          <p style={{ margin: '6px 0 0', opacity: 0.6, fontSize: 13 }}>
            Your personal task manager
          </p>
        </div>

        <label style={labelStyle}>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={inputStyle}
          autoComplete="email"
        />

        {mode !== 'forgot' && (
          <>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
              autoComplete={
                mode === 'signup' ? 'new-password' : 'current-password'
              }
            />
          </>
        )}

        {error && <div style={errBox}>{error}</div>}
        {notice && <div style={noticeBox}>{notice}</div>}

        <button type="submit" disabled={busy} style={primaryBtn}>
          {busy ? (
            <Loader2 size={16} className="ptm-spin" />
          ) : mode === 'signup' ? (
            'Sign up'
          ) : mode === 'forgot' ? (
            'Send reset link'
          ) : (
            'Sign in'
          )}
        </button>

        <div
          style={{
            marginTop: 14,
            fontSize: 13,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            alignItems: 'center',
          }}
        >
          {mode === 'signin' && (
            <>
              <button type="button" style={linkBtn} onClick={() => switchTo('forgot')}>
                Forgot password?
              </button>
              <span style={{ opacity: 0.6 }}>
                No account?{' '}
                <button type="button" style={linkBtn} onClick={() => switchTo('signup')}>
                  Sign up
                </button>
              </span>
            </>
          )}
          {mode === 'signup' && (
            <span style={{ opacity: 0.6 }}>
              Already have one?{' '}
              <button type="button" style={linkBtn} onClick={() => switchTo('signin')}>
                Sign in
              </button>
            </span>
          )}
          {mode === 'forgot' && (
            <button type="button" style={linkBtn} onClick={() => switchTo('signin')}>
              Back to sign in
            </button>
          )}
        </div>
      </form>
    </Centered>
  )

  function switchTo(next) {
    setError('')
    setNotice('')
    setMode(next)
  }
}

// Shown after the user follows a recovery email link.
function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Centered>
      <form onSubmit={submit} style={cardStyle}>
        <h1 style={{ margin: '0 0 6px', fontSize: 22 }}>Set a new password</h1>
        <p style={{ margin: '0 0 18px', opacity: 0.6, fontSize: 13 }}>
          Enter a new password for your account.
        </p>

        {done ? (
          <>
            <div style={noticeBox}>Password updated. You're all set.</div>
            <button type="button" style={primaryBtn} onClick={onDone}>
              Continue
            </button>
          </>
        ) : (
          <>
            <label style={labelStyle}>New password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
              autoComplete="new-password"
            />
            {error && <div style={errBox}>{error}</div>}
            <button type="submit" disabled={busy} style={primaryBtn}>
              {busy ? <Loader2 size={16} className="ptm-spin" /> : 'Update password'}
            </button>
          </>
        )}
      </form>
    </Centered>
  )
}

// ---------------------------------------------------------------------------
// Shared bits for the auth screens
// ---------------------------------------------------------------------------
function Centered({ children }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background:
          'radial-gradient(1200px 600px at 50% -10%, rgba(99,102,241,0.18), transparent), #0b0b12',
        color: '#e7e7ef',
      }}
    >
      <style>{`
        .ptm-spin { animation: ptm-spin 0.8s linear infinite; }
        @keyframes ptm-spin { to { transform: rotate(360deg); } }
      `}</style>
      {children}
    </div>
  )
}

const cardStyle = {
  width: '100%',
  maxWidth: 380,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 18,
  padding: 28,
  boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
}
const labelStyle = {
  display: 'block',
  fontSize: 12,
  opacity: 0.6,
  margin: '12px 0 6px',
}
const inputStyle = {
  width: '100%',
  padding: '11px 12px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.05)',
  color: 'inherit',
  fontSize: 14,
  outline: 'none',
}
const primaryBtn = {
  width: '100%',
  marginTop: 18,
  padding: '11px 12px',
  borderRadius: 10,
  border: 'none',
  background: accent,
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 42,
}
const linkBtn = {
  background: 'none',
  border: 'none',
  color: '#a5b4fc',
  cursor: 'pointer',
  padding: 0,
  fontSize: 13,
  textDecoration: 'underline',
}
const errBox = {
  marginTop: 14,
  padding: '9px 11px',
  borderRadius: 9,
  fontSize: 13,
  background: 'rgba(239,68,68,0.12)',
  border: '1px solid rgba(239,68,68,0.3)',
  color: '#fca5a5',
}
const noticeBox = {
  marginTop: 14,
  padding: '9px 11px',
  borderRadius: 9,
  fontSize: 13,
  background: 'rgba(34,197,94,0.12)',
  border: '1px solid rgba(34,197,94,0.3)',
  color: '#86efac',
}
