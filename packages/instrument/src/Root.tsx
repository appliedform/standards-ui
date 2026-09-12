import * as React from "react";

/**
 * InstrumentRoot establishes the system boundary. The token stylesheet puts
 * the five colours and spacing scale on this exact data attribute, so host
 * roots, sibling packs and nested applications do not inherit global values.
 * Every Instrument component reads them via var(), so nothing hard-codes a
 * value the pack could later change.
 *
 * Nothing renders correctly outside this wrapper — the tokens simply are not
 * in scope, and components fall back to the browser's defaults.
 */
export const InstrumentRoot: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    data-standards-pack="instrument"
    style={{
      background: "var(--ground)",
      color: "var(--ink)",
      fontFamily: "var(--font-text)",
      fontSize: 15,
      lineHeight: 1.5,
      ...style,
    }}
  >
    {children}
  </div>
);
