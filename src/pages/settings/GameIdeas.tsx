import { Plus, Trash2, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { SettingsSection } from '../../components/SettingsSection'
import { SettingsShell } from '../../components/SettingsShell'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'
import { LINE_NAMES, type GameIdea, type Line } from '../../tactics/ideas'
import { FORMATIONS } from '../../tactics/positions'

const input =
  'min-h-10 w-full min-w-0 rounded-lg border border-border bg-surface-2 px-2 text-base md:text-sm'
const LINES = Object.keys(LINE_NAMES) as Line[]
/** The roles each line can play (FM position text on the role cards). */
const LINE_TEXT: Record<Line, string[]> = {
  GK: ['GK'],
  CB: ['D (C)'],
  FB: ['D (L)', 'D (R)'],
  WB: ['WB (L)', 'WB (R)'],
  DM: ['DM'],
  CM: ['M (C)'],
  WM: ['M (L)', 'M (R)'],
  WAM: ['AM (L)', 'AM (R)'],
  AMC: ['AM (C)'],
  ST: ['ST (C)'],
}

/** Settings > Game ideas: every part of each idea the tactic assistant builds from. */
export function GameIdeasSettings() {
  const config = useConfig()
  const { save, reset } = useSaveConfig('gameIdeas')
  const stored = config.gameIdeas
  const [form, setForm] = useState<GameIdea[]>(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }
  const update = (id: string, patch: Partial<GameIdea>) =>
    setForm(form.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const roleName = (id: string) => config.roles.find((r) => r.id === id)?.name ?? id
  const teamDef = (name: string) => config.teamInstructions.find((d) => d.name === name)
  const playerDef = (name: string) => config.playerInstructions.find((d) => d.name === name)
  const attributes = Object.keys(config.attributes)

  const editor = (idea: GameIdea) => {
    const set = (patch: Partial<GameIdea>) => update(idea.id, patch)
    return (
      <SettingsSection
        key={idea.id}
        id={`game-ideas/${idea.id}`}
        title={idea.name || 'New idea'}
        defaultOpen={false}
        className="mb-3"
      >
        <div className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Name</span>
              <input
                value={idea.name}
                onChange={(e) => set({ name: e.target.value })}
                className={input}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Mentality</span>
              <select
                value={idea.mentality}
                onChange={(e) => set({ mentality: e.target.value })}
                className={input}
              >
                {config.fmCodes.mentalities.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              aria-label={`Delete ${idea.name}`}
              onClick={() => setForm(form.filter((x) => x.id !== idea.id))}
              className="grid size-10 place-items-center self-end rounded-lg text-muted hover:bg-surface-2 hover:text-red-400"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">The idea, in a manager&apos;s words</span>
            <textarea
              rows={2}
              value={idea.about}
              onChange={(e) => set({ about: e.target.value })}
              className={`${input} py-2`}
            />
          </label>

          <Part title="Formations">
            <Chips
              items={idea.shapes}
              label={(x) => x}
              onRemove={(k) => set({ shapes: idea.shapes.filter((_, j) => j !== k) })}
              add={{
                options: Object.keys(FORMATIONS).filter((f) => !idea.shapes.includes(f)),
                label: (x) => x,
                onAdd: (x) => set({ shapes: [...idea.shapes, x] }),
                placeholder: 'Add a formation',
              }}
            />
          </Part>

          <Part title="What it needs from each line">
            {idea.needs.map((n, k) => {
              const setNeed = (patch: Partial<typeof n>) =>
                set({ needs: idea.needs.map((x, j) => (j === k ? { ...x, ...patch } : x)) })
              return (
                <Row key={k} onRemove={() => set({ needs: idea.needs.filter((_, j) => j !== k) })}>
                  <Chips
                    items={n.lines}
                    label={(l) => LINE_NAMES[l]}
                    onRemove={(j) => setNeed({ lines: n.lines.filter((_, i) => i !== j) })}
                    add={{
                      options: LINES.filter((l) => !n.lines.includes(l)),
                      label: (l) => LINE_NAMES[l],
                      onAdd: (l) => setNeed({ lines: [...n.lines, l] }),
                      placeholder: 'Add a line',
                    }}
                  />
                  <Chips
                    items={n.attributes}
                    label={(a) => a}
                    onRemove={(j) =>
                      setNeed({ attributes: n.attributes.filter((_, i) => i !== j) })
                    }
                    add={{
                      options: attributes.filter((a) => !n.attributes.includes(a)),
                      label: (a) => a,
                      onAdd: (a) => setNeed({ attributes: [...n.attributes, a] }),
                      placeholder: 'Add an attribute',
                    }}
                  />
                  <input
                    aria-label="Why"
                    value={n.why}
                    onChange={(e) => setNeed({ why: e.target.value })}
                    className={input}
                  />
                </Row>
              )
            })}
            <AddButton
              onClick={() =>
                set({ needs: [...idea.needs, { lines: [], attributes: [], why: '' }] })
              }
            >
              Add a need
            </AddButton>
          </Part>

          <Part title="Roles it wants, by line (best first)">
            {idea.roles.map((r, k) => {
              const setRole = (patch: Partial<typeof r>) =>
                set({ roles: idea.roles.map((x, j) => (j === k ? { ...x, ...patch } : x)) })
              const offered = (phase: 'ip' | 'oop') =>
                config.roles.filter(
                  (x) =>
                    x.phase === phase &&
                    x.positions.some((p) => LINE_TEXT[r.line].includes(p)) &&
                    !r[phase].includes(x.id),
                )
              return (
                <Row key={k} onRemove={() => set({ roles: idea.roles.filter((_, j) => j !== k) })}>
                  <select
                    aria-label="Line"
                    value={r.line}
                    onChange={(e) => setRole({ line: e.target.value as Line })}
                    className={`${input} sm:max-w-xs`}
                  >
                    {LINES.map((l) => (
                      <option key={l} value={l}>
                        {LINE_NAMES[l]}
                      </option>
                    ))}
                  </select>
                  {(['ip', 'oop'] as const).map((phase) => (
                    <div key={phase} className="grid gap-1">
                      <span className="text-xs text-muted">
                        {phase === 'ip' ? 'In possession' : 'Out of possession'}
                      </span>
                      <Chips
                        items={r[phase]}
                        label={roleName}
                        onRemove={(j) => setRole({ [phase]: r[phase].filter((_, i) => i !== j) })}
                        add={{
                          options: offered(phase).map((x) => x.id),
                          label: roleName,
                          onAdd: (id) => setRole({ [phase]: [...r[phase], id] }),
                          placeholder: 'Add a role',
                        }}
                      />
                    </div>
                  ))}
                  <input
                    aria-label="Why"
                    value={r.why}
                    onChange={(e) => setRole({ why: e.target.value })}
                    className={input}
                  />
                </Row>
              )
            })}
            <AddButton
              onClick={() =>
                set({ roles: [...idea.roles, { line: 'CM', ip: [], oop: [], why: '' }] })
              }
            >
              Add a line
            </AddButton>
          </Part>

          <Part title="Team instructions">
            {idea.team.map((t, k) => {
              const setT = (patch: Partial<typeof t>) =>
                set({ team: idea.team.map((x, j) => (j === k ? { ...x, ...patch } : x)) })
              const d = teamDef(t.instruction)
              return (
                <Row key={k} onRemove={() => set({ team: idea.team.filter((_, j) => j !== k) })}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      aria-label="Instruction"
                      value={t.instruction}
                      onChange={(e) =>
                        setT({
                          instruction: e.target.value,
                          option: teamDef(e.target.value)?.options[0]?.label ?? '',
                        })
                      }
                      className={input}
                    >
                      {config.teamInstructions.map((x) => (
                        <option key={x.name}>{x.name}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Option"
                      value={t.option}
                      onChange={(e) => setT({ option: e.target.value })}
                      className={input}
                    >
                      {d?.options.map((o) => (
                        <option key={o.label}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    aria-label="Why"
                    value={t.why}
                    onChange={(e) => setT({ why: e.target.value })}
                    className={input}
                  />
                </Row>
              )
            })}
            <AddButton
              onClick={() => {
                const d = config.teamInstructions[0]
                set({
                  team: [
                    ...idea.team,
                    { instruction: d.name, option: d.options[0].label, why: '' },
                  ],
                })
              }}
            >
              Add an instruction
            </AddButton>
          </Part>

          <Part title="Player instructions for lines">
            {idea.players.map((t, k) => {
              const setT = (patch: Partial<typeof t>) =>
                set({ players: idea.players.map((x, j) => (j === k ? { ...x, ...patch } : x)) })
              const d = playerDef(t.instruction)
              return (
                <Row
                  key={k}
                  onRemove={() => set({ players: idea.players.filter((_, j) => j !== k) })}
                >
                  <Chips
                    items={t.lines}
                    label={(l) => LINE_NAMES[l]}
                    onRemove={(j) => setT({ lines: t.lines.filter((_, i) => i !== j) })}
                    add={{
                      options: LINES.filter((l) => !t.lines.includes(l)),
                      label: (l) => LINE_NAMES[l],
                      onAdd: (l) => setT({ lines: [...t.lines, l] }),
                      placeholder: 'Add a line',
                    }}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      aria-label="Instruction"
                      value={t.instruction}
                      onChange={(e) =>
                        setT({
                          instruction: e.target.value,
                          option: playerDef(e.target.value)?.options[0]?.label ?? '',
                        })
                      }
                      className={input}
                    >
                      {config.playerInstructions.map((x) => (
                        <option key={x.name}>{x.name}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Option"
                      value={t.option}
                      onChange={(e) => setT({ option: e.target.value })}
                      className={input}
                    >
                      {d?.options.map((o) => (
                        <option key={o.label}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    aria-label="Why"
                    value={t.why}
                    onChange={(e) => setT({ why: e.target.value })}
                    className={input}
                  />
                </Row>
              )
            })}
            <AddButton
              onClick={() => {
                const d = config.playerInstructions[0]
                set({
                  players: [
                    ...idea.players,
                    { lines: [], instruction: d.name, option: d.options[0].label, why: '' },
                  ],
                })
              }}
            >
              Add a player instruction
            </AddButton>
          </Part>

          <Part title="Player instructions it never suggests">
            {idea.avoid.map((t, k) => {
              const setT = (patch: Partial<typeof t>) =>
                set({ avoid: idea.avoid.map((x, j) => (j === k ? { ...x, ...patch } : x)) })
              const d = playerDef(t.instruction)
              return (
                <Row key={k} onRemove={() => set({ avoid: idea.avoid.filter((_, j) => j !== k) })}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      aria-label="Instruction"
                      value={t.instruction}
                      onChange={(e) =>
                        setT({
                          instruction: e.target.value,
                          option: playerDef(e.target.value)?.options[0]?.label ?? '',
                        })
                      }
                      className={input}
                    >
                      {config.playerInstructions.map((x) => (
                        <option key={x.name}>{x.name}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Option"
                      value={t.option}
                      onChange={(e) => setT({ option: e.target.value })}
                      className={input}
                    >
                      {d?.options.map((o) => (
                        <option key={o.label}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </Row>
              )
            })}
            <AddButton
              onClick={() => {
                const d = config.playerInstructions[0]
                set({ avoid: [...idea.avoid, { instruction: d.name, option: d.options[0].label }] })
              }}
            >
              Add
            </AddButton>
          </Part>
        </div>
      </SettingsSection>
    )
  }

  return (
    <SettingsShell
      title="Game ideas"
      subtitle="How the tactic assistant thinks: each idea says what it needs from each line, the roles that carry it out, the team instructions that go together, and player instructions it adds or never suggests. General football knowledge, not FM27 data: change anything you see differently."
      dirty={JSON.stringify(form) !== prev}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => save.mutate(form.filter((x) => x.name.trim()))}
      onReset={() => reset.mutate()}
    >
      {form.map(editor)}
      <AddButton
        onClick={() =>
          setForm([
            ...form,
            {
              id: `own-${Date.now()}`,
              name: 'New idea',
              about: '',
              mentality: 'Balanced',
              shapes: ['4-3-3'],
              needs: [],
              roles: [],
              team: [],
              players: [],
              avoid: [],
            },
          ])
        }
      >
        Add a game idea
      </AddButton>
    </SettingsShell>
  )
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function Row({ onRemove, children }: { onRemove: () => void; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border p-2">
      <div className="grid min-w-0 flex-1 gap-2">{children}</div>
      <button
        type="button"
        aria-label="Remove"
        onClick={onRemove}
        className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-red-400"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </div>
  )
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-1 justify-self-start text-sm font-semibold text-accent"
    >
      <Plus className="size-4" aria-hidden /> {children}
    </button>
  )
}

function Chips<T extends string>({
  items,
  label,
  onRemove,
  add,
}: {
  items: T[]
  label: (x: T) => string
  onRemove: (index: number) => void
  add: { options: T[]; label: (x: T) => string; onAdd: (x: T) => void; placeholder: string }
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((x, k) => (
        <span
          key={x}
          className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-full border border-border pr-1 pl-3 text-sm"
        >
          <span className="truncate">{label(x)}</span>
          <button
            type="button"
            aria-label={`Remove ${label(x)}`}
            onClick={() => onRemove(k)}
            className="grid size-6 shrink-0 place-items-center rounded-full text-muted hover:text-red-400"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}
      {add.options.length > 0 && (
        <select
          aria-label={add.placeholder}
          value=""
          onChange={(e) => e.target.value && add.onAdd(e.target.value as T)}
          className="min-h-8 max-w-full rounded-full border border-dashed border-border bg-transparent px-3 text-sm text-muted"
        >
          <option value="">{add.placeholder}</option>
          {add.options.map((o) => (
            <option key={o} value={o}>
              {add.label(o)}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
