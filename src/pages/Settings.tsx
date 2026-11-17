import { ChevronRight } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, ErrorText, Field } from '../components/form'
import { Card, PageHeader } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useConfig } from '../lib/config'
import { useChecks } from '../lib/useChecks'
import { useSaveConfig } from '../lib/useSaveConfig'
import { setPassword, signOut } from '../lib/authActions'
import { SETTINGS_GROUPS } from './settings/sections'

export function SettingsPage() {
  const checks = useChecks()
  const { session } = useAuth()
  const [password, setValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
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
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Find a setting"
          aria-label="Find a setting"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base sm:max-w-xs md:text-sm"
        />
        <Link to="/settings/guide" className="text-sm font-semibold text-accent">
          What is each setting for?
        </Link>
      </div>
      {/* Cards flow into columns side by side on wide screens, in reading order */}
      <div className="gap-4 lg:columns-2 2xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
        <HiddenValuesCard />

        {SETTINGS_GROUPS.map((g) => {
          const items = g.items.filter(
            (it) => !q || `${g.title} ${it.label} ${it.hint} ${it.about}`.toLowerCase().includes(q),
          )
          if (!items.length) return null
          return (
            <Card key={g.title}>
              <h2 className="font-semibold">{g.title}</h2>
              <p className="mb-2 text-xs text-muted">{g.intro}</p>
              <ul className="grid">
                {items.map((it) => (
                  <li key={it.to}>
                    <Link
                      to={it.to}
                      className="-mx-2 flex min-h-12 items-center gap-3 rounded-lg px-2 hover:bg-surface-2"
                    >
                      <span className="flex-1">
                        <span className="block text-sm font-medium">
                          {it.to === '/check' && checks.total
                            ? `${it.label} (${checks.total})`
                            : it.label}
                        </span>
                        <span className="block text-xs text-muted">{it.hint}</span>
                      </span>
                      <ChevronRight className="size-4 text-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )
        })}

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

function HiddenValuesCard() {
  const { showHidden } = useConfig()
  const { save } = useSaveConfig('showHidden')
  return (
    <Card>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-5"
          checked={showHidden}
          disabled={save.isPending}
          onChange={(e) => save.mutate(e.target.checked)}
        />
        <span>
          <span className="block font-semibold">Show hidden values</span>
          <span className="block text-sm text-muted">
            CA/PA, hidden attributes (consistency, injury proneness…) and the personality values
            behind each personality. FM keeps these hidden; leave off to see only what the game
            shows.
          </span>
        </span>
      </label>
      <ErrorText error={save.error} />
    </Card>
  )
}
