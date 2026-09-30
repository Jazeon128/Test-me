export default function Spinner({ 'aria-label': label = 'Loading', className = '' }) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`animate-spin rounded-full border-b-2 border-primary-600 ${className}`}
    />
  )
}
