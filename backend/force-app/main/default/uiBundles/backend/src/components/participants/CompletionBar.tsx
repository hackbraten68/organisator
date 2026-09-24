interface CompletionBarProps {
  percent: number;
  showLabel?: boolean;
}

/** Small progress bar for onboarding completeness (0-100). */
export default function CompletionBar({
  percent,
  showLabel = true,
}: CompletionBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 min-w-16 flex-1 rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {clamped}%
        </span>
      )}
    </div>
  );
}
