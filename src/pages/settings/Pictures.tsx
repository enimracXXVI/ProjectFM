import { useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import { DEFAULT_PICTURES, type Pictures } from '../../data/config'
import { useConfig } from '../../lib/config'
import { pictureUrl } from '../../lib/pictures'
import { useSaveConfig } from '../../lib/useSaveConfig'

const input =
  'min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

/** Faces, crests and flags from an online picture database, by FM Unique ID. */
export function PicturesSettings() {
  const config = useConfig()
  const { save, reset } = useSaveConfig('pictures')
  const stored = config.pictures
  const [form, setForm] = useState<Pictures>(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }
  const field = (key: 'base' | 'face' | 'club' | 'flag', label: string) => (
    <label className="grid gap-1 text-xs text-muted">
      {label}
      <input
        value={form[key]}
        placeholder={DEFAULT_PICTURES[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className={input}
      />
    </label>
  )
  return (
    <SettingsShell
      title="Pictures"
      subtitle="Player faces, club crests and nation flags, loaded from an online picture database by the FM Unique ID of the player, club or nation. Pictures the database does not have are left out."
      dirty={JSON.stringify(form) !== prev}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => save.mutate(form)}
      onReset={() => reset.mutate()}
    >
      <div className="grid gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="size-5"
          />
          Show pictures
        </label>
        {field('base', 'Address')}
        {field('face', 'Faces ({id} = player Unique ID)')}
        {field('club', 'Club crests ({id} = club Unique ID)')}
        {field('flag', 'Flags ({id} = nation Unique ID)')}
        <p className="text-xs text-muted">
          Example: {pictureUrl({ ...form, enabled: true }, 'face', 2000024341)}
        </p>
      </div>
    </SettingsShell>
  )
}
