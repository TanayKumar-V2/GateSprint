import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Island CTA: fully rounded pill with the arrow nested in its own
 * circle, flush with the right padding. The circle drifts diagonally
 * on hover for internal kinetic tension.
 */
export function IslandCta({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-3 rounded-full py-2 pl-6 pr-2 text-sm font-medium",
        "transition-all duration-500 active:scale-[0.98]",
        variant === "primary"
          ? "bg-primary text-primary-foreground shadow-[0_18px_44px_-20px_oklch(0.72_0.16_72/0.7)] hover:shadow-[0_22px_54px_-18px_oklch(0.72_0.16_72/0.8)]"
          : "border border-border bg-background hover:bg-muted",
        className,
      )}
    >
      {children}
      <span
        aria-hidden="true"
        className={cn(
          "flex size-8 items-center justify-center rounded-full transition-all duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:scale-105",
          variant === "primary" ? "bg-black/10 dark:bg-white/15" : "bg-muted",
        )}
      >
        <ArrowUpRight className="size-4" strokeWidth={1.5} />
      </span>
    </Link>
  );
}
