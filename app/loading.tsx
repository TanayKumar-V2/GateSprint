import { Skeleton } from "@/components/ui/skeleton";

export default function RootLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading"
      className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6"
    >
      <Skeleton className="h-8 w-48" />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </main>
  );
}
