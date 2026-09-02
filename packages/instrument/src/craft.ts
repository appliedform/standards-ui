/**
 * The craft layer: the typographic decisions that make Instrument look set
 * rather than styled. Components use these rather than literal numbers, so the
 * rules hold everywhere — including in anything a design agent composes from
 * these parts.
 */

/** The base unit. Every spacing value in the system is a multiple of it. */
export const UNIT = 8;

/** The permitted spacing scale. Nothing off it. */
export const SPACE = [8, 16, 24, 32, 48, 64, 96] as const;
export type Space = (typeof SPACE)[number];

/**
 * Baseline-locked leading, always a multiple of the base unit and never tighter
 * than the glyphs. The ratio tapers with size: 1.25 reads well for text, but at
 * display sizes that is wasteful — and anything under about 1.05 clips
 * ascenders and descenders rather than setting type tightly.
 */
export function leading(px: number): number {
  const ratio = px < 24 ? 1.25 : px < 60 ? 1.15 : 1.08;
  return Math.max(UNIT * Math.ceil((px * ratio) / UNIT), UNIT);
}

/** Tracking curve. Large type needs less letter space; small caps need more. */
export function tracking(px: number): string {
  if (px >= 96) return "-0.035em";
  if (px >= 48) return "-0.025em";
  if (px >= 24) return "-0.015em";
  if (px >= 17) return "-0.005em";
  return "0";
}

/** A complete, baseline-locked type style for a given size. */
export function type(px: number, weight: 400 | 600 | 800 = 400): React.CSSProperties {
  return { fontSize: px, lineHeight: `${leading(px)}px`, letterSpacing: tracking(px), fontWeight: weight };
}

/** Small caps, set as tracked uppercase — the face has no true small caps. */
export const smallCaps: React.CSSProperties = {
  fontSize: 10,
  lineHeight: "16px",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

/** Every numeral tabular, so columns of figures align on the decimal. */
export const data: React.CSSProperties = {
  fontFamily: "var(--font-data)",
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: "'tnum' 1",
};

const NNBSP = " "; // narrow no-break space
const MINUS = "−"; // true minus, not a hyphen
const ENDASH = "–";

/**
 * Bind a figure to its unit so the pair can never break across a line, and set
 * negatives with a true minus. "1,240 MPa" is one word to the line-breaker.
 */
export function fig(value: number | string, unit?: string): string {
  let v = typeof value === "number" ? value.toLocaleString("en-GB") : value;
  v = v.replace(/^-/, MINUS);
  return unit ? `${v}${NNBSP}${unit}` : v;
}

/** A range, set with an en dash and no spaces: 1,181–1,309. */
export function range(from: number | string, to: number | string, unit?: string): string {
  const a = typeof from === "number" ? from.toLocaleString("en-GB") : from;
  const b = typeof to === "number" ? to.toLocaleString("en-GB") : to;
  return fig(`${a}${ENDASH}${b}`, unit);
}

/** A signed delta, with a true minus for negatives. */
export function delta(n: number, unit?: string): string {
  return fig(n > 0 ? `+${n}` : String(n), unit);
}

import type * as React from "react";
