import type { DimensionScore } from "@/lib/types";

/**
 * A single dimension rendered as a labelled meter.
 *
 * Uses `role="meter"` with aria value attributes so assistive technology reads
 * the real numbers, and always prints the numeric score next to the bar so the
 * information is never conveyed by bar length or colour alone.
 */
export default function ScoreMeter({
  dimension,
  accent = "var(--yellow)",
  showDetail = false,
}: {
  dimension: DimensionScore;
  accent?: string;
  showDetail?: boolean;
}) {
  const pct = dimension.max > 0 ? Math.round((dimension.score / dimension.max) * 100) : 0;

  return (
    <div className="score-meter">
      <div className="score-meter-head">
        <span className="score-meter-label">{dimension.label}</span>
        <span className="score-meter-value">
          {dimension.score}
          <span className="score-meter-max"> / {dimension.max}</span>
        </span>
      </div>

      <div
        className="score-meter-track"
        role="meter"
        aria-valuenow={dimension.score}
        aria-valuemin={0}
        aria-valuemax={dimension.max}
        aria-label={`${dimension.label}: ${dimension.score} out of ${dimension.max}`}
      >
        <div
          className="score-meter-fill"
          style={{ width: `${pct}%`, background: accent }}
        />
      </div>

      {showDetail && dimension.detail ? (
        <p className="score-meter-detail">{dimension.detail}</p>
      ) : null}
    </div>
  );
}
