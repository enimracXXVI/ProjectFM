import { useState, type FormEvent } from 'react'
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
          <p className="text-muted text-sm">Signed in as</p>
          <p className="font-medium break-all">{session?.user.email}</p>
          <Button variant="ghost" className="mt-3" onClick={() => signOut()}>
            Sign out
          </Button>
        </Card>

        <Card>
          <h2 className="font-semibold">Password</h2>
          <p className="text-muted mt-1 mb-3 text-sm">
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
            {state.done && <p className="text-accent text-sm">Password saved.</p>}
            <ErrorText error={state.error} />
          </form>
        </Card>
      </div>
    </>
  )
}
