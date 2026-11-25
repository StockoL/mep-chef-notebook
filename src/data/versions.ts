/**
 * Versions (SPEC → Variations and versions; V3; DECISIONS 45).
 *
 * A variation's lines and steps belong to a Version. Editing works on the
 * current version while the chef is still at it; once they've been away for
 * WRITE_SESSION_MINUTES, the next edit starts a new version, copied from the
 * last. So every editing session leaves a version behind, without a version
 * per keystroke. Restoring copies an old version into a new current one, so
 * nothing is ever lost, and a restore can itself be undone.
 *
 * Corrections to the step reader's readings and confirmations change the
 * current version in place: they're readings of the recipe, not the recipe.
 */

import { formatAmount } from '../core/scaling/rounding';
import { db as appDb, type MepDatabase } from './db';
import { nowTimestamp } from './ids';
import { refreshStatus } from './steps';
import type { Id, Line, Step, Variation, Version } from './types';

/** Edits this close together are one session, one version. */
export const WRITE_SESSION_MINUTES = 30;

/**
 * The version to write to: the current one while the session lasts (or while
 * it's still empty), otherwise a new copy of it. Call inside a transaction
 * that includes variations, versions, lines and steps.
 */
export async function versionForEditing(variation: Variation, database: MepDatabase): Promise<Id> {
  if (!variation.currentVersionId) {
    const id = await database.versions.add({ variationId: variation.id, parentId: null, changeNote: null });
    await database.variations.update(variation.id, { currentVersionId: id });
    return id;
  }
  const current = await database.versions.get(variation.currentVersionId);
  if (!current) throw new Error('That version no longer exists.');
  const [lineCount, stepCount] = await Promise.all([
    database.lines.where('versionId').equals(current.id).count(),
    database.steps.where('versionId').equals(current.id).count(),
  ]);
  const minutesAway = (Date.now() - Date.parse(current.updatedAt)) / 60_000;
  if (lineCount + stepCount === 0 || minutesAway < WRITE_SESSION_MINUTES) {
    await database.versions.update(current.id, { updatedAt: nowTimestamp() });
    return current.id;
  }
  const id = await copyVersion(current.id, variation.id, null, database);
  await database.variations.update(variation.id, { currentVersionId: id });
  return id;
}

/** A new version with a copy of another's lines and steps. Returns its id. */
async function copyVersion(fromId: Id, variationId: Id, changeNote: string | null, database: MepDatabase): Promise<Id> {
  const variation = await database.variations.get(variationId);
  const id = await database.versions.add({ variationId, parentId: variation?.currentVersionId ?? fromId, changeNote });
  const lines = await database.lines.where('versionId').equals(fromId).toArray();
  const lineIds = new Map<Id, Id>();
  for (const { id: oldId, createdAt: _c, updatedAt: _u, ...line } of lines) {
    lineIds.set(oldId, await database.lines.add({ ...line, versionId: id }));
  }
  const steps = await database.steps.where('versionId').equals(fromId).toArray();
  for (const { id: _id, createdAt: _c, updatedAt: _u, ...step } of steps) {
    await database.steps.add({
      ...step,
      versionId: id,
      parts: step.parts.map((part) => ({ ...part, scalesWithLineId: part.scalesWithLineId ? (lineIds.get(part.scalesWithLineId) ?? null) : null })),
    });
  }
  return id;
}

// ─── History ──────────────────────────────────────────────────────────────

export interface VersionSummary {
  version: Version;
  isCurrent: boolean;
  /** "Butter 250g → 300g · added salt · method changed", or "First version". */
  changes: string;
}

