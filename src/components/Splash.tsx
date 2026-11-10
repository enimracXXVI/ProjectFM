export function Splash({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="text-muted grid h-full place-items-center text-sm" role="status">
      {message}
    </div>
  )
}
