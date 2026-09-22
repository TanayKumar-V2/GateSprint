import Link from "next/link";

export function ProgressTabs({ active }: { active: "overview" | "time" }) {
  const link = (href: string, isActive: boolean, label: string) => (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={isActive ? "crt-btn-red !px-4 !py-2 !text-[11px]" : "crt-btn-line !px-4 !py-2 !text-[11px]"}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Progress sections" className="flex gap-2">
      {link("/progress", active === "overview", "OVERVIEW")}
      {link("/progress/time", active === "time", "TIME")}
    </nav>
  );
}
