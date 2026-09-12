import * as React from "react";
import { defineMove } from "@standards/core";
import { META } from "../meta";
import { Label, Note } from "../primitives";

export interface SeriesProps {
  label: string;
  periods: { period: string; value: number; display: string }[];
  /** Mark the final period with neutral Current text and one signal rule, never a red bar. */
  emphasiseLast?: boolean;
  summary?: { term: string; value: string }[];
  /** Chart height budget in px, clamped to 96–4096. Invalid values use 200. */
  height?: number;
  note?: string;
  /** Optional stable prefix for independently checked workflow fact markers. */
  factPrefix?: string;
}

/** The same measure across periods. Change reads as shape before number. */
export const Series = defineMove<SeriesProps>(
  ({ label, periods, emphasiseLast = true, summary = [], height = 200, note, factPrefix }) => {
    const fact = (suffix: string) => factPrefix ? `${factPrefix}.${suffix}` : undefined;
    const labelId = factPrefix ? `${factPrefix}-label` : undefined;
    const chartHeight = Number.isFinite(height) && height > 0
      ? Math.min(4096, Math.max(96, height))
      : 200;
    const plotHeight = chartHeight - 48;
    // Normalise before adding the positive and negative extents: two finite
    // values near Number.MAX_VALUE must not overflow their shared range.
    let positive = 0;
    let negative = 0;
    for (const p of periods) {
      if (!Number.isFinite(p.value)) continue;
      positive = Math.max(positive, p.value);
      negative = Math.max(negative, -p.value);
    }
    const magnitude = Math.max(positive, negative) || 1;
    const positiveExtent = positive / magnitude;
    const negativeExtent = negative / magnitude;
    const range = positiveExtent + negativeExtent;
    const zero = range ? (positiveExtent / range) * plotHeight : plotHeight / 2;
    return (
      <section style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        <Label id={labelId} factId={fact("label")}>{label}</Label>
        {periods.length === 0 ? <Note>No data available.</Note> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div data-series-plot=""
                 style={{ position: "relative", height: plotHeight }}>
              <div aria-hidden="true" style={{ position: "absolute", inset: "0 0 0 32px", display: "flex", gap: 16 }}>
                {periods.map((p, i) => {
                  const available = Number.isFinite(p.value);
                  const extent = available && range
                    ? (Math.abs(p.value / magnitude) / range) * plotHeight
                    : 0;
                  const top = p.value > 0 ? Math.max(0, zero - extent) : zero;
                  const barHeight = Math.max(0, Math.min(extent, plotHeight - top));
                  return (
                    <div key={`${p.period}-${i}`} style={{ position: "relative", flex: 1, minWidth: 0 }}>
                      {available && (
                        <div data-series-bar="" data-period={p.period}
                             style={{ position: "absolute", top, width: "100%", height: barHeight,
                                      background: "var(--ink)" }} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div data-series-zero="" aria-hidden="true" style={{ position: "absolute", top: zero, left: 32,
                                                right: 0, borderTop: "1px solid var(--ink)" }} />
              <span data-std-fact={fact("zero")} style={{ position: "absolute", top: Math.max(0, Math.min(plotHeight - 16, zero - 8)),
                             left: 0, width: 24, lineHeight: "16px", textAlign: "right",
                             fontFamily: "var(--font-data)", fontSize: 11, color: "var(--muted)" }}>0</span>
            </div>
            <ol aria-labelledby={labelId} aria-label={labelId ? undefined : `${label}: values by period`}
                style={{ display: "flex", gap: 16, listStyle: "none", margin: 0, padding: "0 0 0 32px" }}>
              {periods.map((p, i) => {
                const hot = emphasiseLast && i === periods.length - 1;
                return (
                  <li key={`${p.period}-${i}`} style={{ flex: 1, minWidth: 0, textAlign: "center",
                                                      overflowWrap: "anywhere", fontFamily: "var(--font-data)" }}>
                    <div data-std-fact={fact(`periods.${i}.period`)} style={{ fontSize: 11, color: "var(--muted)" }}>{p.period}</div>
                    <div data-std-fact={fact(`periods.${i}.display`)} style={{ fontSize: 12, color: "var(--ink)", fontWeight: hot ? 500 : undefined }}>
                      {Number.isFinite(p.value) ? p.display : "Unavailable"}
                    </div>
                    {hot && <div data-series-current="" data-std-fact={fact("current")} style={{ fontSize: 11, fontWeight: 500,
                                                                color: "var(--ink)", display: "inline-block",
                                                                borderLeft: "4px solid var(--signal)",
                                                                paddingLeft: 8 }}>Current</div>}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
        {summary.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 48 }}>
            {summary.map((s, index) => (
              <div key={s.term}>
                <div data-std-fact={fact(`summary.${index}.term`)} style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--muted)" }}>{s.term}</div>
                <div data-std-fact={fact(`summary.${index}.value`)} style={{ fontFamily: "var(--font-data)", fontSize: 16 }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}
        {note && <Note factId={fact("note")}>{note}</Note>}
      </section>
    );
  },
  META["Series"]
);
