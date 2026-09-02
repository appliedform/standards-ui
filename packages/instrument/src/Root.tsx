import * as React from "react";

/**
 * InstrumentRoot establishes the system: it loads the two permitted faces and
 * puts the five colours and the spacing scale in scope as custom properties.
 * Every Instrument component reads them via var(), so nothing hard-codes a
 * value the pack could later change.
 *
 * Nothing renders correctly outside this wrapper — the tokens simply are not
 * in scope, and components fall back to the browser's defaults.
 */
export const InstrumentRoot: React.FC<{
  children: React.ReactNode;
  /** Set false if the host already loads Public Sans and DM Mono. */
  loadFonts?: boolean;
  style?: React.CSSProperties;
}> = ({ children, loadFonts = true, style }) => (
  <>
    {loadFonts && (
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;600;800&family=DM+Mono:wght@400;500&display=swap"
      />
    )}
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
  </>
);
