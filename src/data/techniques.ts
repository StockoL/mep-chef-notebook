/**
 * Techniques and method templates (SPEC → Techniques; T1–T3; DECISIONS 49).
 *
 * A technique is the chef's own entry: names and aliases (shipped), and their
 * notes, common mistakes, variants by context ("quenelle: smooth mixes /
 * textured mixes"), photos or video, kitchen-specific notes, and any method
 * templates. Links from steps and prep notes aren't stored: they're found by
 * name when shown (src/core/techniques/mentions.ts), so "used in" is always
 * up to date.
 */

import { normalizeName } from '../core/ingredients/names';
import { cleanName } from '../core/lists/lists';
import { mentionedIds } from '../core/techniques/mentions';
import { db as appDb, type MepDatabase } from './db';
import { saveSteps } from './library';
import { ListError } from './lists';
import type { Snapshot } from './snapshot';
import type { StatusChange } from './steps';
import type { Component, Id, KitchenId, MethodTemplate, Note, Technique, TechniqueKitchenNote, TechniqueVariant } from './types';

// ─── Techniques ───────────────────────────────────────────────────────────

export function listTechniques(database: MepDatabase = appDb): Promise<Technique[]> {
  return database.techniques.orderBy('name').toArray();
}

export function getTechnique(id: Id, database: MepDatabase = appDb) {
  return database.techniques.get(id);
}

/** Whether the chef has written anything of their own: shown filled, not outlined (UX → Library). */
export function hasOwnNotes(technique: Technique): boolean {
  return Boolean(technique.notes.trim() || technique.mistakes.trim() || technique.mediaIds.length);
}

export async function createTechnique(name: string, database: MepDatabase = appDb): Promise<Id> {
  const cleaned = cleanName(name);
  if (!cleaned) throw new ListError('Give the technique a name.');
  const all = await database.techniques.toArray();
  const same = all.find((t) => [t.name, ...t.aliases].some((n) => normalizeName(n) === normalizeName(cleaned)));
  if (same) return same.id;
  return database.techniques.add({ name: cleaned.charAt(0).toUpperCase() + cleaned.slice(1), aliases: [], categoryId: null, notes: '', mistakes: '', mediaIds: [] });
}

export async function updateTechnique(
  id: Id,
  changes: Partial<Pick<Technique, 'name' | 'aliases' | 'categoryId' | 'notes' | 'mistakes'>>,
  database: MepDatabase = appDb,
) {
  if (changes.name !== undefined) {
    const name = cleanName(changes.name);
    if (!name) throw new ListError('Give the technique a name.');
    changes = { ...changes, name };
  }
  await database.techniques.update(id, changes);
}

/** Deletes a technique with its variants, kitchen notes and templates; its notes go back to the inbox. Returns a snapshot for Undo. */
export async function deleteTechnique(id: Id, database: MepDatabase = appDb): Promise<Snapshot> {
  return database.transaction('rw', [database.techniques, database.techniqueVariants, database.techniqueKitchenNotes, database.methodTemplates, database.notes, database.media], async () => {
    const technique = await database.techniques.get(id);
    const variants = await database.techniqueVariants.where('techniqueId').equals(id).toArray();
    const kitchenNotes = await database.techniqueKitchenNotes.where('techniqueId').equals(id).toArray();
    const templates = await database.methodTemplates.where('techniqueId').equals(id).toArray();
    const notes = await database.notes.filter((n) => n.links.some((l) => l.kind === 'technique' && l.id === id)).toArray();
    const media = technique ? (await database.media.bulkGet(technique.mediaIds)).filter((m) => m !== undefined) : [];
    await database.techniques.delete(id);
    await database.techniqueVariants.bulkDelete(variants.map((v) => v.id));
    await database.techniqueKitchenNotes.bulkDelete(kitchenNotes.map((k) => k.id));
    await database.methodTemplates.bulkDelete(templates.map((t) => t.id));
    await database.media.bulkDelete(media.map((m) => m.id));
    for (const note of notes) {
      const links = note.links.filter((l) => !(l.kind === 'technique' && l.id === id));
      await database.notes.update(note.id, { links, kind: links.length ? note.kind : 'inbox' });
    }
    return {
      techniques: technique ? [technique] : [],
      techniqueVariants: variants,
      techniqueKitchenNotes: kitchenNotes,
      methodTemplates: templates,
      notes,
      media,
    };
  });
}

// ─── One technique ────────────────────────────────────────────────────────

export interface TechniqueDetails {
  technique: Technique;
  variants: TechniqueVariant[];
  /** This kitchen's note ("three-sided quenelles here", T2), if any. */
  kitchenNote: TechniqueKitchenNote | undefined;
  templates: MethodTemplate[];
  /** Notes sorted into it from the inbox, newest first. */
  notes: Note[];
  /** Components whose recipe mentions it in a step or a prep note. */
  usedIn: Component[];
}

