import * as React from "react";
import { defineMove } from "@standards/core";
import { META } from "../meta";
import { Note } from "../primitives";

export interface PlateRow {
  label: string;
  value: string;
  /** Finite 0–100 percentage. Invalid scales are labelled unavailable, never clamped. */
  pct: number;
  /** Only the first true row is selected: a word/weight cue and one signal rule. */
  emphasis?: boolean;
}
export interface PlateProps {
  /** Citable identifier, e.g. "Plate 3". Rendered in ink; signal is reserved for one selected-row rule. */
  number: string;
  title: string;
  rows: PlateRow[];
  caption?: string;
  /** Standard reference and date, right-aligned in mono. */
  reference?: string;
}

/** A figure needing a number and caption so it can be cited later. Makes the evidence quotable. */
export const Plate = defineMove<PlateProps>(
  ({ number, title, rows, caption, reference }) => {
    const selectedIndex = rows.findIndex((row) => row.emphasis);
    return (
    <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 32 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--ink)" }}>{number}</span>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8,
                    borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--rule)", padding: "24px 0" }}>
        {rows.map((r, index) => {
          const scaleAvailable = Number.isFinite(r.pct) && r.pct >= 0 && r.pct <= 100;
          return (
          <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontFamily: "var(--font-data)", fontSize: 12,
                          color: index === selectedIndex ? "var(--ink)" : "var(--muted)",
                          fontWeight: index === selectedIndex ? 500 : undefined, width: 96, flexShrink: 0 }}>
              {r.label}
              {index === selectedIndex && (
                <div data-plate-selected="" style={{ fontSize: 11, fontWeight: 500, color: "var(--ink)",
                                                     borderLeft: "4px solid var(--signal)", paddingLeft: 8 }}>
                  Selected
                </div>
              )}
              {!scaleAvailable && (
                <div data-plate-scale-unavailable="" style={{ fontSize: 11, fontWeight: 400, color: "var(--muted)" }}>
                  Scale unavailable
                </div>
              )}
            </div>
            <div style={{ flexGrow: 1, height: 16, borderBottom: "1px solid var(--rule)" }}>
              {scaleAvailable && (
                <div data-plate-bar="" aria-hidden="true" style={{ width: `${r.pct}%`, height: 16,
                                                                  background: "var(--ink)" }} />
              )}
            </div>
            <div style={{ fontFamily: "var(--font-data)", fontSize: 13, width: 72, textAlign: "right" }}>{r.value}</div>
          </div>
          );
        })}
      </div>
      {(caption || reference) && (
        <figcaption style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 32 }}>
          {caption && <Note>{caption}</Note>}
          {reference && (
            <div style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--muted)",
                          textAlign: "right", whiteSpace: "pre-line" }}>{reference}</div>
          )}
        </figcaption>
      )}
    </figure>
    );
  },
  META["Plate"]
);
