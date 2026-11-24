/**
 * The export file format (DECISIONS 2, 14). Documented for people in
 * docs/EXPORT_FORMAT.md: keep the two in step.
 *
 * A .zip holding:
 *   data.json            ExportData (below)
 *   media/<id>.<ext>     one file per photo or voice note
 */

import type { TableName } from './db';

export const EXPORT_FORMAT = 'mep-export';
/** Bump only when the file's layout changes, not for new tables or fields. */
export const EXPORT_FORMAT_VERSION = 1;

export const DATA_FILE = 'data.json';
export const MEDIA_FOLDER = 'media/';

/** A media row as written to data.json: the Blob is replaced by its file path. */
export interface ExportedMedia {
  id: string;
  createdAt: string;
  updatedAt: string;
  type: string;
  file: string;
}

export interface ExportData {
  format: typeof EXPORT_FORMAT;
  formatVersion: typeof EXPORT_FORMAT_VERSION;
  /** The database schema version the rows follow. */
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  /** Every table, by name, as an array of its rows. */
  tables: Record<TableName, unknown[]>;
}

/** File extensions for the media types phones produce. */
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
};

export function mediaFileName(id: string, type: string): string {
  const extension = EXTENSIONS[type.split(';')[0]?.trim() ?? ''] ?? 'bin';
  return `${MEDIA_FOLDER}${id}.${extension}`;
}

/** "mep-export-2026-11-24.zip", using the local date. */
export function exportFileName(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `mep-export-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.zip`;
}
