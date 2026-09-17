import { cn } from "cn"

/**
 * Telemetry placeholder block: square cell with a razor border, fully
 * theme-driven — graphite on newsprint, phosphor on CRT.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse border border-(--crt-line) bg-(--crt-raised)", className)}
      {...props}
    />
  )
}

export { Skeleton }
