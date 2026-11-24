import type { SVGProps } from 'react'

/** Two disc (saucer) training cones, drawn like the Lucide icons (24px grid, 2px stroke). */
export function ConesIcon(props: SVGProps<SVGSVGElement>) {
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
      {/* Front cone: wide flat rim, low sloping sides, the open flat top */}
      <path d="M1 19.5h14" />
      <path d="M2.5 19.5 6 13.5h4l3.5 6" />
      {/* Back cone, a little smaller */}
      <path d="M11.5 12h11.5" />
      <path d="M13 12l2.7-4.5h3.1L21.5 12" />
    </svg>
  )
}
