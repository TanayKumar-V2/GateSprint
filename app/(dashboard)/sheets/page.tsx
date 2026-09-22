import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import { listSheetsIndex } from "@/lib/sheets";

export default async function SheetsPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");

  const index = await listSheetsIndex();
  const total = index.subjects.flatMap((s) => s.topics).length;
  const ready = index.subjects.flatMap((s) => s.topics).filter((t) => t.hasSheet).length;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="crt-micro text-[11px] text-(--crt-red)">[ 10 {"///"} ONE-SHOT-SHEETS ]</p>
        <h1 className="crt-macro mt-2 text-[clamp(2.2rem,7vw,5.5rem)] text-(--crt-ink)">
          SHEETS<span className="text-(--crt-red)">.</span>
        </h1>
        <p className="crt-micro mt-3 text-[11px] text-(--crt-dim)">
          <output>{ready}/{total}</output> TOPICS HAVE CURATED SHEETS — DENSE FORMULAS, TRAPS, PYQ PATTERNS.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        {index.subjects.map((s) => (
          <section key={s.slug} aria-labelledby={`sheets-${s.slug}`}>
            <h2 id={`sheets-${s.slug}`} className="crt-micro text-[11px] text-(--crt-ink)">
              [ {s.name.toUpperCase()} ]
            </h2>
            <ul className="mt-3 grid gap-px border border-(--crt-line) bg-(--crt-line) sm:grid-cols-2">
              {s.topics.map((t) => (
                <li key={t.slug} className="flex items-center justify-between gap-3 bg-(--crt-bg) p-4">
                  <span className="text-sm font-bold text-(--crt-ink)">{t.name}</span>
                  {t.hasSheet ? (
                    <Link href={`/sheets/${t.slug}`} className="crt-btn-line !px-3 !py-1 !text-[10px]">
                      OPEN SHEET &gt;&gt;&gt;
                    </Link>
                  ) : (
                    <span className="crt-micro border border-(--crt-line) px-2 py-1 text-[9px] text-(--crt-dim)">
                      NO SHEET YET
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
