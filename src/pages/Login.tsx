import { useState, type FormEvent } from 'react'
import { Button, ErrorText, Field } from '../components/form'
import { sendLoginEmail, verifyLoginCode } from '../lib/authActions'

export function Login() {
  const [email, setEmail] = useState('')
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

  return (
    <div className="pt-safe grid min-h-full place-items-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-3xl font-bold tracking-tight">
          Project<span className="text-accent">FM</span>
        </h1>
        <p className="text-muted mb-6 text-sm">Your Football Manager careers, on every device.</p>

        {!sent ? (
          <form
            className="grid gap-3"
            onSubmit={(e) => run(e, async () => (await sendLoginEmail(email), setSent(true)))}
          >
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </Button>
          </form>
        ) : (
          <form className="grid gap-3" onSubmit={(e) => run(e, () => verifyLoginCode(email, code))}>
            <p className="text-sm">
              Sent to <strong>{email}</strong>. Open the link in the email, or type the code from it
              here (best when using the installed app).
            </p>
            <Field
              label="Code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
            />
            <Button type="submit" disabled={busy || code.length < 6}>
              {busy ? 'Checking…' : 'Sign in'}
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
