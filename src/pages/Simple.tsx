import { Link } from 'react-router-dom'
import { PageHeader, Placeholder } from '../components/ui'

export function Achievements() {
  return (
    <>
      <PageHeader title="Achievements" subtitle="Trophies, records and milestones" />
      <Placeholder>Achievements tracking — coming soon</Placeholder>
    </>
  )
}

export function Import() {
  return (
    <>
      <PageHeader title="Import" subtitle="Load FM exports (Print Screen → Web Page)" />
      <Placeholder>HTML import with column mapping — coming soon</Placeholder>
    </>
  )
}

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <Placeholder>Account, backup and export — coming soon</Placeholder>
    </>
  )
}

export function NotFound() {
  return (
    <>
      <PageHeader title="Page not found" />
      <Link to="/" className="text-accent underline">
        Back to dashboard
      </Link>
    </>
  )
}
