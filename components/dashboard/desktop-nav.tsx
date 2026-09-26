"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    label: "LEARN",
    items: [
      { href: "/practice", label: "PRACTICE", code: "D-01" },
      { href: "/mentor", label: "MENTOR", code: "D-02" },
      { href: "/sheets", label: "SHEETS", code: "D-10" },
      { href: "/syllabus", label: "SYLLABUS", code: "D-07" },
    ],
  },
  {
    label: "REVISE",
    items: [
      { href: "/mistakes", label: "MISTAKES", code: "D-05" },
      { href: "/revision", label: "REVISION", code: "D-06" },
      { href: "/bookmarks", label: "SAVED", code: "D-04" },
    ],
  },
  {
    label: "TEST",
    items: [
      { href: "/mocks", label: "MOCKS", code: "D-08" },
      { href: "/trends", label: "TRENDS", code: "D-09" },
      { href: "/progress", label: "PROGRESS", code: "D-03" },
    ],
  },
];

export function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Study sections" className="hidden min-w-0 flex-1 items-stretch overflow-x-auto sm:flex" tabIndex={0}>
      <ul className="crt-micro flex items-stretch text-[11px] h-full">
        {NAV_GROUPS.map((group, i) => (
          <li key={group.label} className="flex items-stretch relative group">
            {/* Group Label (visible on hover or focus-within, or just part of the list) */}
            <div className={cn("flex items-stretch border-r border-(--crt-line)", i === 0 ? "border-l" : "")}>
              <div className="flex items-center px-3 text-(--crt-dim) font-bold bg-(--crt-bg)/50">
                {group.label}
              </div>
              <ul className="flex items-stretch">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href} className="flex items-stretch">
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2 whitespace-nowrap px-2.5 py-3 transition-colors h-full",
                          active
                            ? "bg-(--crt-raised) font-bold text-(--crt-ink) border-b-2 border-(--crt-red)"
                            : "text-(--crt-dim) hover:bg-(--crt-ink) hover:text-(--crt-bg) border-b-2 border-transparent"
                        )}
                      >
                        [ {item.label} ]
                        <span aria-hidden="true" className="hidden text-[9px] opacity-60 lg:inline">
                          {item.code}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </nav>
  );
}
