import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Theme-aware brand mark: white-on-black plate in dark mode,
 * black-on-white plate in light mode (white knocked out with a multiply
 * blend so it seats into the newsprint). Pure CSS switch via the `dark`
 * class — no JavaScript, no hydration mismatch.
 */
export function ThemeLogo({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex h-8 items-center", className)}>
      <Image
        src="/logo-light.png"
        alt=""
        width={317}
        height={210}
        priority
        className="h-6 w-auto mix-blend-multiply dark:hidden"
      />
      <Image
        src="/logo-dark.png"
        alt=""
        width={305}
        height={287}
        priority
        className="hidden h-8 w-auto dark:block"
      />
    </span>
  );
}
