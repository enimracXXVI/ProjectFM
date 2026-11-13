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

export function SettingsPage() {
  const checks = useChecks()
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
      {/* Cards flow into columns side by side on wide screens, in reading order */}
      <div className="gap-4 lg:columns-2 2xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
        <HiddenValuesCard />

        <Card>
          <h2 className="mb-2 font-semibold">Import and help</h2>
          <ul className="grid">
            {[
              ['/import', 'Import', 'Your FM save (.fm)'],
              ['/settings/database', 'Database', 'Every table and file, and what an import does'],
              [
                '/check',
                checks.total ? `Check in game (${checks.total})` : 'Check in game',
                'What the app could not work out, for you to look up',
              ],
              ['/explain', 'How it works', 'How each calculated value is worked out'],
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
          <h2 className="mb-2 font-semibold">Customise</h2>
          <ul className="grid">
            {[
              [
                '/settings/statuses',
                'Statuses',
                'Meaning, description and colours of FM status codes',
              ],
              ['/settings/attributes', 'Attributes', 'Names, short headers and descriptions'],
              ['/settings/layout', 'Layout', 'Grouping and order of attributes'],
              ['/settings/columns', 'Contract & Stats', 'Columns, order, names and tooltips'],
              ['/settings/roles', 'Roles', 'FM27 roles, positions, key and preferred attributes'],
              [
                '/settings/instructions',
                'Team instructions',
                'Every instruction and the options you can pick in FM',
              ],
              [
                '/settings/role-weights',
                'Role weights',
                'Importance tiers and factors for role scores',
              ],
              ['/settings/regions', 'Regions', 'Scouting regions, countries and borders'],
              [
                '/settings/staff-ratings',
                'Staff ratings',
                'Rating words and knowledge levels, with their numbers',
              ],
              [
                '/settings/staff-attributes',
                'Staff attributes',
                'Staff profile tabs and Key Attributes for each job',
              ],
              [
                '/settings/names',
                'FM names and words',
                'Morale words, competitions, cup rounds, staff job codes',
              ],
              [
                '/settings/personality',
                'Personality and feet',
                'Personality ranges and overlap rules, foot strength words',
              ],
              [
                '/settings/bottom-bar',
                'Phone bottom bar',
                'Which sections sit at the bottom on phones',
              ],
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
