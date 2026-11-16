import { clsx } from 'clsx'
import { ChevronDown, Copy, Download, Plus, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import { Button, ErrorText } from '../components/form'
import { Card, PageHeader, Placeholder } from '../components/ui'
import { useConfirm } from '../components/confirm'
import { unzstd } from '../import/readSave'
import { useLearnFileVersion } from '../lib/fileVersion'
import { useConfig } from '../lib/config'
import { useCareer } from '../lib/career'
import { useStaff } from '../data/hooks'
import { band } from '../tactics/matchData'
import { TEXT, useUrlState } from '../lib/urlState'
import { useSaveConfig } from '../lib/useSaveConfig'
import { fileTitle } from '../tactics/fmf'
import {
  DAYS,
  REST,
  SLOTS,
  blankSchedule,
  readScheduleFile,
  scheduleFile,
  scheduleProblems,
  sessionColor,
  type TrainingSchedule,
  type TrainingSession,
} from '../training/schedule'
import { focusesForPlayer, type TrainingFocus } from '../training/focus'

const field =
  'min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

/** Weekly training schedules: build them, upload FM's own, export them to load in FM. */
export function Training() {
  const config = useConfig()
  const schedules = config.trainingSchedules
  const { save } = useSaveConfig('trainingSchedules')
  const [selected, setSelected] = useUrlState<string | null>('schedule', null, TEXT as never)
  const current = schedules.find((s) => s.id === selected) ?? schedules[0] ?? null
  const [error, setError] = useState<unknown>(null)
  const [reading, setReading] = useState(false)
  const learnVersion = useLearnFileVersion()
  const [versionNote, setVersionNote] = useState<string | null>(null)

  const add = async (s: TrainingSchedule) => {
    await save.mutateAsync([...schedules, s])
    setSelected(s.id)
  }
  const upload = async (file: File) => {
    setError(null)
    if (!/\.fmf$/i.test(file.name)) return setError(new Error('Choose an FM schedule file (.fmf).'))
    setReading(true)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const sessions = await readScheduleFile(bytes, unzstd)
      setVersionNote(await learnVersion(bytes))
      await add({ ...blankSchedule(file.name.replace(/\.fmf$/i, '')), sessions })
    } catch (e) {
      setError(e)
    } finally {
      setReading(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Training"
        subtitle="Weekly schedules: build them here or upload FM's, then load them in FM"
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {schedules.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelected(s.id)}
            className={clsx(
              'min-h-11 rounded-full border px-4 text-sm',
              s.id === current?.id
                ? 'border-accent bg-accent/15 font-semibold text-accent'
                : 'border-border hover:bg-surface-2',
            )}
          >
            {s.name || 'Schedule'}
          </button>
        ))}
        <Button
          variant="ghost"
          onClick={() => add(blankSchedule('New schedule'))}
          disabled={save.isPending}
        >
          <Plus className="size-4" aria-hidden /> New schedule
        </Button>
        <label
          className={clsx(
            'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-semibold hover:bg-surface-2',
            reading && 'pointer-events-none opacity-50',
          )}
        >
          <Upload className="size-4" aria-hidden />
          {reading ? 'Reading…' : 'Upload FM schedule (.fmf)'}
          <input
            type="file"
            accept=".fmf"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) upload(f)
            }}
          />
        </label>
        <ErrorText error={error ?? save.error} />
        {versionNote && (
          <p className="w-full rounded-lg border border-sky-400/50 bg-sky-400/10 p-2 text-sm text-sky-200">
            {versionNote}
          </p>
        )}
      </div>
      {current ? (
        <ScheduleEditor
          key={current.id + JSON.stringify(current)}
          schedule={current}
          sessions={config.trainingSessions}
          fileVersion={config.fmCodes.fileVersion}
          onSave={(s) => save.mutateAsync(schedules.map((x) => (x.id === s.id ? s : x)))}
          onCopy={(s) => add({ ...s, id: crypto.randomUUID(), name: `${s.name} (copy)` })}
          onDelete={async (s) => {
            await save.mutateAsync(schedules.filter((x) => x.id !== s.id))
            setSelected(null)
          }}
        />
      ) : (
        <Placeholder>
          No schedules yet. Start a new one, or upload a schedule you saved in FM.
        </Placeholder>
      )}
      <TacticalTraining />
      <Focuses focuses={config.trainingFocuses} />
      <TraitGuide />
    </>
  )
}

