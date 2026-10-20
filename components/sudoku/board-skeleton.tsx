export function BoardSkeleton() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col gap-4 safe-px safe-pt" aria-busy="true" aria-label="Loading game">
      <div className="h-10" />
      <div className="h-5" />
      <div className="aspect-square w-full animate-pulse rounded-[22px] bg-board shadow-[var(--shadow-card)]" />
      <div className="h-14 animate-pulse rounded-[12px] bg-fill" />
      <div className="h-14 animate-pulse rounded-[12px] bg-fill" />
    </div>
  );
}
