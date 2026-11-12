import type { SVGProps } from 'react'

/** A football pitch, drawn like the Lucide icons used elsewhere (24px grid, 2px stroke). */
export function PitchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M12 4v16" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M2 9h3v6H2" />
      <path d="M22 9h-3v6h3" />
    </svg>
  )
}
