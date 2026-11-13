import { Copy } from 'lucide-react'
import { useState } from 'react'
import sql0006 from '../../supabase/migrations/0006_tactics_and_match_log.sql?raw'
import sql0007 from '../../supabase/migrations/0007_staff_details.sql?raw'
import sql0008 from '../../supabase/migrations/0008_notes.sql?raw'

const UPDATES = { '0006': sql0006, '0007': sql0007, '0008': sql0008 }
import { Button } from './form'
import { Card } from './ui'

/** Shown when a table the page needs is not in Supabase yet (with the SQL to add it). */
export function DbUpdateNotice({ update = '0006' }: { update?: keyof typeof UPDATES }) {
  const sql = UPDATES[update]
  const [copied, setCopied] = useState(false)
  return (
    <Card className="border-amber-400/50">
      <h2 className="font-semibold">One-time database update needed</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
        <li>Press the button below to copy the update.</li>
        <li>
          Open Supabase → your project → <strong>SQL Editor</strong> → <strong>New query</strong>.
        </li>
        <li>
          Paste and press <strong>Run</strong>. Then come back here and reload.
        </li>
      </ol>
      <Button
        className="mt-3"
        onClick={async () => {
          await navigator.clipboard.writeText(sql)
          setCopied(true)
        }}
      >
        <Copy className="size-4" aria-hidden /> {copied ? 'Copied' : 'Copy the update'}
      </Button>
    </Card>
  )
}
