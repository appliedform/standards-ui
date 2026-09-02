import * as React from "react";
import { defineMove } from "@standards/core";
import { META } from "../meta";
import { Label, Note } from "../primitives";

/** Fill is never colour alone — Instrument's floor is that colour is never the only signal. */
export type KeyMark = "solid" | "hatch" | "dashed" | "signal";

export interface KeyProps {
  label: string;
  entries: { mark: KeyMark; term: string; gloss: string }[];
  note?: string;
}

const mark = (m: KeyMark): React.ReactNode => {
  const base: React.CSSProperties = { width: 32, height: 12 };
  if (m === "solid") return <div style={{ ...base, background: "var(--ink)" }} />;
  if (m === "signal") return <div style={{ ...base, background: "var(--signal)" }} />;
  if (m === "dashed") return <div style={{ width: 32, height: 0, borderTop: "2px dashed var(--ink)" }} />;
  // Hard-stop hatching, not a gradient: it distinguishes the class without relying on colour.
  return <div style={{ ...base, background: "repeating-linear-gradient(90deg,var(--ink) 0 2px,var(--ground) 2px 5px)" }} />;
};

/** A legend understood before the data. Says the data is worth decoding. */
export const Key = defineMove<KeyProps>(({ label, entries, note }) => (
  <section style={{ display: "flex", flexDirection: "column", gap: 32 }}>
    <Label>{label}</Label>
    <div style={{ borderBottom: "1px solid var(--rule)" }}>
      {entries.map((e) => (
        <div key={e.term} style={{ display: "flex", gap: 16, alignItems: "flex-start",
                                   padding: "8px 0", borderTop: "1px solid var(--rule)" }}>
          <div style={{ width: 48, flexShrink: 0 }}>{mark(e.mark)}</div>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 13, width: 96, flexShrink: 0 }}>{e.term}</div>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>{e.gloss}</div>
        </div>
      ))}
    </div>
    {note && <Note>{note}</Note>}
  </section>
), META["Key"]
);
