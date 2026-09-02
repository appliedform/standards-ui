import * as React from "react";
import { defineMove } from "@standards/core";
import { META } from "../meta";
import { Note } from "../primitives";

export interface PlateRow { label: string; value: string; pct: number; emphasis?: boolean }
export interface PlateProps {
  /** Citable identifier, e.g. "Plate 3". Rendered in signal — this is identification. */
  number: string;
  title: string;
  rows: PlateRow[];
  caption?: string;
  /** Standard reference and date, right-aligned in mono. */
  reference?: string;
}

/** A figure needing a number and caption so it can be cited later. Makes the evidence quotable. */
export const Plate = defineMove<PlateProps>(
  ({ number, title, rows, caption, reference }) => (
    <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 32 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--signal)" }}>{number}</span>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8,
                    borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--rule)", padding: "24px 0" }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--muted)", width: 64 }}>{r.label}</div>
            <div style={{ flexGrow: 1, height: 16, borderBottom: "1px solid var(--rule)" }}>
              <div style={{ width: `${r.pct}%`, height: 16,
                            background: r.emphasis ? "var(--signal)" : "var(--ink)" }} />
            </div>
            <div style={{ fontFamily: "var(--font-data)", fontSize: 13, width: 72, textAlign: "right" }}>{r.value}</div>
          </div>
        ))}
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
  ),
  META["Plate"]
);
