/**
 * The spine every Standards pack shares.
 *
 * Packs differ completely in their moves: two packs will answer the same job
 * with components that have nothing in common. What they share is this: the six-job taxonomy, the token contract shape, and the fact that
 * every move declares which job it serves. Consistency is enforced here, at the
 * contract; divergence is left to the packs, where it belongs.
 */

export const JOBS = {
  E: "Evidence",
  S: "Structure",
  N: "Narrative",
  C: "Change",
  T: "Transaction",
  W: "Wayfinding",
} as const;

export type JobKey = keyof typeof JOBS;
export type JobName = (typeof JOBS)[JobKey];

/** Every pack component carries the job it answers, so the set can be audited. */
export interface MoveMeta {
  /** Single-letter job key, e.g. "E". */
  job: JobKey;
  /** The move's name as the pack's archetypes.json spells it. */
  move: string;
  /** The trigger: when this move is the right one. */
  when: string;
  /** What it buys. */
  why: string;
}

export type MoveComponent<P> = React.FC<P> & { meta: MoveMeta };

/** Attach move metadata to a component so the audit can read it off the export. */
export function defineMove<P>(
  component: React.FC<P>,
  meta: MoveMeta
): MoveComponent<P> {
  const c = component as MoveComponent<P>;
  c.meta = meta;
  c.displayName = meta.move;
  return c;
}

/** The token contract every pack's tokens.json satisfies. */
export interface TokenContract {
  system: string;
  version: string;
  colour: Record<string, { value: string; role: string }>;
  type: Record<string, string>;
  system_values: Record<string, string>;
}

import type * as React from "react";
