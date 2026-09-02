import * as React from "react";

/**
 * The invariant mark. A solid ink band, four base units deep, full measure,
 * title reversed at 100% white. It appears on every artefact — this is the
 * one element Instrument never varies, which is why it is not configurable
 * beyond its content and the 1:1 exception.
 */
export const Band: React.FC<{
  title: string;
  /** Right-hand slot: identifier, job code, folio. Rendered in mono. */
  meta?: string;
  /** On a 1:1 format the band drops to three units. */
  square?: boolean;
}> = ({ title, meta, square = false }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: square ? 24 : 32,
      background: "var(--ink)",
      padding: "0 16px",
    }}
  >
    <span style={{ color: "#FFFFFF", fontSize: 13, fontWeight: 600 }}>{title}</span>
    {meta && (
      <span
        style={{
          color: "#FFFFFF",
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.04em",
        }}
      >
        {meta}
      </span>
    )}
  </div>
);
