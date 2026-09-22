import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import { getMockSession } from "@/lib/mocks";
import { MockRunner } from "@/components/mocks/mock-runner";
import { MockResult } from "@/components/mocks/mock-result";

export default async function MockSessionPage({
  params,
}: {
  params: Promise<{ mockSessionId: string }>;
}) {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");

  const { mockSessionId } = await params;
  const payload = await getMockSession(userId, mockSessionId);
  if ("error" in payload) notFound();

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Back" className="flex items-center justify-between">
        <Link
          href="/mocks"
          className="crt-micro inline-block text-[11px] text-(--crt-dim) transition-colors hover:text-(--crt-red)"
        >
          &lt;&lt;&lt; ALL MOCKS
        </Link>
        <span className="crt-micro text-[10px] text-(--crt-dim)">
          {payload.meta.title.toUpperCase()}
        </span>
      </nav>
      {payload.state === "running" ? (
        <MockRunner payload={payload} />
      ) : (
        <MockResult result={payload} />
      )}
    </div>
  );
}
