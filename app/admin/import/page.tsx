import Link from "next/link";
import { redirect } from "next/navigation";
import { adminAccess } from "@/lib/admin";
import { AdminDenied } from "@/components/admin/denied";
import { ImportPanel } from "@/components/admin/import-panel";

export default async function AdminImportPage() {
  const access = await adminAccess();
  if (access.status === "signed-out") redirect("/sign-in?callbackUrl=/admin/import");
  if (access.status === "denied") return <AdminDenied />;

  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between border-b border-border pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Admin workspace</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.06em]">Import questions</h1>
          </div>
          <Link href="/admin" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">Back to question bank</Link>
        </div>
        <ImportPanel />
      </div>
    </main>
  );
}
