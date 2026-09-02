import * as React from "react";

/** Uppercase mono label. Labels are data, so they take the data face. */
export const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontFamily: "var(--font-data)",
      fontSize: 11,
      color: "var(--muted)",
      letterSpacing: "0.06em",
      textTransform: "uppercase",
    }}
  >
    {children}
  </div>
);

/** Running prose. Never the data face; never past the 66ch measure. */
export const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", maxWidth: "62ch" }}>
    {children}
  </p>
);

/** A figure and its unit. Every numeral is mono, without exception. */
export const Figure: React.FC<{
  value: string;
  unit?: string;
  size?: number;
}> = ({ value, unit, size = 40 }) => (
  <div
    style={{
      fontFamily: "var(--font-data)",
      fontSize: size,
      lineHeight: 1,
      fontWeight: 500,
      letterSpacing: size > 64 ? "-0.02em" : undefined,
    }}
  >
    {value}
    {unit && (
      <span style={{ fontSize: Math.round(size / 3), color: "var(--muted)", marginLeft: 16 }}>
        {unit}
      </span>
    )}
  </div>
);
