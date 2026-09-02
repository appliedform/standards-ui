import * as React from "react";
import { defineMove } from "@standards/core";
import { META } from "../meta";
import { Label, Note } from "../primitives";

export interface BandStatementProps {
  label?: string;
  statement: string;
  figures?: { term: string; value: string }[];
  note?: string;
  /** Negative inset so the band reaches full measure inside a padded parent. */
  bleed?: number;
}

/** A section declared, not introduced. The invariant doing rhetorical work. */
export const BandStatement = defineMove<BandStatementProps>(
  ({ label, statement, figures = [], note, bleed = 32 }) => (
    <section style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {label && <Label>{label}</Label>}
      <div style={{ background: "var(--ink)", padding: 32, margin: `0 -${bleed}px` }}>
        <p style={{ margin: 0, color: "#FFFFFF", fontSize: 34, fontWeight: 800,
                    lineHeight: 1.15, maxWidth: "24ch" }}>{statement}</p>
      </div>
      {figures.length > 0 && (
        <div style={{ display: "flex", gap: 48, borderTop: "1px solid var(--rule)", paddingTop: 16 }}>
          {figures.map((f) => (
            <div key={f.term}>
              <div style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--muted)" }}>{f.term}</div>
              <div style={{ fontFamily: "var(--font-data)", fontSize: 16 }}>{f.value}</div>
            </div>
          ))}
        </div>
      )}
      {note && <Note>{note}</Note>}
    </section>
  ),
  META["Band statement"]
);
