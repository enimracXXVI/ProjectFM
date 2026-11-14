import { clsx } from 'clsx'
import { Copy, Download, Plus, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import { Button, ErrorText } from '../components/form'
import { Card, PageHeader, Placeholder } from '../components/ui'
import { useConfirm } from '../components/confirm'
import { unzstd } from '../import/readSave'
import { useConfig } from '../lib/config'
import { TEXT, useUrlState } from '../lib/urlState'
import { useSaveConfig } from '../lib/useSaveConfig'
import { fileTitle } from '../tactics/fmf'
import {
  DAYS,
  SLOTS,
  blankSchedule,
  readScheduleFile,
  scheduleFile,
  scheduleProblems,
  type TrainingSchedule,
  type TrainingSession,
} from '../training/schedule'

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

  const add = async (s: TrainingSchedule) => {
    await save.mutateAsync([...schedules, s])
    setSelected(s.id)
  }
  const upload = async (file: File) => {
    setError(null)
    if (!/\.fmf$/i.test(file.name)) return setError(new Error('Choose an FM schedule file (.fmf).'))
    setReading(true)
    try {
      const sessions = await readScheduleFile(new Uint8Array(await file.arrayBuffer()), unzstd)
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
      </div>
      {current ? (
        <ScheduleEditor
          key={current.id + JSON.stringify(current)}
          schedule={current}
          sessions={config.trainingSessions}
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
    </>
  )
}

function ScheduleEditor({
  schedule,
  sessions,
  onSave,
  onCopy,
  onDelete,
}: {
  schedule: TrainingSchedule
  sessions: TrainingSession[]
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
    const bytes = scheduleFile(form)
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
                      className={clsx(
                        'min-h-11 min-w-0 rounded-lg border bg-surface-2 px-2 text-xs md:text-sm',
                        active === i ? 'border-accent' : 'border-border',
                        s && !s.fm && 'text-amber-300',
                      )}
                    >
                      {!s && <option value={form.sessions[i]}>Code {form.sessions[i]}</option>}
                      {categories.map((c) => (
                        <optgroup key={c} label={c}>
                          {sessions
                            .filter((x) => x.category === c)
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
                  <span className="text-muted">{c}</span>
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
    <div className="grid gap-1 rounded-lg border border-accent/40 bg-surface-2/60 p-2 text-xs">
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
