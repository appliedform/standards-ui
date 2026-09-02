import * as React from "react";
import { defineMove } from "@standards/core";
import { META } from "../meta";
import { Note } from "../primitives";

export interface RunningIndexProps {
  document: string;
  folio: string;
  sections: string[];
  /** 1-based. Marked by rule and weight as well as colour — colour is never the only signal. */
  current?: number;
  note?: string;
}

/** Past page two of a long document. Position is information. */
export const RunningIndex = defineMove<RunningIndexProps>(
  ({ document, folio, sections, current, note }) => (
    <nav aria-label="Document position" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
                    borderBottom: "1px solid var(--ink)", paddingBottom: 8 }}>
        <div style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em" }}>{document}</div>
        <div style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--muted)" }}>{folio}</div>
      </div>
      <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {sections.map((s, i) => {
          const cur = current === i + 1;
          return (
            <li key={s} aria-current={cur ? "step" : undefined}
                style={{ display: "flex", gap: 16, alignItems: "stretch", padding: "8px 0" }}>
              <div style={{ width: 3, alignSelf: "stretch", background: cur ? "var(--signal)" : "transparent" }} />
              <div style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--muted)", width: 32 }}>{i + 1}</div>
              <div style={{ fontSize: 14, color: cur ? "var(--signal)" : "var(--ink)", fontWeight: cur ? 500 : 400 }}>{s}</div>
            </li>
          );
        })}
      </ol>
      {note && <Note>{note}</Note>}
    </nav>
  ),
  META["Running index"]
);