/** How FM adds up tactical training (FM's match data), with the club's coaches. */
function TacticalTraining() {
  const config = useConfig()
  const { current } = useCareer()
  const { data: staff } = useStaff(current?.id ?? '')
  const t = config.matchData.training
  const [open, setOpen] = useState(false)
  const coaches = (staff ?? [])
    .filter(
      (s) => /coach/i.test(s.role ?? '') && !/goalkeeping|fitness|set piece/i.test(s.role ?? ''),
    )
    .map((s) => ({ name: s.name, role: s.role, tactical: Number(s.attributes.Tactical) }))
    .filter((c) => Number.isFinite(c.tactical) && c.tactical > 0)
    .sort((a, b) => b.tactical - a.tactical)
  const pct = (m: number) => `${Math.round(m * 100)}%`
  const bands = (list: [number, number][], unit: string) =>
    list.map(([from, m]) => `${from}${unit}: ${pct(m)}`).join(' · ')
  return (
    <Card className="mt-4 grid gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-left"
      >
        <h2 className="text-base font-semibold">How tactical training adds up</h2>
        <ChevronDown
          className={clsx('ml-auto size-4 text-muted', !open && '-rotate-90')}
          aria-hidden
        />
      </button>
      <p className="text-xs text-muted">
        From FM&apos;s match data. One tactic gets {t.split.one}% of tactical training; with two,
        the main one gets {t.split.twoMain}% and the other {t.split.twoOther}%; with three,{' '}
        {t.split.threeMain}% and {t.split.threeOther}% each for the others.
      </p>
      {open && (
        <div className="grid gap-2 text-xs">
          <p>
            <span className="text-muted">Coach quality (coaching attribute): </span>
            {bands(t.coach, '+')}
          </p>
          <p>
            <span className="text-muted">Player&apos;s tactical ability: </span>
            {bands(t.player, '+')}
          </p>
          <p>
            <span className="text-muted">Time at the club: </span>
            {bands(t.weeks, ' weeks')}
          </p>
          {coaches.length > 0 && (
            <div>
              <p className="text-muted">
                Your coaches&apos; Tactical, with the band it falls in (FM&apos;s file gives the
                bands, not which coaches or attribute count):
              </p>
              <ul className="mt-1 grid gap-0.5 sm:grid-cols-2">
                {coaches.map((c) => (
                  <li key={c.name} className="flex justify-between gap-2">
                    <span className="truncate">
                      {c.name} <span className="text-muted">· {c.role}</span>
                    </span>
                    <span className="tabular-nums">
                      {c.tactical} · {pct(band(t.coach, c.tactical) ?? 0)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

/** What suits each player trait, from FM's staff advice rules. */
function TraitGuide() {
  const config = useConfig()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const list = config.traitGuide.filter(
    (g) =>
      !q.trim() || `${g.trait} ${g.suits.join(' ')}`.toLowerCase().includes(q.trim().toLowerCase()),
  )
  return (
    <Card className="mt-4 grid gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-left"
      >
        <h2 className="text-base font-semibold">Trait guide</h2>
        <ChevronDown
          className={clsx('ml-auto size-4 text-muted', !open && '-rotate-90')}
          aria-hidden
        />
      </button>
      <p className="text-xs text-muted">
        What each trait does (FM&apos;s own text) and what FM&apos;s staff look for before advising
        a player to learn it (or to drop it when he lacks it), from FM&apos;s own advice rules.
        Teach traits in FM from the player&apos;s training screen. Edit in Settings &gt; Trait
        guide.
      </p>
      {open && (
        <>
          <input
            aria-label="Search traits"
            value={q}
            placeholder="Search: a trait or a strength (dribbling, left foot…)"
            onChange={(e) => setQ(e.target.value)}
            className={field}
          />
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {list.map((g) => (
              <li key={g.trait} className="rounded-lg border border-border px-3 py-1.5">
                <span className="font-semibold">{g.trait}</span>
                {g.about && <span className="block text-xs">{g.about}</span>}
                <span className="block text-xs text-muted">
                  {g.suits.length ? `Suits ${g.suits.join(', ')}` : 'No advice rule in FM'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}

/** FM's individual training focuses and the attributes each one trains, as FM lists them. */
function Focuses({ focuses }: { focuses: TrainingFocus[] }) {
  const config = useConfig()
  if (focuses.length === 0) return null
  const label = (a: string) => config.attributes[a]?.label ?? a
  const lists = [
    ['Outfield players', focusesForPlayer('ST', focuses)],
    ['Goalkeepers', focusesForPlayer('GK', focuses)],
  ] as const
  return (
    <Card className="mt-4 grid gap-3">
      <div>
        <h2 className="text-base font-semibold">Individual training focuses</h2>
        <p className="text-xs text-muted">
          What each focus trains, in FM&apos;s order. Edit in Settings &gt; Training focuses.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {lists.map(([title, list]) => (
          <section key={title} className="grid content-start gap-1">
            <h3 className="text-xs font-semibold text-muted">{title}</h3>
            <ul className="grid gap-1 text-sm">
              {list.map((f) => (
                <li key={`${f.code}-${f.name}`}>
                  <span className="font-semibold">{f.name}</span>
                  <span className="text-muted">
                    {' '}
                    · {f.attributes.length ? f.attributes.map(label).join(', ') : 'not set'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Card>
  )
}

function ScheduleEditor({
  schedule,
  sessions,
  fileVersion,
  onSave,
  onCopy,
  onDelete,
}: {
  schedule: TrainingSchedule
  sessions: TrainingSession[]
  fileVersion: string
  onSave: (s: TrainingSchedule) => Promise<unknown>
  onCopy: (s: TrainingSchedule) => void
  onDelete: (s: TrainingSchedule) => Promise<unknown>
}) {
  const confirm = useConfirm()
  const [form, setForm] = useState(schedule)
  const [active, setActive] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(schedule)
  const categories = [...new Set(sessions.map((s) => s.category))]
  const byCode = (code: number) => sessions.find((s) => s.code === code)
  const problems = scheduleProblems(form, sessions)
  const setSlot = (i: number, code: number) =>
    setForm({ ...form, sessions: form.sessions.map((c, j) => (j === i ? code : c)) })
  const download = () => {
    const bytes = scheduleFile(form, fileVersion)
    const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer]))
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileTitle(form.name)}.fmf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  // How the week is spread across FM's session categories
  const mix = categories
    .map((c) => [c, form.sessions.filter((code) => byCode(code)?.category === c).length] as const)
    .filter(([, n]) => n > 0)
  const shown = active !== null ? byCode(form.sessions[active]) : null

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="grid content-start gap-3">
        <ul className="grid gap-2">
          {DAYS.map((day, d) => (
            <li key={day} className="grid gap-1">
              <span className="text-xs font-semibold text-muted">{day}</span>
              <div className="grid grid-cols-3 gap-1">
                {Array.from({ length: SLOTS }, (_, k) => {
                  const i = d * SLOTS + k
                  const s = byCode(form.sessions[i])
                  return (
                    <select
                      key={k}
                      aria-label={`${day} session ${k + 1}`}
                      value={form.sessions[i]}
                      onFocus={() => setActive(i)}
                      onChange={(e) => {
                        setSlot(i, Number(e.target.value))
                        setActive(i)
                      }}
                      style={{
                        borderLeftColor: sessionColor(s),
                        backgroundColor: `color-mix(in srgb, ${sessionColor(s)} 22%, var(--color-surface-2))`,
                      }}
                      className={clsx(
                        'min-h-11 min-w-0 rounded-lg border border-l-4 px-2 text-xs md:text-sm',
                        active === i ? 'border-accent' : 'border-border',
                        s && !s.fm && 'text-amber-300',
                      )}
                    >
                      {!s && <option value={form.sessions[i]}>Code {form.sessions[i]}</option>}
                      {categories.map((c) => (
                        <optgroup key={c} label={c}>
                          {sessions
                            .filter(
                              (x) => x.category === c && (!x.hidden || x.code === form.sessions[i]),
                            )
                            .map((x) => (
                              <option key={x.code} value={x.code}>
                                {x.name}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  )
                })}
              </div>
              {shown && active !== null && Math.floor(active / SLOTS) === d && (
                <SessionInfo session={shown} slot={(active % SLOTS) + 1} />
              )}
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid content-start gap-4">
        <Card className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Name</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={field}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Notes</span>
            <textarea
              value={form.notes ?? ''}
              rows={2}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-base md:text-sm"
            />
          </label>
          {mix.length > 0 && (
            <ul className="grid gap-0.5 text-xs">
              {mix.map(([c, n]) => (
                <li key={c} className="flex justify-between">
                  <span className="flex items-center gap-1.5 text-muted">
                    <span
                      aria-hidden
                      className="size-2.5 rounded-sm"
                      style={{
                        backgroundColor: sessionColor(
                          sessions.find((x) => x.category === c && x.code !== REST),
                        ),
                      }}
                    />
                    {c}
                  </span>
                  <span className="tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-1">
            <Button variant="ghost" onClick={download} disabled={problems.length > 0}>
              <Download className="size-4" aria-hidden /> Export to FM (.fmf)
            </Button>
            {problems.length > 0 ? (
              <ul className="list-disc pl-5 text-xs text-amber-300">
                {problems.slice(0, 5).map((p) => (
                  <li key={p}>{p}</li>
                ))}
                {problems.length > 5 && <li>and {problems.length - 5} more</li>}
              </ul>
            ) : (
              <p className="text-xs text-muted">
                Save the file in FM&apos;s schedules folder, then in FM&apos;s Training Calendar
                choose Create New Schedule, Custom Schedules, Load.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={async () => {
                setBusy(true)
                await onSave(form).finally(() => setBusy(false))
              }}
              disabled={!dirty || busy}
            >
              {busy ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="ghost" onClick={() => setForm(schedule)} disabled={!dirty}>
              Undo changes
            </Button>
            <Button variant="ghost" onClick={() => onCopy(form)} title="Duplicate">
              <Copy className="size-4" aria-hidden /> Duplicate
            </Button>
            <Button
              variant="danger"
              className="ml-auto"
              onClick={async () => {
                if (
                  await confirm({
                    title: `Delete ${schedule.name}?`,
                    confirmLabel: 'Delete',
                    danger: true,
                  })
                )
                  onDelete(schedule)
              }}
            >
              <Trash2 className="size-4" aria-hidden /> Delete
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

/** FM's description of the session picked in a slot, and what it trains. */
function SessionInfo({ session, slot }: { session: TrainingSession; slot: number }) {
  return (
    <div
      className="grid gap-1 rounded-lg border border-l-4 border-accent/40 bg-surface-2/60 p-2 text-xs"
      style={{ borderLeftColor: sessionColor(session) }}
    >
      <p>
        <span className="font-semibold">{session.name}</span>
        <span className="text-muted">
          {' '}
          · session {slot} · {session.category}
        </span>
      </p>
      {session.about && <p>{session.about}</p>}
      {session.attributes &&
        Object.entries(session.attributes).map(([unit, list]) => (
          <p key={unit}>
            <span className="text-muted capitalize">{unit}: </span>
            {list.join(', ')}
          </p>
        ))}
      {!session.fm && <p className="text-amber-300">FM schedule files cannot hold this session.</p>}
    </div>
  )
}
