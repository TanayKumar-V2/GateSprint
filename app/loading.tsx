/**
 * Root loading fallback: renders outside the dashboard shell, so it
 * carries its own minimal CRT substrate — one status line, one thin
 * activity bar, nothing else.
 */
export default function RootLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading"
      className="flex min-h-dvh items-center justify-center bg-(--crt-bg) px-6 text-(--crt-ink)"
    >
      <div className="w-full max-w-xs">
        <p className="crt-micro text-center text-[11px] text-(--crt-dim)">
          LOADING<span aria-hidden="true" className="crt-blink ml-1 inline-block h-3 w-1.5 bg-(--crt-red) align-middle" />
        </p>
        <div
          aria-hidden="true"
          className="mt-4 h-px w-full animate-pulse bg-(--crt-line)"
        />
      </div>
    </main>
  );
}
