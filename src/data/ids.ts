/**
 * Ids and timestamps for every stored row (DECISIONS 28).
 *
 * Ids are random UUID strings, so rows made on different devices, or brought
 * in by import or sharing, never clash.
 */

export type Id = string;

/**
 * A new random id. crypto.randomUUID() only exists in a secure context:
 * https, localhost, or the installed app. A phone opening the dev server over
 * plain http://192.168.x.x has no secure context, so fail with a clear message
 * rather than make weaker ids.
 */
export function newId(): Id {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error(
      'crypto.randomUUID() is unavailable: open Mep over https (see README → Testing on a phone).',
    );
  }
  return crypto.randomUUID();
}

/** Now, as an ISO 8601 timestamp in UTC: "2026-11-24T18:30:00.000Z". */
export function nowTimestamp(): string {
  return new Date().toISOString();
}
