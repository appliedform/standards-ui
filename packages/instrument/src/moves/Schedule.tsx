import * as React from "react";
import { defineMove } from "@standards/core";
import { META } from "../meta";
import { Note } from "../primitives";

export interface ScheduleLine {
  ref: string; description: string; standard?: string; duration: string; amount: string;
}
export interface ScheduleProps {
  label: string;
  lines: ScheduleLine[];
  columns?: { ref?: string; description?: string; duration: string; amount: string };
  total?: { label: string; duration: string; amount: string };
  note?: string;
  /** Optional stable prefix for independently checked workflow fact markers. */
  factPrefix?: string;
}

/** Scope, cost or duration stated exactly. Precision is the persuasion. */
export const Schedule = defineMove<ScheduleProps>(
  ({ label, lines, columns = { duration: "DURATION", amount: "AMOUNT" }, total, note, factPrefix }) => {
    const fact = (suffix: string) => factPrefix ? `${factPrefix}.${suffix}` : undefined;
    return (
    <section style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <table className="instrument-schedule" style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", borderTop: "1px solid var(--ink)" }}>
        <caption data-std-fact={fact("label")} style={{ fontFamily: "var(--font-data)", fontSize: 11,
                   color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase",
                   textAlign: "left", paddingBottom: 24 }}>{label}</caption>
        <colgroup><col style={{ width: "12%" }} /><col style={{ width: "42%" }} /><col style={{ width: "24%" }} /><col style={{ width: "22%" }} /></colgroup>
        <thead>
          <tr>
            {[columns.ref ?? "REF", columns.description ?? "DESCRIPTION"].map((heading, index) => (
              <th key={index} scope="col" data-std-fact={fact(`columns.${index === 0 ? "ref" : "description"}`)} style={{ fontFamily: "var(--font-data)", fontSize: 11,
                    color: "var(--muted)", fontWeight: 400, textAlign: "left", padding: "8px 8px 8px 0",
                    letterSpacing: "0.04em", textTransform: "uppercase" }}>{heading}</th>
            ))}
            {[columns.duration, columns.amount].map((c, i) => (
              <th key={i} scope="col" data-std-fact={fact(`columns.${i === 0 ? "duration" : "amount"}`)} style={{ fontFamily: "var(--font-data)", fontSize: 11,
                                               color: "var(--muted)", fontWeight: 400, textAlign: "right",
                                               padding: i === 0 ? "8px 8px 8px 0" : "8px 0 8px 8px",
                                               letterSpacing: "0.04em", textTransform: "uppercase" }}>{c}</th>
            ))}
          </tr>
          <tr className="instrument-schedule-header-rule" aria-hidden="true">
            <td colSpan={4} />
          </tr>
        </thead>
        <tbody>
          {lines.map((l, index) => (
            <tr key={`${l.ref}-${index}`}>
              <th scope="row" data-std-fact={fact(`lines.${index}.ref`)} style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--muted)",
                           fontWeight: 400, textAlign: "left", padding: "16px 8px 16px 0", borderTop: index === 0 ? undefined : "1px solid var(--rule)", verticalAlign: "top" }}>{l.ref}</th>
              <td style={{ fontSize: 15, padding: "16px 8px 16px 0", borderTop: index === 0 ? undefined : "1px solid var(--rule)", verticalAlign: "top" }}>
                <span data-std-fact={fact(`lines.${index}.description`)}>{l.description}</span>
                {l.standard && (
                  <div data-std-fact={fact(`lines.${index}.standard`)} style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--muted)", marginTop: 8 }}>{l.standard}</div>
                )}
              </td>
              <td data-std-fact={fact(`lines.${index}.duration`)} style={{ fontFamily: "var(--font-data)", fontSize: 14, textAlign: "right",
                           padding: "16px 8px 16px 0", borderTop: index === 0 ? undefined : "1px solid var(--rule)", verticalAlign: "top" }}>{l.duration}</td>
              <td data-std-fact={fact(`lines.${index}.amount`)} style={{ fontFamily: "var(--font-data)", fontSize: 14, textAlign: "right",
                           padding: "16px 0 16px 8px", borderTop: index === 0 ? undefined : "1px solid var(--rule)", verticalAlign: "top" }}>{l.amount}</td>
            </tr>
          ))}
        </tbody>
        {total && (
          <tfoot>
            <tr>
              <th scope="row" data-std-fact={fact("total.label")} colSpan={2} style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 500, textAlign: "left",
                                       padding: "16px 0", borderTop: "2px solid var(--ink)" }}>{total.label}</th>
              <td data-std-fact={fact("total.duration")} style={{ fontFamily: "var(--font-data)", fontSize: 15, textAlign: "right",
                           padding: "16px 8px 16px 0", borderTop: "2px solid var(--ink)" }}>{total.duration}</td>
              <td data-std-fact={fact("total.amount")} style={{ fontFamily: "var(--font-data)", fontSize: 15, textAlign: "right",
                           padding: "16px 0 16px 8px", borderTop: "2px solid var(--ink)" }}>{total.amount}</td>
            </tr>
          </tfoot>
        )}
      </table>
      {note && <div data-std-fact={fact("note")}><Note>{note}</Note></div>}
    </section>
    );
  },
  META["Schedule"]
);
