export function SkeletonCard() {
  return (
    <div className="relative h-[140px] w-full rounded-xl bg-[#f0f0f0] overflow-hidden">
      <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent" />
    </div>
  );
}
