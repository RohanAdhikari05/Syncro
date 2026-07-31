type StatusMessageProps = {
  type: 'error' | 'success' | 'info' | 'loading'
  message: string
  className?: string
}

const styles: Record<StatusMessageProps['type'], string> = {
  error: 'text-red-500',
  success: 'text-emerald-500',
  info: 'text-muted-foreground',
  loading: 'text-muted-foreground',
}

export function StatusMessage({ type, message, className = '' }: StatusMessageProps) {
  if (!message) return null

  return (
    <p
      className={`text-sm ${styles[type]} ${className}`}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      {type === 'loading' ? message : message}
    </p>
  )
}

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-500">{message}</p>
}
