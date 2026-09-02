import * as React from "react";
import { defineMove } from "@standards/core";
import { META } from "../meta";
import { Label, Note, Figure } from "../primitives";

export interface DatumProps {
  label: string;
  value: string;
  unit?: string;
  /** Supporting figures shown beneath the rule. Kept few — the datum is the point. */
  supporting?: { term: string; value: string }[];
  note?: string;
}

/** One figure reframes the section. Scale in mono reads as a measurement, not a boast. */
export const Datum = defineMove<DatumProps>(
  ({ label, value, unit, supporting = [], note }) => (
    <section style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <Label>{label}</Label>
      <Figure value={value} unit={unit} size={96} />
      {supporting.length > 0 && (
        <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 16, display: "flex", gap: 48 }}>
          {supporting.map((s) => (
            <div key={s.term}>
              <div style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--muted)" }}>{s.term}</div>
              <div style={{ fontFamily: "var(--font-data)", fontSize: 16 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
      {note && <Note>{note}</Note>}
    </section>
  ),
  META["Datum"]
);
