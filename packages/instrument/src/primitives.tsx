import * as React from "react";

/** Uppercase mono label. Labels are data, so they take the data face. */
export const Label: React.FC<{ children: React.ReactNode; factId?: string; id?: string }> = ({ children, factId, id }) => (
  <div
    id={id}
    data-std-fact={factId}
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
export const Note: React.FC<{ children: React.ReactNode; factId?: string }> = ({ children, factId }) => (
  <p data-std-fact={factId} style={{ margin: 0, fontSize: 14, color: "var(--muted)", maxWidth: "62ch" }}>
    {children}
  </p>
);

/** A figure and its unit. Every numeral is mono, without exception. */
export const Figure: React.FC<{
  value: string;
  unit?: string;
  size?: number;
  valueFactId?: string;
  unitFactId?: string;
}> = ({ value, unit, size = 40, valueFactId, unitFactId }) => (
  <div
    style={{
      fontFamily: "var(--font-data)",
      fontSize: size > 40 ? `clamp(40px, 12vw, ${size}px)` : size,
      lineHeight: 1,
      fontWeight: 500,
      letterSpacing: size > 64 ? "-0.02em" : undefined,
      maxWidth: "100%",
      display: "flex",
      flexWrap: "wrap",
      alignItems: "baseline",
      columnGap: 16,
    }}
  >
    <span data-std-fact={valueFactId} style={{ minWidth: 0, overflowWrap: "anywhere" }}>{value}</span>
    {unit && (
      <span data-std-fact={unitFactId} style={{ fontSize: size > 40
        ? `clamp(16px, 4vw, ${Math.round(size / 3)}px)` : Math.round(size / 3),
        color: "var(--muted)", whiteSpace: "nowrap" }}>
        {unit}
      </span>
    )}
  </div>
);
