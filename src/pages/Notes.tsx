import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { NotesPanel } from '../components/NotesPanel'
import { PageHeader } from '../components/ui'
import { useCurrentCareer } from '../lib/career'

/** Every note of the current career. */
export function Notes() {
  const career = useCurrentCareer()
  return (
    <>
      <Link
        to="/"
        className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> Dashboard
      </Link>
      <PageHeader title="Notes" subtitle={`${career.name} · ${career.club}`} />
      <NotesPanel />
    </>
  )
}
