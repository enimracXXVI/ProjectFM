import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui'

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
