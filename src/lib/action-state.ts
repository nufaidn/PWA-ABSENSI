/**
 * Shared Server Action state shape.
 *
 * This lives outside any `"use server"` module on purpose: a `"use server"` file
 * may only export async functions, so a plain constant or type re-exported from
 * one is rejected at build time.
 */
export interface ActionState {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** Neutral initial state for `useActionState`. */
export const INITIAL_ACTION_STATE: ActionState = { ok: false };