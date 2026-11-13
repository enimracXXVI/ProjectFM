import { ArrowLeft, KeyRound, Link2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SettingsSection } from '../../components/SettingsSection'
import { Card, PageHeader } from '../../components/ui'
import { COLUMN_NOTES, STORAGE_FILES, TABLE_NOTES, readSchema } from '../../data/schema'

const schema = readSchema()

/** The database: every table and column, what it is for, and the files next to it. */
export function DatabaseSettings() {
  return (
    <>
      <Link
        to="/settings"
        className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> Settings
      </Link>
      <PageHeader
        title="Database"
        subtitle="Where everything is stored, read from the database updates you ran."
      />

      <Card className="mb-4">
        <h2 className="mb-2 font-semibold">What an import does</h2>
        <ol className="grid list-decimal gap-1 pl-5 text-sm">
          <li>
            Each player in the save is looked up in <b>players</b> by his FM Unique ID. Found: his
            row is updated. Not found: a row is added. A player only ever has one row.
          </li>
          <li>
            A copy of every player's attributes, age and stats goes into <b>player_snapshots</b>,
            one row per player per import, linked to the player. Development compares these copies.
          </li>
          <li>Players no longer at the club get in_squad = false and their copies are deleted.</li>
          <li>
            <b>staff</b> is replaced with the save's list; competitions, the season's squad and
            World go to the files listed at the bottom.
          </li>
          <li>
            One row in <b>imports</b> records the import.
          </li>
        </ol>
      </Card>

      <div className="grid gap-3">
        {schema.map((t) => (
          <SettingsSection
            key={t.name}
            id={`database/${t.name}`}
            title={<span className="font-mono">{t.name}</span>}
            aside={`${t.columns.length} columns`}
            defaultOpen={false}
          >
            {TABLE_NOTES[t.name] && <p className="mb-3 text-sm">{TABLE_NOTES[t.name]}</p>}
            {t.unique.length > 0 && (
              <p className="mb-2 text-xs text-muted">
                Unique: {t.unique.map((u) => u.join(' + ')).join(' · ')}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="py-1 pr-3 font-normal">Column</th>
                    <th className="py-1 pr-3 font-normal">Type</th>
                    <th className="py-1 font-normal">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {t.columns.map((c) => (
                    <tr key={c.name} className="border-t border-border/50 align-top">
                      <td className="py-1.5 pr-3 font-mono whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          {c.name === 'id' && (
                            <KeyRound className="size-3.5 text-accent" aria-label="Key" />
                          )}
                          {c.name}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 font-mono whitespace-nowrap text-muted">
                        {c.type}
                        {c.notNull ? '' : ' ?'}
                      </td>
                      <td className="py-1.5 text-muted">
                        {c.references && (
                          <span className="mr-2 inline-flex items-center gap-1 text-accent">
                            <Link2 className="size-3.5" aria-hidden />→ {c.references}
                          </span>
                        )}
                        {COLUMN_NOTES[`${t.name}.${c.name}`]}
                        {c.added !== t.added && (
                          <span className="ml-2 text-xs">(update {c.added})</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">
              Added by database update {t.added}. “?” = can be empty.
            </p>
          </SettingsSection>
        ))}

        <SettingsSection id="database/files" title="Files" defaultOpen={false}>
          <ul className="grid gap-2 text-sm">
            {STORAGE_FILES.map(([path, note]) => (
              <li key={path}>
                <span className="font-mono text-xs break-all">{path}</span>
                <p className="text-muted">{note}</p>
              </li>
            ))}
          </ul>
        </SettingsSection>
      </div>
    </>
  )
}
