import { redirect } from "next/navigation";
import { currentAdmin, listAdminQuestions, listAdminTaxonomy } from "@/lib/admin";
import { AdminQuestionManager } from "@/components/admin/question-manager";
import { ImportPanel } from "@/components/admin/import-panel";
import Link from "next/link";

export default async function AdminPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/sign-in?callbackUrl=/admin");
  const [questions, taxonomy] = await Promise.all([listAdminQuestions(), listAdminTaxonomy()]);
  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Admin workspace</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.06em]">Question bank</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Create, edit, publish, and remove practice questions. Unpublished questions stay hidden from students.</p></div>
          <div className="flex items-center gap-4"><Link href="/admin/import" className="text-sm font-medium text-primary underline underline-offset-4">Import JSON</Link><p className="text-sm text-muted-foreground">Signed in as {admin.email}</p></div>
        </div>
        <ImportPanel />
        <AdminQuestionManager initialQuestions={questions} subjects={taxonomy.subjects} topics={taxonomy.topics} />
      </div>
    </main>
  );
}