export async function getTechniqueDetails(id: Id, kitchenId: KitchenId, database: MepDatabase = appDb): Promise<TechniqueDetails | undefined> {
  const technique = await database.techniques.get(id);
  if (!technique) return undefined;
  const [variants, kitchenNotes, templates, notes] = await Promise.all([
    database.techniqueVariants.where('techniqueId').equals(id).sortBy('createdAt'),
    database.techniqueKitchenNotes.where('techniqueId').equals(id).toArray(),
    database.methodTemplates.where('techniqueId').equals(id).sortBy('createdAt'),
    database.notes.filter((n) => n.links.some((l) => l.kind === 'technique' && l.id === id)).toArray(),
  ]);
  return {
    technique,
    variants,
    kitchenNote: kitchenNotes.find((k) => k.kitchenId === kitchenId),
    templates,
    notes: notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    usedIn: await techniqueUsedIn(id, database),
  };
}

/** Variants by context (T1): "smooth mixes", "textured mixes". */
export async function addVariant(techniqueId: Id, context: string, database: MepDatabase = appDb): Promise<Id> {
  const cleaned = cleanName(context);
  if (!cleaned) throw new ListError('Say when this way is used: “textured mixes”.');
  return database.techniqueVariants.add({ techniqueId, context: cleaned, notes: '' });
}

export async function updateVariant(id: Id, changes: Partial<Pick<TechniqueVariant, 'context' | 'notes'>>, database: MepDatabase = appDb) {
  await database.techniqueVariants.update(id, changes);
}

export async function deleteVariant(id: Id, database: MepDatabase = appDb): Promise<TechniqueVariant | undefined> {
  const variant = await database.techniqueVariants.get(id);
  await database.techniqueVariants.delete(id);
  return variant;
}

/** This kitchen's note on a technique (T2); empty text removes it. */
export async function setKitchenNote(techniqueId: Id, kitchenId: KitchenId, notes: string, database: MepDatabase = appDb) {
  const existing = await database.techniqueKitchenNotes.where('techniqueId').equals(techniqueId).filter((k) => k.kitchenId === kitchenId).first();
  if (!notes.trim()) {
    if (existing) await database.techniqueKitchenNotes.delete(existing.id);
  } else if (existing) await database.techniqueKitchenNotes.update(existing.id, { notes });
  else await database.techniqueKitchenNotes.add({ techniqueId, kitchenId, notes });
}

/** A photo or video of the technique. */
export async function addTechniqueMedia(techniqueId: Id, blob: Blob, database: MepDatabase = appDb) {
  await database.transaction('rw', database.techniques, database.media, async () => {
    const technique = await database.techniques.get(techniqueId);
    if (!technique) return;
    const mediaId = await database.media.add({ blob, type: blob.type || 'application/octet-stream' });
    await database.techniques.update(techniqueId, { mediaIds: [...technique.mediaIds, mediaId] });
  });
}

export async function removeTechniqueMedia(techniqueId: Id, mediaId: Id, database: MepDatabase = appDb) {
  await database.transaction('rw', database.techniques, database.media, async () => {
    const technique = await database.techniques.get(techniqueId);
    if (!technique) return;
    await database.techniques.update(techniqueId, { mediaIds: technique.mediaIds.filter((id) => id !== mediaId) });
    await database.media.delete(mediaId);
  });
}

/** Sorts an inbox note into a technique (keeping its photo or voice note). */
export async function sortToTechnique(noteId: Id, techniqueId: Id, database: MepDatabase = appDb) {
  const note = await database.notes.get(noteId);
  if (!note) return;
  await database.notes.update(noteId, { kind: 'attempt', links: [...note.links, { kind: 'technique', id: techniqueId }] });
}

// ─── Where it's used ──────────────────────────────────────────────────────

/** The text of each component's current recipes: steps and prep notes, with the lines' ingredient ids. */
async function recipeTexts(database: MepDatabase) {
  const [components, variations] = await Promise.all([database.components.toArray(), database.variations.toArray()]);
  const result: { component: Component; texts: string[]; lines: { ingredientId: Id | null; prepNote: string }[]; steps: string[] }[] = [];
  for (const component of components) {
    const versionIds = variations.filter((v) => v.componentId === component.id && v.currentVersionId).map((v) => v.currentVersionId!);
    const lines = await database.lines.where('versionId').anyOf(versionIds).toArray();
    const steps = (await database.steps.where('versionId').anyOf(versionIds).toArray()).map((s) => s.text);
    result.push({ component, texts: [...steps, ...lines.map((l) => l.prepNote)], lines, steps });
  }
  return result;
}

