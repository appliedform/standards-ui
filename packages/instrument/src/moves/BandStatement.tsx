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
  /** Optional stable prefix for independently checked workflow fact markers. */
  factPrefix?: string;
}

/** A section declared, not introduced. The invariant doing rhetorical work. */
export const BandStatement = defineMove<BandStatementProps>(
  ({ label, statement, figures = [], note, bleed = 32, factPrefix }) => {
    const fact = (suffix: string) => factPrefix ? `${factPrefix}.${suffix}` : undefined;
    return (
    <section style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {label && <Label factId={fact("label")}>{label}</Label>}
      <div style={{ background: "var(--ink)", padding: 32,
                    margin: `0 max(-${bleed}px, calc((100% - 100vw) / 2))` }}>
        <p data-std-fact={fact("statement")} style={{ margin: 0, color: "#FFFFFF", fontSize: 34, fontWeight: 800,
                    lineHeight: 1.15, maxWidth: "24ch", overflowWrap: "anywhere" }}>{statement}</p>
      </div>
      {figures.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 48,
                      borderTop: "1px solid var(--rule)", paddingTop: 16 }}>
          {figures.map((f, index) => (
            <div key={f.term}>
              <div data-std-fact={fact(`figures.${index}.term`)} style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--muted)" }}>{f.term}</div>
              <div data-std-fact={fact(`figures.${index}.value`)} style={{ fontFamily: "var(--font-data)", fontSize: 16 }}>{f.value}</div>
            </div>
          ))}
        </div>
      )}
      {note && <Note factId={fact("note")}>{note}</Note>}
    </section>
    );
  },
  META["Band statement"]
);
