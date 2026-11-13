import { clsx } from 'clsx'
import { useState, type FormEvent } from 'react'
import { Button, ErrorText, Field } from '../components/form'
import { sendLoginEmail, signInWithPassword, verifyLoginCode } from '../lib/authActions'
import { Logo } from '../components/Logo'

type Mode = 'password' | 'email'

export function Login() {
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const run = async (e: FormEvent, action: () => Promise<void>) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const emailField = (
    <Field
      label="Email"
      type="email"
      autoComplete="email"
      required
      value={email}
      onChange={(e) => setEmail(e.target.value)}
    />
  )

  return (
    <div className="grid min-h-full place-items-center px-4 pt-safe">
      <div className="w-full max-w-sm">
        <h1 className="mb-4">
          <Logo className="h-20 w-auto" />
        </h1>
        <p className="mb-6 text-sm text-muted">Your Football Manager careers, on every device.</p>

        <div className="mb-4 grid grid-cols-2 rounded-lg border border-border p-0.5" role="tablist">
          {(
            [
              ['password', 'Password'],
              ['email', 'Email link'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => (setMode(m), setError(null))}
              className={clsx(
                'min-h-10 rounded-md text-sm',
                mode === m ? 'bg-surface-2 text-text' : 'text-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'password' ? (
          <form
            className="grid gap-3"
            onSubmit={(e) => run(e, () => signInWithPassword(email, password))}
          >
            {emailField}
            <Field
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
            <p className="text-xs text-muted">
              No password yet? Use “Email link” once, then set one in Settings.
            </p>
          </form>
        ) : !sent ? (
          <form
            className="grid gap-3"
            onSubmit={(e) => run(e, async () => (await sendLoginEmail(email), setSent(true)))}
          >
            {emailField}
            <Button type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </Button>
          </form>
        ) : (
          <form className="grid gap-3" onSubmit={(e) => run(e, () => verifyLoginCode(email, code))}>
            <p className="text-sm">
              Sent to <strong>{email}</strong>. Open the link in the email to sign in.
            </p>
            <Field
              label="Code (if your email shows one)"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
            />
            <Button type="submit" disabled={busy || code.length < 6}>
              {busy ? 'Checking…' : 'Sign in with code'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSent(false)}>
              Use a different email
            </Button>
          </form>
        )}
        <div className="mt-3">
          <ErrorText error={error} />
        </div>
      </div>
    </div>
  )
}
