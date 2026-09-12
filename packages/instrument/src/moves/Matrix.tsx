import * as React from "react";
import { defineMove } from "@standards/core";
import { META } from "../meta";
import { Label, Note } from "../primitives";

export interface MatrixProps {
  label: string;
  columns: string[];
  rows: { label: string; values: string[] }[];
  /** [rowIndex, colIndex] of the single emphasised cell. One loud element, not a series. */
  emphasis?: [number, number];
  note?: string;
  /** Optional stable prefix for independently checked workflow fact markers. */
  factPrefix?: string;
}

/** Two variables crossed. The grid is the argument. */
export const Matrix = defineMove<MatrixProps>(({ label, columns, rows, emphasis, note, factPrefix }) => {
  const fact = (suffix: string) => factPrefix ? `${factPrefix}.${suffix}` : undefined;
  return (
  <section style={{ display: "flex", flexDirection: "column", gap: 32 }}>
    <Label factId={fact("label")}>{label}</Label>
    <table className="instrument-matrix" style={{ width: "100%", borderCollapse: "collapse", borderTop: "1px solid var(--ink)" }}>
      <thead>
        <tr>
          <th style={{ width: 96 }} />
          {columns.map((c, index) => (
            <th key={`${c}-${index}`} scope="col" data-std-fact={fact(`columns.${index}`)} style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--muted)",
                                             fontWeight: 400, textAlign: "right", padding: "8px 16px",
                                             letterSpacing: "0.04em" }}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={r.label}>
            <th scope="row" data-std-fact={fact(`rows.${ri}.label`)} style={{ fontFamily: "var(--font-data)", fontSize: 13, fontWeight: 400,
                                     textAlign: "left", padding: "8px 16px 8px 0",
                                     borderTop: "1px solid var(--rule)" }}>{r.label}</th>
            {r.values.map((v, ci) => {
              const hot = emphasis && emphasis[0] === ri && emphasis[1] === ci;
              return (
                <td key={ci} data-std-fact={fact(`rows.${ri}.values.${ci}`)}
                    data-matrix-emphasis={hot ? "true" : undefined} style={{ fontFamily: "var(--font-data)", fontSize: 15, textAlign: "right",
                                      padding: "8px 16px", borderTop: "1px solid var(--rule)",
                                      borderLeft: hot ? "4px solid var(--signal)" : undefined,
                                      color: hot ? "var(--signal)" : "var(--ink)",
                                      fontWeight: hot ? 500 : 400 }}>{v}</td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
    {note && <Note factId={fact("note")}>{note}</Note>}
  </section>
  );
}, META["Matrix"]
);
