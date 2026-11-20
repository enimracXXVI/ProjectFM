import { clsx } from 'clsx'
import type { AttributeValue } from '../import/types'
import type { RoleDef } from '../data/roles'
import { attributeLabel } from '../data/config'
import { attrColor, attrNumber } from '../lib/attributes'
import { useConfig } from '../lib/config'
import { KEY_CHIP, PREFERRED_CHIP } from '../lib/roleMarks'

/**
 * A player's attributes for one role: FM's key attributes, then its preferred ones, each with
 * the player's value (coloured like the profile), strongest first.
 */
export function RoleAttributes({
  role,
  attributes,
  className,
}: {
  role: RoleDef
  attributes: Record<string, AttributeValue>
  className?: string
}) {
  const config = useConfig()
  const row = (title: string, names: string[], accent: boolean) => {
    const list = [...names].sort(
      (a, b) => (attrNumber(attributes[b]) ?? 0) - (attrNumber(attributes[a]) ?? 0),
    )
    if (!list.length) return null
    return (
      <div className="grid gap-1">
        <span
          className={clsx('text-xs font-semibold', accent ? 'text-[#5ee39b]' : 'text-amber-200')}
        >
          {title}
        </span>
        <ul className="flex flex-wrap gap-1">
          {list.map((a) => {
            const v = attributes[a]
            return (
              <li
                key={a}
                title={attributeLabel(config, a)}
                className={clsx(
                  'inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs',
                  accent ? KEY_CHIP : PREFERRED_CHIP,
                )}
              >
                <span className="truncate">{attributeLabel(config, a)}</span>
                <span className={clsx('font-semibold tabular-nums', attrColor(v))}>
                  {v === undefined ? '–' : Array.isArray(v) ? `${v[0]}-${v[1]}` : v}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }
  return (
    <div className={clsx('grid gap-2', className)}>
      {row('Key attributes', role.key, true)}
      {row('Preferred attributes', role.preferred, false)}
    </div>
  )
}
