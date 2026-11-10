/** Small trend line; green when the last value is higher than the first. */
export function Sparkline({
  values,
  width = 96,
  height = 28,
}: {
  values: number[]
  width?: number
  height?: number
}) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = width / (values.length - 1)
  const points = values
    .map(
      (v, i) =>
        `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / range) * (height - 4)).toFixed(1)}`,
    )
    .join(' ')
  const up = values[values.length - 1] >= values[0]
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className={up ? 'text-emerald-400' : 'text-red-400'}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