/** Components whose recipe mentions a technique (automatic "used in"). */
export async function techniqueUsedIn(techniqueId: Id, database: MepDatabase = appDb): Promise<Component[]> {
  const technique = await database.techniques.get(techniqueId);
  if (!technique) return [];
  const recipes = await recipeTexts(database);
  return recipes
    .filter(({ texts }) => texts.some((text) => mentionedIds(text, [technique]).length > 0))
    .map((r) => r.component)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface TechniqueApplied {
  technique: Technique;
  /** Where: "Celeriac remoulade". */
  components: Component[];
}

/**
 * Techniques applied to an ingredient (SPEC → Ingredients: "celeriac,
 * julienne"): from its lines' prep notes, and from steps that name both
 * the ingredient and the technique.
 */
export async function techniquesForIngredient(ingredientId: Id, database: MepDatabase = appDb): Promise<TechniqueApplied[]> {
  const ingredient = await database.ingredients.get(ingredientId);
  if (!ingredient) return [];
  const techniques = await database.techniques.toArray();
  const names = [ingredient.name, ...ingredient.aliases].map(normalizeName).filter((n) => n.length > 2);
  const mentionsIngredient = (text: string) => {
    const words = ` ${normalizeName(text)} `;
    return names.some((n) => words.includes(` ${n} `) || words.includes(` ${n}s `));
  };
  const found = new Map<Id, Set<Component>>();
  for (const { component, lines, steps } of await recipeTexts(database)) {
    const texts = [
      ...lines.filter((l) => l.ingredientId === ingredientId).map((l) => l.prepNote),
      ...(lines.some((l) => l.ingredientId === ingredientId) ? steps.filter(mentionsIngredient) : []),
    ];
    for (const id of texts.flatMap((t) => mentionedIds(t, techniques))) found.set(id, (found.get(id) ?? new Set()).add(component));
  }
  return techniques
    .filter((t) => found.has(t.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((technique) => ({ technique, components: [...found.get(technique.id)!].sort((a, b) => a.name.localeCompare(b.name)) }));
}

// ─── Method templates (T3) ────────────────────────────────────────────────

export interface TemplateSummary {
  template: MethodTemplate;
  techniqueName: string;
  /** Its technique is named in the component's name: "Brown chicken stock" → Brown stock. */
  suggested: boolean;
}

/** Every template, the ones that match the component's name first. */
export async function listTemplates(componentName = '', database: MepDatabase = appDb): Promise<TemplateSummary[]> {
  const [templates, techniques] = await Promise.all([database.methodTemplates.toArray(), database.techniques.toArray()]);
  const name = ` ${normalizeName(componentName)} `;
  return templates
    .map((template) => {
      const technique = techniques.find((t) => t.id === template.techniqueId);
      const words = technique ? [technique.name, ...technique.aliases].map(normalizeName) : [];
      const suggested = words.some((w) => w && (name.includes(` ${w} `) || w.split(' ').every((part) => name.includes(` ${part} `))));
      return { template, techniqueName: technique?.name ?? 'Template', suggested };
    })
    .sort((a, b) => Number(b.suggested) - Number(a.suggested) || a.techniqueName.localeCompare(b.techniqueName));
}

/**
 * Adds a template's steps to the end of a variation's method (T3), read by
 * the step reader like anything typed. Returns the status change.
 */
export async function applyTemplate(variationId: Id, templateId: Id, database: MepDatabase = appDb): Promise<StatusChange | null> {
  const template = await database.methodTemplates.get(templateId);
  const variation = await database.variations.get(variationId);
  if (!template || !variation) return null;
  const existing = variation.currentVersionId ? (await database.steps.where('versionId').equals(variation.currentVersionId).sortBy('order')).map((s) => s.text) : [];
  return saveSteps(variationId, [...existing, ...template.steps.map((s) => s.text)], database);
}

/** Saves a variation's method as a template for a technique (made if new). Returns the template's id. */
export async function saveAsTemplate(variationId: Id, technique: { id: Id } | { name: string }, database: MepDatabase = appDb): Promise<Id> {
  const variation = await database.variations.get(variationId);
  const steps = variation?.currentVersionId ? await database.steps.where('versionId').equals(variation.currentVersionId).sortBy('order') : [];
  if (steps.length === 0) throw new ListError('There’s no method to save yet.');
  const techniqueId = 'id' in technique ? technique.id : await createTechnique(technique.name, database);
  return database.methodTemplates.add({ techniqueId, steps: steps.map((s) => ({ text: s.text, parts: [] })) });
}

/** A template's steps, one per line, as edited on the technique page. */
export async function updateTemplateSteps(templateId: Id, lines: string[], database: MepDatabase = appDb) {
  await database.methodTemplates.update(templateId, { steps: lines.map((l) => l.trim()).filter(Boolean).map((text) => ({ text, parts: [] })) });
}

export async function deleteTemplate(id: Id, database: MepDatabase = appDb): Promise<MethodTemplate | undefined> {
  const template = await database.methodTemplates.get(id);
  await database.methodTemplates.delete(id);
  return template;
}
