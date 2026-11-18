import { formatEuro } from "@/domain/money";
import { flowShareBps } from "@/domain/money-flow";

export type FlowTone = "pine" | "moss" | "amber" | "clay" | "muted" | "ink";

export type FlowSlice = {
  key: string;
  label: string;
  amountCents: number;
  tone: FlowTone;
};

const FILL: Record<FlowTone, string> = {
  pine: "var(--color-pine)",
  moss: "var(--color-moss)",
  amber: "var(--color-amber)",
  clay: "var(--color-clay)",
  muted: "var(--color-muted)",
  ink: "var(--color-ink)",
};

const WIDTH = 760;
const TOP = 58;
const BOTTOM = 18;
const ROW_MIN = 42;
const SOURCE_X = 10;
const SOURCE_W = 14;
const BAND_START = 24;
const SINK_X = 560;
const SINK_W = 14;
const LABEL_X = 584;
const AMOUNT_X = 752;

/**
 * A single-source Sankey. The source bar spans every slice, so the band height
 * is the slice's share of the gross revenue. Slice labels and amounts sit to
 * the right and stay readable even when a slice is small.
 */
export function MoneyFlowChart({
  slices,
  sourceLabel,
  sourceAmountCents,
  ariaLabel,
  empty,
  shareLabel,
}: {
  slices: FlowSlice[];
  sourceLabel: string;
  sourceAmountCents: number;
  ariaLabel: string;
  empty: string;
  shareLabel: (share: number) => string;
}) {
  if (slices.length === 0 || sourceAmountCents <= 0) {
    return <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{empty}</p>;
  }

  const heights = slices.map((slice) => Math.max(ROW_MIN, (slice.amountCents / sourceAmountCents) * 320));
  const bodyHeight = heights.reduce((sum, height) => sum + height, 0);
  const height = TOP + bodyHeight + BOTTOM;

  let y = TOP;
  const rows = slices.map((slice, index) => {
    const rowHeight = heights[index];
    const top = y;
    y += rowHeight;
    return { ...slice, top, height: rowHeight, middle: top + rowHeight / 2 };
  });

  let sourceY = TOP;
  const bands = rows.map((row) => {
    const sourceTop = sourceY;
    sourceY += row.height;
    return { ...row, sourceTop, sourceBottom: sourceY };
  });
  const middleX = (BAND_START + SINK_X) / 2;
  const sourceBottom = TOP + bodyHeight;

  function bandPath(sourceTop: number, sourceBottomValue: number, sinkTop: number, sinkBottom: number): string {
    return [
      `M ${BAND_START} ${sourceTop}`,
      `C ${middleX} ${sourceTop}, ${middleX} ${sinkTop}, ${SINK_X} ${sinkTop}`,
      `L ${SINK_X} ${sinkBottom}`,
      `C ${middleX} ${sinkBottom}, ${middleX} ${sourceBottomValue}, ${BAND_START} ${sourceBottomValue}`,
      "Z",
    ].join(" ");
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[44rem]">
        <svg viewBox={`0 0 ${WIDTH} ${height}`} className="h-auto w-full" role="img" aria-label={ariaLabel}>
          <text x={SOURCE_X} y={20} fontSize={13} fontWeight={600} fill="var(--color-ink)">
            {sourceLabel}
          </text>
          <text x={SOURCE_X} y={38} fontSize={12} fill="var(--color-muted)">
            {formatEuro(sourceAmountCents)}
          </text>

          <rect x={SOURCE_X} y={TOP} width={SOURCE_W} height={bodyHeight} rx={4} fill="var(--color-pine)" opacity={0.9} />

          {bands.map((band) => (
            <path
              key={`${band.key}-band`}
              d={bandPath(band.sourceTop, band.sourceBottom, band.top, band.top + band.height)}
              fill={FILL[band.tone]}
              opacity={0.3}
            />
          ))}

          {rows.map((row) => (
            <g key={row.key}>
              <title>{`${row.label}: ${formatEuro(row.amountCents)}`}</title>
              <rect x={SINK_X} y={row.top} width={SINK_W} height={row.height} rx={3} fill={FILL[row.tone]} />
              <text x={LABEL_X} y={row.middle - 2} fontSize={12} fontWeight={500} fill="var(--color-ink)">
                {row.label}
              </text>
              <text x={AMOUNT_X} y={row.middle + 13} fontSize={11} textAnchor="end" fill="var(--color-muted)" className="tabular-nums">
                {formatEuro(row.amountCents)} · {shareLabel(flowShareBps(row.amountCents, sourceAmountCents))}
              </text>
            </g>
          ))}

          <line x1={SOURCE_X} y1={sourceBottom + 6} x2={WIDTH - 8} y2={sourceBottom + 6} stroke="var(--color-line)" strokeWidth={1} />
        </svg>
      </div>
    </div>
  );
}