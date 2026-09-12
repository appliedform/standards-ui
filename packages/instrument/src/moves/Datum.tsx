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
  /** Optional stable prefix for independently checked workflow fact markers. */
  factPrefix?: string;
}

/** One figure reframes the section. Scale in mono reads as a measurement, not a boast. */
export const Datum = defineMove<DatumProps>(
  ({ label, value, unit, supporting = [], note, factPrefix }) => {
    const fact = (suffix: string) => factPrefix ? `${factPrefix}.${suffix}` : undefined;
    return (
    <section style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <Label factId={fact("label")}>{label}</Label>
      <Figure value={value} unit={unit} size={96}
              valueFactId={fact("value")} unitFactId={fact("unit")} />
      {supporting.length > 0 && (
        <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 16,
                      display: "flex", flexWrap: "wrap", gap: 48 }}>
          {supporting.map((s, index) => (
            <div key={s.term}>
              <div data-std-fact={fact(`supporting.${index}.term`)} style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--muted)" }}>{s.term}</div>
              <div data-std-fact={fact(`supporting.${index}.value`)} style={{ fontFamily: "var(--font-data)", fontSize: 16 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
      {note && <Note factId={fact("note")}>{note}</Note>}
    </section>
    );
  },
  META["Datum"]
);
