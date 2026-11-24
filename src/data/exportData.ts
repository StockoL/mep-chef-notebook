import { strToU8, zipSync, type Zippable } from 'fflate';
import { SCHEMA_VERSION, TABLE_NAMES, db as appDb, type MepDatabase, type TableName } from './db';
import {
  DATA_FILE,
  EXPORT_FORMAT,
  EXPORT_FORMAT_VERSION,
  mediaFileName,
  type ExportData,
  type ExportedMedia,
} from './exportFormat';
import { nowTimestamp } from './ids';
import type { Media } from './types';

/**
 * Exports everything to a .zip (as bytes). The caller turns it into a file
 * to save or share.
 */
export async function exportData(database: MepDatabase = appDb): Promise<Uint8Array> {
  // Read every table in one transaction, so the export is a consistent
  // snapshot even if something is saved at the same moment.
  const tables = {} as Record<TableName, unknown[]>;
  await database.transaction('r', database.tables, async () => {
    for (const name of TABLE_NAMES) {
      tables[name] = await database.table(name).toArray();
    }
  });

  // Media: the Blob goes into its own file; data.json keeps the path.
  // (Done after the transaction: IndexedDB closes a transaction as soon as
  // it's left waiting on anything that isn't the database.)
  const files: Zippable = {};
  const mediaRows = tables.media as Media[];
  const exportedMedia: ExportedMedia[] = [];
  for (const media of mediaRows) {
    const file = mediaFileName(media.id, media.type);
    const bytes = new Uint8Array(await media.blob.arrayBuffer());
    files[file] = [bytes, { level: 0 }]; // photos and audio are already compressed
    exportedMedia.push({
      id: media.id,
      createdAt: media.createdAt,
      updatedAt: media.updatedAt,
      type: media.type,
      file,
    });
  }
  tables.media = exportedMedia;

  const data: ExportData = {
    format: EXPORT_FORMAT,
    formatVersion: EXPORT_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowTimestamp(),
    appVersion: __APP_VERSION__,
    tables,
  };
  files[DATA_FILE] = strToU8(JSON.stringify(data, null, 2));

  return zipSync(files);
}
