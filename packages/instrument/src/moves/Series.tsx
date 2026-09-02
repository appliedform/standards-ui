import * as React from "react";
import { defineMove } from "@standards/core";
import { META } from "../meta";
import { Label, Note } from "../primitives";

export interface SeriesProps {
  label: string;
  periods: { period: string; value: number; display?: string }[];
  /** Emphasise the current period only. Signal is never a data series. */
  emphasiseLast?: boolean;
  summary?: { term: string; value: string }[];
  height?: number;
  note?: string;
}

/** The same measure across periods. Change reads as shape before number. */
export const Series = defineMove<SeriesProps>(
  ({ label, periods, emphasiseLast = true, summary = [], height = 200, note }) => {
    const max = Math.max(...periods.map((p) => p.value)) || 1;
    return (
      <section style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        <Label>{label}</Label>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", height,
                      borderBottom: "1px solid var(--ink)", paddingBottom: 8 }}>
          {periods.map((p, i) => {
            const hot = emphasiseLast && i === periods.length - 1;
            return (
              <div key={p.period} style={{ display: "flex", flexDirection: "column",
                                           justifyContent: "flex-end", alignItems: "center",
                                           gap: 8, flex: 1 }}>
                <div style={{ fontFamily: "var(--font-data)", fontSize: 12,
                              color: hot ? "var(--signal)" : "var(--muted)" }}>
                  {p.display ?? String(p.value)}
                </div>
                <div style={{ width: "100%", height: Math.round((p.value / max) * (height - 48)),
                              background: hot ? "var(--signal)" : "var(--ink)" }} />
                <div style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--muted)" }}>{p.period}</div>
              </div>
            );
          })}
        </div>
        {summary.length > 0 && (
          <div style={{ display: "flex", gap: 48 }}>
            {summary.map((s) => (
              <div key={s.term}>
                <div style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--muted)" }}>{s.term}</div>
                <div style={{ fontFamily: "var(--font-data)", fontSize: 16 }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}
        {note && <Note>{note}</Note>}
      </section>
    );
  },
  META["Series"]
);
