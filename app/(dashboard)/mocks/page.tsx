import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import { listMockSessions } from "@/lib/mocks";
import { listPublishedYears } from "@/lib/questions";
import { MockList } from "@/components/mocks/mock-list";
import { StartMockButton } from "@/components/mocks/start-mock-button";

export default async function MocksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");

  const sp = await searchParams;
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);
  const [list, years] = await Promise.all([
    listMockSessions(userId, { page, limit: 10 }),
    listPublishedYears(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="crt-micro text-[11px] text-(--crt-red)">[ 08 {"///"} EXAM-HALL ]</p>
        <h1 className="crt-macro mt-2 text-[clamp(2.2rem,7vw,5.5rem)] text-(--crt-ink)">
          MOCKS<span className="text-(--crt-red)">.</span>
        </h1>
        <p className="crt-micro mt-3 max-w-2xl text-[10px] leading-relaxed text-(--crt-dim)">
          TIMED PAPERS OVER VERIFIED QUESTIONS. THE CLOCK IS SERVER-OWNED — RELOADS DON'T PAUSE IT.
          SCORES SYNC BACK TO PROGRESS AND THE MISTAKE-BOOK.
        </p>
      </header>

      <section aria-labelledby="start-heading" className="flex flex-col gap-4">
        <h2 id="start-heading" className="crt-micro text-[11px] text-(--crt-ink)">
          [ START A PAPER ]
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="border border-(--crt-line) bg-(--crt-bg) p-5">
            <p className="crt-macro text-xl text-(--crt-ink)">FULL MOCK</p>
            <p className="crt-micro mt-2 text-[10px] leading-relaxed text-(--crt-dim)">
              UP TO 65Q · SCALED TO THE VERIFIED POOL · 3H PACE.
            </p>
            <div className="mt-4">
              <StartMockButton body={{ type: "full" }} label="START FULL >>>" sub="65Q WHEN THE POOL ALLOWS" />
            </div>
          </div>
          <div className="border border-(--crt-line) bg-(--crt-bg) p-5">
            <p className="crt-macro text-xl text-(--crt-ink)">CUSTOM DRILL</p>
            <p className="crt-micro mt-2 text-[10px] leading-relaxed text-(--crt-dim)">
              YOUR SUBJECTS, YOUR COUNT, YOUR CLOCK.
            </p>
            <Link href="/practice/new-test" className="crt-btn-line mt-4 inline-block">
              OPEN BUILDER &gt;&gt;&gt;
            </Link>
          </div>
          <div className="border border-(--crt-line) bg-(--crt-bg) p-5">
            <p className="crt-macro text-xl text-(--crt-ink)">PYQ PAPERS</p>
            <div className="mt-3 flex flex-col gap-2">
              {years.length === 0 ? (
                <p className="crt-micro text-[10px] text-(--crt-dim)">NO YEARS IN BANK YET.</p>
              ) : (
                years.slice(0, 6).map((y) => (
                  <StartMockButton
                    key={y}
                    body={{ type: "pyq_year", year: y }}
                    label={`GATE ${y} >>>`}
                    sub="FULL YEAR PAPER"
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="history-heading" className="flex flex-col gap-4">
        <h2 id="history-heading" className="crt-micro text-[11px] text-(--crt-ink)">
          [ HISTORY ]
        </h2>
        {list.total === 0 ? (
          <p className="crt-micro border border-(--crt-line) p-6 text-center text-[11px] text-(--crt-dim)">
            NO PAPERS YET. START ONE ABOVE — STAMINA IS TRAINED, NOT BORN.
          </p>
        ) : (
          <MockList list={list} />
        )}
      </section>
    </div>
  );
}
