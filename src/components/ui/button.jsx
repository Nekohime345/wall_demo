import { cn } from '../../lib/utils'

export function Button({ className, variant = 'default', size = 'default', ...props }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-bold transition duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 disabled:pointer-events-none disabled:opacity-50',
        variant === 'default' && 'bg-sky-700 text-white shadow-[0_8px_24px_rgb(18_83_126/25%)] hover:-translate-y-0.5 hover:bg-sky-800',
        variant === 'secondary' && 'border border-white/80 bg-white/80 text-sky-900 shadow-sm hover:bg-white',
        size === 'default' && 'min-h-12 px-6 text-base',
        size === 'icon' && 'size-10 p-0',
        className,
      )}
      {...props}
    />
  )
}
