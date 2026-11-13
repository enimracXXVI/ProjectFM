import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import type { NoteCategory } from '../../data/notes'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'

const field =
  'min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'
const iconBtn =
  'grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30'

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'category'

/** The categories notes can have: names, colours and order. */
export function NoteCategoriesSettings() {
  const { noteCategories } = useConfig()
  const { save, reset } = useSaveConfig('noteCategories')
  const [form, setForm] = useState<NoteCategory[]>(noteCategories)
  const [prev, setPrev] = useState(JSON.stringify(noteCategories))
  if (prev !== JSON.stringify(noteCategories)) {
    setPrev(JSON.stringify(noteCategories))
    setForm(noteCategories)
  }
  const set = (i: number, patch: Partial<NoteCategory>) =>
    setForm(form.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const move = (i: number, by: number) => {
    const n = [...form]
    ;[n[i], n[i + by]] = [n[i + by], n[i]]
    setForm(n)
  }

  return (
    <SettingsShell
      title="Note categories"
      subtitle="Categories for your Dashboard notes. Renaming one keeps its notes; deleting one leaves its notes without a category."
      dirty={JSON.stringify(form) !== prev}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => {
        // A new category gets a lasting id from its first name
        const used = new Set<string>()
        save.mutate(
          form
            .filter((c) => c.name.trim())
            .map((c) => {
              let id = c.id || slug(c.name)
              while (used.has(id)) id += '-2'
              used.add(id)
              return { ...c, id, name: c.name.trim() }
            }),
        )
      }}
      onReset={() => reset.mutate()}
    >
      <ul className="grid max-w-xl gap-2">
        {form.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            <input
              type="color"
              aria-label={`Colour of ${c.name}`}
              value={c.color}
              onChange={(e) => set(i, { color: e.target.value })}
              className="size-11 shrink-0 cursor-pointer rounded-lg border border-border bg-surface-2 p-1"
            />
            <input
              aria-label={`Category ${i + 1}`}
              value={c.name}
              onChange={(e) => set(i, { name: e.target.value })}
              className={`${field} font-semibold`}
            />
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
              disabled={i === form.length - 1}
              onClick={() => move(i, 1)}
            >
              <ChevronDown className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className={iconBtn}
              aria-label={`Remove ${c.name}`}
              onClick={() => setForm(form.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setForm([...form, { id: '', name: '', color: '#8a97b3' }])}
        className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
      >
        <Plus className="size-4" aria-hidden /> Add category
      </button>
    </SettingsShell>
  )
}
