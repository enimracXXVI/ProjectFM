import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, PageHeader } from '../../components/ui'
import { SETTINGS_GROUPS } from './sections'

/** What every settings page is for, in one place. */
export function SettingsGuide() {
  return (
    <>
      <Link
        to="/settings"
        className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> Settings
      </Link>
      <PageHeader
        title="Settings guide"
        subtitle="What each settings page is for and when you would change it. Most pages only need changing after an FM update; every page has a Reset button that brings back the defaults."
      />
      <div className="gap-4 lg:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
        {SETTINGS_GROUPS.map((g) => (
          <Card key={g.title}>
            <h2 className="font-semibold">{g.title}</h2>
            <p className="mb-3 text-sm text-muted">{g.intro}</p>
            <dl className="grid gap-3">
              {g.items.map((it) => (
                <div key={it.to}>
                  <dt>
                    <Link to={it.to} className="text-sm font-semibold text-accent">
                      {it.label}
                    </Link>
                  </dt>
                  <dd className="text-sm">{it.about}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}
      </div>
    </>
  )
}
