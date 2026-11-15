import logo from '../assets/logo.png'
import logoWide from '../assets/logo-wide.png'

/**
 * The ProjectFM logo (transparent, for dark backgrounds). Height from className.
 * `wide` is the mark with the name beside it, for the open sidebar.
 */
export function Logo({ className, wide }: { className?: string; wide?: boolean }) {
  return (
    <img src={wide ? logoWide : logo} alt="ProjectFM" className={className} draggable={false} />
  )
}
