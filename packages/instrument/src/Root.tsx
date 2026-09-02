import * as React from "react";
import { TOKENS } from "./tokens.generated";

/**
 * InstrumentRoot establishes the system. It puts the five colours, both faces
 * and the spacing scale in scope as custom properties, and loads the two
 * permitted faces.
 *
 * The tokens are injected here rather than left to a stylesheet import. Shipping
 * `dist/styles/tokens.css` and trusting the consumer to remember it is a silent
 * failure mode: nothing in the JS entry references that file, so a consumer who
 * misses it gets every component rendering with unresolved var() — black on
 * white, no faces, no scale — with no error to explain why.
 */
export const InstrumentRoot: React.FC<{
  children: React.ReactNode;
  /** Set false if the host already loads Public Sans and DM Mono. */
  loadFonts?: boolean;
  /** Set false only if you are supplying the tokens yourself. */
  injectTokens?: boolean;
  style?: React.CSSProperties;
}> = ({ children, loadFonts = true, injectTokens = true, style }) => (
  <>
    {loadFonts && (
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;600;800&family=DM+Mono:wght@400;500&display=swap"
      />
    )}
    {injectTokens && (
      <style
        // Scoped to the root element so two packs can coexist on one page.
        dangerouslySetInnerHTML={{ __html: `[data-standards-pack="instrument"]{${TOKENS}}` }}
      />
    )}
    <div
      data-standards-pack="instrument"
      style={{
        background: "var(--ground)",
        color: "var(--ink)",
        fontFamily: "var(--font-text)",
        fontSize: 15,
        lineHeight: "24px",
        fontFeatureSettings: "'kern' 1, 'liga' 1",
        ...style,
      }}
    >
      {children}
    </div>
  </>
);
