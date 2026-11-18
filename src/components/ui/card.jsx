import { cn } from '../../lib/utils'

export function Card({ className, ...props }) {
  return <section className={cn('rounded-[1.6rem] border border-white/80 bg-white/85 shadow-[0_12px_34px_rgb(22_66_94/10%)] backdrop-blur-xl', className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn('p-5 sm:p-6', className)} {...props} />
}
