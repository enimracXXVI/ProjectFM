import logo from '../assets/logo.png'

/** The ProjectFM logo (transparent, for dark backgrounds). Height from className. */
export function Logo({ className }: { className?: string }) {
  return <img src={logo} alt="ProjectFM" className={className} draggable={false} />
}
