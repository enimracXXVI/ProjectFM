export function Splash({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="grid h-full place-items-center text-sm text-muted" role="status">
      {message}
    </div>
  )
}
