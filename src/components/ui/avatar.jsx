import { cn } from '../../lib/utils'

export function Avatar({ className, children, ...props }) {
  return <div className={cn('grid size-11 shrink-0 place-items-center rounded-full bg-sky-100 text-lg font-extrabold text-sky-800 ring-4 ring-sky-50', className)} {...props}>{children}</div>
}
