import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import { STAFF_SCALE_RANGES, ratingColor } from '../../data/staffInfo'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'

const input =
  'min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'
const iconBtn =
  'grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30'

export function StaffRatingsSettings() {
  const config = useConfig()
  const scale = useSaveConfig('staffScale')
  const levels = useSaveConfig('knowledgeLevels')
  const [words, setWords] = useState(config.staffScale)
  const [know, setKnow] = useState(config.knowledgeLevels)
  const [prev, setPrev] = useState([config.staffScale, config.knowledgeLevels])
  if (prev[0] !== config.staffScale || prev[1] !== config.knowledgeLevels) {
    // Settings reloaded (after save/reset): show the stored version
    setPrev([config.staffScale, config.knowledgeLevels])
    setWords(config.staffScale)
    setKnow(config.knowledgeLevels)
  }

  const clean = (list: string[]) => list.map((w) => w.trim()).filter(Boolean)
  const dirty =
    JSON.stringify(clean(words)) !== JSON.stringify(config.staffScale) ||
    JSON.stringify(clean(know)) !== JSON.stringify(config.knowledgeLevels)

  return (
    <SettingsShell
      title="Staff ratings"
      subtitle="The words FM uses for staff attributes and scouting knowledge, worst to best."
      dirty={dirty}
      saving={scale.save.isPending || levels.save.isPending}
      saved={scale.save.isSuccess || levels.save.isSuccess}
      error={scale.save.error ?? levels.save.error ?? scale.reset.error ?? levels.reset.error}
      onSave={() => {
        scale.save.mutate(clean(words))
        levels.save.mutate(clean(know))
      }}
      onReset={() => {
        scale.reset.mutate()
        levels.reset.mutate()
      }}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <WordList
          title="Attribute ratings"
          hint="Worst at the top, best at the bottom. Colours follow this order."
          words={words}
          onChange={setWords}
          colorFor={(w) => ratingColor(w, clean(words))}
          noteFor={(w) => STAFF_SCALE_RANGES[w]}
        />
        <WordList
          title="Scouting knowledge levels"
          hint="Lowest at the top, highest at the bottom."
          words={know}
          onChange={setKnow}
        />
      </div>
    </SettingsShell>
  )
}

function WordList({
  title,
  hint,
  words,
  onChange,
  colorFor,
  noteFor,
}: {
  title: string
  hint: string
  words: string[]
  onChange: (w: string[]) => void
  colorFor?: (w: string) => string
  /** Small text after a word, e.g. its 1–20 range. */
  noteFor?: (w: string) => string | undefined
}) {
  const move = (i: number, d: -1 | 1) => {
    const n = [...words]
    ;[n[i], n[i + d]] = [n[i + d], n[i]]
    onChange(n)
  }
  return (
    <section className="rounded-xl border border-border bg-surface p-3">
      <h2 className="font-semibold">{title}</h2>
      <p className="mb-2 text-xs text-muted">{hint}</p>
      <ul className="grid gap-1">
        {words.map((w, i) => (
          <li key={i} className="flex items-center gap-1">
            <input
              aria-label={`${title} ${i + 1}`}
              value={w}
              onChange={(e) => onChange(words.map((x, j) => (j === i ? e.target.value : x)))}
              className={`${input} font-semibold ${colorFor?.(w.trim()) ?? ''}`}
            />
            {noteFor && (
              <span className="w-12 shrink-0 text-right text-xs text-muted tabular-nums">
                {noteFor(w.trim()) ?? ''}
              </span>
            )}
            <button
              type="button"
              className={iconBtn}
              aria-label="Move up"
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              <ChevronUp className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className={iconBtn}
              aria-label="Move down"
              disabled={i === words.length - 1}
              onClick={() => move(i, 1)}
            >
              <ChevronDown className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className={iconBtn}
              aria-label={`Remove ${w}`}
              onClick={() => onChange(words.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onChange([...words, ''])}
        className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
      >
        <Plus className="size-4" aria-hidden /> Add
      </button>
    </section>
  )
}
