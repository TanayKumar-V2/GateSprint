import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/current-user";
import { getProfileByUsername } from "@/lib/profile";
import {
  BreakdownTable,
  MetricCard,
} from "@/components/progress/cards";

function pct(accuracy: number | null): string {
  return accuracy === null ? "—" : `${Math.round(accuracy * 100)}%`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  // Profiles are signed-in only: the dashboard gate does not cover /u/*,
  // so this page enforces the same rule itself.
  const viewerId = await requireUserId();

  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  const { user, progress } = profile;
  const { overall } = progress;
  // Email is private: only the owner sees it on their own page, since any
  // signed-in user can view anyone's profile.
  const isOwner = viewerId === user.id;
  const initial = (user.name ?? user.username).trim().charAt(0).toUpperCase() || "?";

  return (
    // Outside the dashboard layout, so the CRT substrate is applied here
    // directly — theme-driven like everywhere else.
    <div className="crt-landing min-h-dvh bg-(--crt-bg) text-(--crt-ink)">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6">
        <Link
          href="/practice"
          className="crt-micro inline-block w-fit text-[11px] text-(--crt-dim) transition-colors hover:text-(--crt-red)"
        >
          &lt;&lt;&lt; BACK TO PRACTICE
        </Link>

        <header className="border border-(--crt-line) bg-(--crt-bg)">
          <div aria-hidden="true" className="crt-halftone relative h-28 overflow-hidden border-b border-(--crt-line) sm:h-32">
            <span className="crt-macro absolute -bottom-4 left-4 select-none text-[clamp(4rem,12vw,9rem)] leading-none text-(--crt-ghost)">
              @{user.username.slice(0, 6).toUpperCase()}
            </span>
            <span aria-hidden="true" className="crt-stripes absolute bottom-0 block h-2.5 w-full border-t border-(--crt-line)" />
          </div>
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:p-6">
            {user.image ? (
              <Image
                src={user.image}
                alt=""
                width={80}
                height={80}
                className="-mt-12 size-20 shrink-0 border-2 border-(--crt-ink) object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="-mt-12 grid size-20 shrink-0 place-items-center border-2 border-(--crt-ink) bg-(--crt-ink) text-3xl font-black text-(--crt-bg)"
              >
                {initial}
              </span>
            )}
            <div className="min-w-0 flex-1 sm:pb-1">
              <p className="crt-tag">
                @{user.username}
                {isOwner ? <span className="text-(--crt-red)"> · OWNER</span> : null}
              </p>
              <h1 className="crt-macro mt-2 truncate text-[clamp(1.8rem,5vw,3rem)] text-(--crt-ink)">
                {(user.name ?? `@${user.username}`).toUpperCase()}
              </h1>
              <ul className="crt-micro mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[10px] text-(--crt-dim)">
                <li>
                  ENLISTED{" "}
                  {user.createdAt.toLocaleDateString("en-IN", {
                    month: "short",
                    year: "numeric",
                  }).toUpperCase()}
                </li>
                {isOwner && user.email ? (
                  <li className="break-all">{user.email.toUpperCase()}</li>
                ) : null}
              </ul>
            </div>
          </div>
        </header>

        {overall.attempts === 0 ? (
          <p className="crt-micro border border-(--crt-line) p-6 text-center text-[11px] leading-relaxed text-(--crt-dim)">
            @{user.username.toUpperCase()} HASN&apos;T ATTEMPTED ANY QUESTIONS YET.
          </p>
        ) : (
          <>
            <section
              aria-label="Overall"
              className="grid gap-px border border-(--crt-line) bg-(--crt-line) sm:grid-cols-2 lg:grid-cols-4 [&>div]:border-0"
            >
              <MetricCard label="Attempts" value={String(overall.attempts)} />
              <MetricCard label="Accuracy" value={pct(overall.accuracy)} />
              <MetricCard
                label="Questions tried"
                value={`${overall.attemptedQuestions} / ${overall.totalQuestions}`}
              />
              <MetricCard
                label="Weak topics"
                value={String(progress.weakTopics.length)}
              />
            </section>

            <section aria-labelledby="profile-subjects" className="flex flex-col gap-4">
              <h2 id="profile-subjects" className="crt-micro text-[11px] text-(--crt-ink)">
                [ BY SUBJECT ]
              </h2>
              <BreakdownTable
                caption={`Accuracy by subject for @${user.username}`}
                rows={progress.subjects
                  .filter((s) => s.attempts > 0)
                  .map((s) => ({
                    slug: s.slug,
                    name: s.name,
                    attempts: s.attempts,
                    accuracy: s.accuracy,
                    detail: `${s.attemptedQuestions} / ${s.totalQuestions} questions`,
                    href: `/practice?subject=${s.slug}`,
                  }))}
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
