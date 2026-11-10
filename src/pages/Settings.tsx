import { Button } from '../components/form'
import { Card, PageHeader } from '../components/ui'
import { useAuth } from '../lib/auth'
import { signOut } from '../lib/authActions'

export function SettingsPage() {
  const { session } = useAuth()
  return (
    <>
      <PageHeader title="Settings" />
      <Card className="max-w-md">
        <p className="text-muted text-sm">Signed in as</p>
        <p className="font-medium break-all">{session?.user.email}</p>
        <Button variant="ghost" className="mt-3" onClick={() => signOut()}>
          Sign out
        </Button>
      </Card>
    </>
  )
}
