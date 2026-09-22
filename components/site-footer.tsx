import Link from "next/link";

/* Shared footer link columns (CRT terminal style). Rendered inside the
 * landing and dashboard footers so both stay in sync. */

export const FOOTER_GROUPS: {
  heading: string;
  links: { href: string; label: string }[];
}[] = [
  {
    heading: "[ INDEX ]",
    links: [
      { href: "/practice", label: "PRACTICE" },
      { href: "/mentor", label: "MENTOR" },
      { href: "/progress", label: "PROGRESS" },
      { href: "/bookmarks", label: "SAVED" },
    ],
  },
  {
    heading: "[ DOSSIER ]",
    links: [
      { href: "/about", label: "ABOUT US" },
      { href: "/contact", label: "CONTACT US" },
    ],
  },
  {
    heading: "[ PROTOCOL ]",
    links: [
      { href: "/privacy", label: "PRIVACY POLICY" },
      { href: "/cookies", label: "COOKIE POLICY" },
      { href: "/terms", label: "TERMS OF SERVICE" },
    ],
  },
];

export function FooterLinkGroups({ className = "" }: { className?: string }) {
  return (
    <div className={`grid gap-px bg-(--crt-line) sm:grid-cols-3 ${className}`}>
      {FOOTER_GROUPS.map((group) => (
        <nav
          key={group.heading}
          aria-label={group.heading}
          className="bg-(--crt-bg) px-4 py-4 sm:px-5"
        >
          <p className="crt-micro text-[10px] font-bold text-(--crt-red)">
            {group.heading}
          </p>
          <ul className="crt-micro mt-2 space-y-1.5 text-[11px]">
            {group.links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-(--crt-dim) transition-colors hover:text-(--crt-ink)"
                >
                  {">>>"} {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ))}
    </div>
  );
}

export function FooterColophon({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 bg-(--crt-bg) px-4 py-3 sm:px-5 ${className}`}
    >
      <span className="crt-micro text-[10px] text-(--crt-dim)">
        GATE-SPRINT® {"///"} FIELD MANUAL REV 2.6
      </span>
      <span aria-hidden="true" className="crt-barcode h-5 min-w-16 flex-1 text-(--crt-line)" />
      <a
        href="mailto:hello@gatementor.in"
        className="crt-micro text-[10px] text-(--crt-dim) transition-colors hover:text-(--crt-ink)"
      >
        HELLO@GATEMENTOR.IN
      </a>
      <a
        href="tel:+919876543210"
        className="crt-micro text-[10px] text-(--crt-dim) transition-colors hover:text-(--crt-ink)"
      >
        +91 98765 43210
      </a>
      <span className="crt-micro text-[10px] text-(--crt-dim)">©2026</span>
    </div>
  );
}
