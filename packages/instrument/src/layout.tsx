import * as React from "react";
import { Band } from "./Band";
import type { Space } from "./craft";

/**
 * Composition primitives. Without these a consumer has to reconstruct the
 * twelve-column grid, the 24px gutter and the 8px scale from the documentation
 * every time — and will not, reliably. Shipping them makes the system's
 * geometry the path of least resistance rather than an act of discipline.
 */

/**
 * A sheet: the artefact itself. It carries the invariant band at the top and
 * pads its contents on the scale. Every Instrument artefact is a Sheet.
 */
export const Sheet: React.FC<{
  title: string;
  meta?: string;
  /** 1:1 formats take the three-unit band; everything else takes four. */
  square?: boolean;
  /** Padding for the body, from the permitted scale. */
  pad?: Space;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ title, meta, square = false, pad = 32, children, style }) => (
  <div style={{ background: "var(--ground)", display: "flex", flexDirection: "column", ...style }}>
    <Band title={title} meta={meta} square={square} />
    <div style={{ padding: pad, display: "flex", flexDirection: "column", gap: pad, flexGrow: 1 }}>
      {children}
    </div>
  </div>
);

/**
 * The twelve-column grid, at the system's 24px gutter. Children declare their
 * span; anything that does not fit twelve is the caller's error, not the grid's.
 */
export const Grid: React.FC<{
  children: React.ReactNode;
  columns?: number;
  gap?: Space;
  style?: React.CSSProperties;
}> = ({ children, columns = 12, gap = 24, style }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap,
      ...style,
    }}
  >
    {children}
  </div>
);

/** A cell spanning `span` of the grid's columns. */
export const Cell: React.FC<{
  span: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ span, children, style }) => (
  <div style={{ gridColumn: `span ${span}`, minWidth: 0, ...style }}>{children}</div>
);

/** Vertical flow. The gap comes from the scale — there is no other option. */
export const Stack: React.FC<{
  children: React.ReactNode;
  gap?: Space;
  style?: React.CSSProperties;
}> = ({ children, gap = 16, style }) => (
  <div style={{ display: "flex", flexDirection: "column", gap, ...style }}>{children}</div>
);

/** Horizontal flow, baseline-aligned by default so figures line up. */
export const Row: React.FC<{
  children: React.ReactNode;
  gap?: Space;
  align?: React.CSSProperties["alignItems"];
  style?: React.CSSProperties;
}> = ({ children, gap = 16, align = "baseline", style }) => (
  <div style={{ display: "flex", gap, alignItems: align, ...style }}>{children}</div>
);

/**
 * A full-bleed ink field. The band is the mark; this is the same ink used as
 * composition — for a datum that must dominate, or a statement that must be
 * declared rather than introduced.
 */
export const Field: React.FC<{
  children: React.ReactNode;
  pad?: Space;
  style?: React.CSSProperties;
}> = ({ children, pad = 64, style }) => (
  <div style={{ background: "var(--ink)", color: "#FFFFFF", padding: pad, ...style }}>{children}</div>
);
