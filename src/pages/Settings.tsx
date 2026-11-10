import { ChevronRight } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, ErrorText, Field } from '../components/form'
import { Card, PageHeader } from '../components/ui'
import { useAuth } from '../lib/auth'
import { setPassword, signOut } from '../lib/authActions'

export function SettingsPage() {
  const { session } = useAuth()
  const [password, setValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const [state, setState] = useState<{ busy?: boolean; done?: boolean; error?: unknown }>({})

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password !== confirm) return setState({ error: new Error('Passwords do not match.') })
    setState({ busy: true })
    try {
      await setPassword(password)
      setState({ done: true })
      setValue('')
      setConfirm('')
    } catch (error) {
      setState({ error })
    }
  }

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid max-w-md gap-4">
        <Card>
          <h2 className="mb-2 font-semibold">Customise</h2>
          <ul className="grid">
            {[
              ['/settings/statuses', 'Statuses', 'Meaning and colour of FM status codes'],
              ['/settings/attributes', 'Attributes', 'Names, short headers and descriptions'],
              ['/settings/layout', 'Layout', 'Grouping and order of attributes'],
            ].map(([to, label, hint]) => (
              <li key={to}>
                <Link
                  to={to}
                  className="-mx-2 flex min-h-12 items-center gap-3 rounded-lg px-2 hover:bg-surface-2"
                >
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-muted">{hint}</span>
                  </span>
                  <ChevronRight className="size-4 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <p className="text-sm text-muted">Signed in as</p>
          <p className="font-medium break-all">{session?.user.email}</p>
          <Button variant="ghost" className="mt-3" onClick={() => signOut()}>
            Sign out
          </Button>
        </Card>

        <Card>
          <h2 className="font-semibold">Password</h2>
          <p className="mt-1 mb-3 text-sm text-muted">
            Set a password to sign in on any device, including the installed app, without waiting
            for an email.
          </p>
          <form onSubmit={submit} className="grid gap-3">
            <Field
              label="New password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setValue(e.target.value)}
            />
            <Field
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <Button type="submit" disabled={state.busy}>
              {state.busy ? 'Saving…' : 'Save password'}
            </Button>
            {state.done && <p className="text-sm text-accent">Password saved.</p>}
            <ErrorText error={state.error} />
          </form>
        </Card>
      </div>
    </>
  )
}