/** A variation's versions, newest first, each with what changed since the one before. */
export async function listVersions(variationId: Id, database: MepDatabase = appDb): Promise<VersionSummary[]> {
  const variation = await database.variations.get(variationId);
  const versions = (await database.versions.where('variationId').equals(variationId).toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const names = await lineNames(database);
  const contents = new Map<Id, { lines: Line[]; steps: Step[] }>();
  for (const version of versions) {
    contents.set(version.id, {
      lines: await database.lines.where('versionId').equals(version.id).sortBy('order'),
      steps: await database.steps.where('versionId').equals(version.id).sortBy('order'),
    });
  }
  return versions.map((version, index) => {
    const before = versions[index + 1];
    return {
      version,
      isCurrent: version.id === variation?.currentVersionId,
      changes: before ? describeChanges(contents.get(before.id)!, contents.get(version.id)!, names) : 'First version',
    };
  });
}

async function lineNames(database: MepDatabase) {
  const [ingredients, components] = await Promise.all([database.ingredients.toArray(), database.components.toArray()]);
  return new Map([...ingredients, ...components].map((r) => [r.id, r.name]));
}

const lineKey = (line: Line) => line.ingredientId ?? line.componentId ?? line.id;
const amountOf = (line: Line) => (line.quantity !== null ? formatAmount(line.quantity, line.unit ?? 'each') : 'no amount');

function describeChanges(before: { lines: Line[]; steps: Step[] }, after: { lines: Line[]; steps: Step[] }, names: Map<Id, string>): string {
  const changes: string[] = [];
  const name = (line: Line) => names.get(lineKey(line)) ?? 'an ingredient';
  const old = new Map(before.lines.map((l) => [lineKey(l), l]));
  const now = new Map(after.lines.map((l) => [lineKey(l), l]));
  for (const line of after.lines) {
    const previous = old.get(lineKey(line));
    if (!previous) changes.push(`added ${name(line).toLowerCase()}`);
    else if (amountOf(previous) !== amountOf(line)) changes.push(`${name(line)} ${amountOf(previous)} → ${amountOf(line)}`);
  }
  for (const line of before.lines) if (!now.has(lineKey(line))) changes.push(`took out ${name(line).toLowerCase()}`);
  const method = (steps: Step[]) => steps.map((s) => s.text).join('\n');
  if (method(before.steps) !== method(after.steps)) changes.push('method changed');
  if (changes.length === 0) return 'No changes to the recipe';
  const shown = changes.slice(0, 3).join(' · ');
  return changes.length > 3 ? `${shown} · and ${changes.length - 3} more` : shown;
}

export interface VersionContent {
  version: Version;
  lines: { name: string; amount: string; prepNote: string }[];
  steps: string[];
}

/** One version as it was: for looking back before restoring. */
export async function getVersionContent(versionId: Id, database: MepDatabase = appDb): Promise<VersionContent | undefined> {
  const version = await database.versions.get(versionId);
  if (!version) return undefined;
  const names = await lineNames(database);
  const lines = await database.lines.where('versionId').equals(versionId).sortBy('order');
  const steps = await database.steps.where('versionId').equals(versionId).sortBy('order');
  return {
    version,
    lines: lines.map((l) => ({ name: names.get(lineKey(l)) ?? '?', amount: l.quantity !== null ? amountOf(l) : '', prepNote: l.prepNote })),
    steps: steps.map((s) => s.text),
  };
}

/** The chef's own note on a version: what they changed and why. */
export async function setVersionNote(versionId: Id, changeNote: string | null, database: MepDatabase = appDb) {
  await database.versions.update(versionId, { changeNote: changeNote?.trim() || null });
}

/**
 * Makes an old version current again by copying it into a new version (V3).
 * Returns what undo needs.
 */
export async function restoreVersion(variationId: Id, versionId: Id, database: MepDatabase = appDb): Promise<{ previousId: Id; restoredId: Id }> {
  const result = await database.transaction('rw', [database.variations, database.versions, database.lines, database.steps], async () => {
    const variation = await database.variations.get(variationId);
    const old = await database.versions.get(versionId);
    if (!variation?.currentVersionId || !old) throw new Error('That version no longer exists.');
    const previousId = variation.currentVersionId;
    const when = new Date(old.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const restoredId = await copyVersion(versionId, variationId, `Restored the version from ${when}`, database);
    await database.variations.update(variationId, { currentVersionId: restoredId });
    return { previousId, restoredId };
  });
  await refreshStatus(variationId, database);
  return result;
}

/** Undoes a restore: the version before it is current again, and the copy goes. */
export async function undoRestore(variationId: Id, previousId: Id, restoredId: Id, database: MepDatabase = appDb) {
  await database.transaction('rw', [database.variations, database.versions, database.lines, database.steps], async () => {
    await database.variations.update(variationId, { currentVersionId: previousId });
    await database.lines.where('versionId').equals(restoredId).delete();
    await database.steps.where('versionId').equals(restoredId).delete();
    await database.versions.delete(restoredId);
  });
  await refreshStatus(variationId, database);
}
