import Link from "next/link";

const TAG_OPTIONS = [
  { value: "", label: "ALL TAGS" },
  { value: "concept_gap", label: "CONCEPT GAP" },
  { value: "silly_mistake", label: "SILLY MISTAKE" },
  { value: "trap", label: "TRAP" },
  { value: "time_pressure", label: "TIME PRESSURE" },
  { value: "unattempted", label: "UNATTEMPTED" },
] as const;

export function MistakeFilters({
  activeTag,
  resolved,
  hrefFor,
}: {
  activeTag: string;
  resolved: boolean | undefined;
  hrefFor: (extra: Record<string, string>) => string;
}) {
  return (
    <nav aria-label="Mistake filters" className="flex flex-wrap gap-2">
      {TAG_OPTIONS.map((o) => (
        <Link
          key={o.value || "all"}
          href={hrefFor(o.value ? { tag: o.value, page: "1" } : { page: "1" })}
          aria-current={activeTag === o.value ? "true" : undefined}
          className={
            activeTag === o.value
              ? "crt-btn-red !px-3 !py-1 !text-[10px]"
              : "crt-btn-line !px-3 !py-1 !text-[10px]"
          }
        >
          {o.label}
        </Link>
      ))}
      <Link
        href={hrefFor({ page: "1" })}
        className={resolved === undefined ? "crt-btn-red !px-3 !py-1 !text-[10px]" : "crt-btn-line !px-3 !py-1 !text-[10px]"}
      >
        ALL
      </Link>
      <Link
        href={hrefFor({ resolved: "false", page: "1" })}
        className={resolved === false ? "crt-btn-red !px-3 !py-1 !text-[10px]" : "crt-btn-line !px-3 !py-1 !text-[10px]"}
      >
        OPEN
      </Link>
      <Link
        href={hrefFor({ resolved: "true", page: "1" })}
        className={resolved === true ? "crt-btn-red !px-3 !py-1 !text-[10px]" : "crt-btn-line !px-3 !py-1 !text-[10px]"}
      >
        RESOLVED
      </Link>
    </nav>
  );
}
