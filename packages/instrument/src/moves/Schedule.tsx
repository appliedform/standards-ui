import * as React from "react";
import { defineMove } from "@standards/core";
import { META } from "../meta";
import { Label, Note } from "../primitives";

export interface ScheduleLine {
  ref: string; description: string; standard?: string; duration: string; amount: string;
}
export interface ScheduleProps {
  label: string;
  lines: ScheduleLine[];
  columns?: { duration: string; amount: string };
  total?: { label: string; duration: string; amount: string };
  note?: string;
}

/** Scope, cost or duration stated exactly. Precision is the persuasion. */
export const Schedule = defineMove<ScheduleProps>(
  ({ label, lines, columns = { duration: "DURATION", amount: "AMOUNT" }, total, note }) => (
    <section style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <Label>{label}</Label>
      <table style={{ width: "100%", borderCollapse: "collapse", borderTop: "1px solid var(--ink)" }}>
        <thead>
          <tr>
            <th style={{ width: 32 }} /><th />
            {[columns.duration, columns.amount].map((c, i) => (
              <th key={c} scope="col" style={{ fontFamily: "var(--font-data)", fontSize: 11,
                                               color: "var(--muted)", fontWeight: 400, textAlign: "right",
                                               padding: i === 0 ? "8px 16px" : "8px 0 8px 16px",
                                               letterSpacing: "0.04em" }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.ref}>
              <td style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--muted)",
                           padding: "8px 16px 8px 0", borderTop: "1px solid var(--rule)", verticalAlign: "top" }}>{l.ref}</td>
              <td style={{ fontSize: 15, padding: "8px 16px 8px 0", borderTop: "1px solid var(--rule)" }}>
                {l.description}
                {l.standard && (
                  <div style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--muted)", marginTop: 8 }}>{l.standard}</div>
                )}
              </td>
              <td style={{ fontFamily: "var(--font-data)", fontSize: 14, textAlign: "right",
                           padding: "8px 16px", borderTop: "1px solid var(--rule)", verticalAlign: "top" }}>{l.duration}</td>
              <td style={{ fontFamily: "var(--font-data)", fontSize: 14, textAlign: "right",
                           padding: "8px 0 8px 16px", borderTop: "1px solid var(--rule)", verticalAlign: "top" }}>{l.amount}</td>
            </tr>
          ))}
        </tbody>
        {total && (
          <tfoot>
            <tr>
              <td colSpan={2} style={{ fontFamily: "var(--font-data)", fontSize: 12,
                                       padding: "8px 0", borderTop: "2px solid var(--ink)" }}>{total.label}</td>
              <td style={{ fontFamily: "var(--font-data)", fontSize: 15, textAlign: "right",
                           padding: "8px 16px", borderTop: "2px solid var(--ink)" }}>{total.duration}</td>
              <td style={{ fontFamily: "var(--font-data)", fontSize: 15, textAlign: "right",
                           padding: "8px 0 8px 16px", borderTop: "2px solid var(--ink)" }}>{total.amount}</td>
            </tr>
          </tfoot>
        )}
      </table>
      {note && <Note>{note}</Note>}
    </section>
  ),
  META["Schedule"]
);
