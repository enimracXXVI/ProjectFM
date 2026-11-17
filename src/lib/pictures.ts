import fmNations from '../data/fmNations.json'
import type { Pictures } from '../data/config'

export type PictureKind = 'face' | 'club' | 'flag'

/** Address of a face, crest or flag by FM Unique ID; null when pictures are off or no id. */
export function pictureUrl(
  p: Pictures,
  kind: PictureKind,
  id: number | string | null | undefined,
): string | null {
  if (!p.enabled || id === null || id === undefined || id === '' || !p[kind]) return null
  const base = p.base && !p.base.endsWith('/') ? `${p.base}/` : p.base
  return base + p[kind].replaceAll('{id}', String(id))
}

const NATION_IDS = new Map(
  Object.entries(fmNations as Record<string, string>).map(([id, name]) => [
    name.toLowerCase(),
    Number(id),
  ]),
)

/** FM Unique ID of a nation from its name (as the imports store nations). */
export const nationId = (name: string | null | undefined) =>
  name ? (NATION_IDS.get(name.trim().toLowerCase()) ?? null) : null
