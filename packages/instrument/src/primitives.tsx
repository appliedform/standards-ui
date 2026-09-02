import * as React from "react";
import { smallCaps, data, type as typeStyle } from "./craft";

/** Uppercase mono label. Labels are data, so they take the data face. */
export const Label: React.FC<{ children: React.ReactNode; tone?: "muted" | "signal" | "inverse" }> = ({
  children,
  tone = "muted",
}) => (
  <div
    style={{
      ...data,
      ...smallCaps,
      color: tone === "signal" ? "var(--signal)" : tone === "inverse" ? "#FFFFFF" : "var(--muted)",
    }}
  >
    {children}
  </div>
);

/**
 * Running prose. Never the data face, never past the 66ch measure, and set with
 * hanging punctuation so a quoted opening does not indent the left edge.
 */
export const Note: React.FC<{ children: React.ReactNode; hang?: boolean }> = ({ children, hang = true }) => (
  <p
    style={{
      margin: 0,
      ...typeStyle(15),
      color: "var(--muted)",
      maxWidth: "62ch",
      textWrap: "pretty",
      textIndent: hang ? "-0.42em" : undefined,
    }}
  >
    {children}
  </p>
);

/**
 * A figure and its unit. Pass the unit separately rather than in the string:
 * the pair is joined with a narrow no-break space so it can never split across
 * a line, and negatives are set with a true minus.
 */
export const Figure: React.FC<{
  value: string;
  unit?: string;
  size?: number;
  tone?: "ink" | "signal" | "inverse";
}> = ({ value, unit, size = 40, tone = "ink" }) => (
  <div
    style={{
      ...data,
      ...typeStyle(size, 500 as 400),
      color: tone === "signal" ? "var(--signal)" : tone === "inverse" ? "#FFFFFF" : "var(--ink)",
    }}
  >
    {value}
    {unit && (
      <span style={{ fontSize: Math.round(size / 3), color: "var(--muted)" }}>
        {" "}
        {unit}
      </span>
    )}
  </div>
);
