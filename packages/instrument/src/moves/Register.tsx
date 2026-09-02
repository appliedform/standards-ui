import * as React from "react";
import { defineMove } from "@standards/core";
import { META } from "../meta";
import { Label, Note } from "../primitives";

export interface RegisterProps {
  label: string;
  /** Three or four. More than four stops being one sweep. */
  figures: { value: string; unit?: string; term: string }[];
  note?: string;
}

/** Three or four figures state the position together, read in one sweep on a shared baseline. */
export const Register = defineMove<RegisterProps>(({ label, figures, note }) => (
  <section style={{ display: "flex", flexDirection: "column", gap: 32 }}>
    <Label>{label}</Label>
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      {figures.map((f) => (
        <div key={f.term} style={{ flex: 1, borderLeft: "1px solid var(--rule)", paddingLeft: 16 }}>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 40, lineHeight: 1, fontWeight: 500 }}>
            {f.value}
            {f.unit && <span style={{ fontSize: 15, color: "var(--muted)", marginLeft: 8 }}>{f.unit}</span>}
          </div>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--muted)",
                        marginTop: 16, letterSpacing: "0.04em" }}>{f.term}</div>
        </div>
      ))}
    </div>
    <div style={{ borderTop: "1px solid var(--rule)" }} />
    {note && <Note>{note}</Note>}
  </section>
), META["Register"]
);
