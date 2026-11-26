import { strFromU8, unzipSync } from 'fflate';
import { ensureBuiltIns, SCHEMA_VERSION, TABLE_NAMES, db as appDb, type MepDatabase, type TableName } from './db';
import { DATA_FILE, EXPORT_FORMAT, EXPORT_FORMAT_VERSION, type ExportedMedia } from './exportFormat';
import { upgradeRow } from './migrations';
import { fillMissingDishKitchens } from './dishOrigin';
import { readUnreadSteps } from './steps';

/** A problem with the file itself. The message is written for the chef. */
export class ImportError extends Error {
  override name = 'ImportError';
}

/**
 * Replaces everything in the database with the contents of an export .zip.
 * Checks the whole file first; if anything is wrong, nothing is changed.
 * (Phase 0 only replaces. Merging comes later.)
 */
export async function importData(zipBytes: Uint8Array, database: MepDatabase = appDb): Promise<void> {
  const rowsByTable = readExport(zipBytes);

  // One transaction: either everything is replaced, or nothing is.
  await database.transaction('rw', database.tables, async () => {
    for (const name of TABLE_NAMES) {
      const table = database.table(name);
      await table.clear();
      await table.bulkAdd(rowsByTable[name]);
    }
  });

  await ensureBuiltIns(database);
  // An export from before dishes had a kitchen (v8): work it out now.
  await fillMissingDishKitchens(database);
  // An export from before the step reader: read its methods now.
  await readUnreadSteps(database);
}

/** Unzips and checks an export, returning the rows to store, Blobs restored. */
function readExport(zipBytes: Uint8Array): Record<TableName, unknown[]> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zipBytes);
  } catch {
    throw new ImportError("This isn't a Mep export: it couldn't be opened as a .zip file.");
  }

  const dataFile = files[DATA_FILE];
  if (!dataFile) {
    throw new ImportError(`This isn't a Mep export: it has no ${DATA_FILE}.`);
  }

  let data: unknown;
  try {
    data = JSON.parse(strFromU8(dataFile));
  } catch {
    throw new ImportError(`The export's ${DATA_FILE} is damaged and can't be read.`);
  }

  if (!isObject(data) || data.format !== EXPORT_FORMAT) {
    throw new ImportError("This isn't a Mep export.");
  }
  if (data.formatVersion !== EXPORT_FORMAT_VERSION) {
    throw new ImportError('This export was made by a different version of Mep and can\'t be read here.');
  }
  if (typeof data.schemaVersion !== 'number' || data.schemaVersion > SCHEMA_VERSION) {
    throw new ImportError('This export was made by a newer version of Mep. Update the app, then import it.');
  }
  if (!isObject(data.tables)) {
    throw new ImportError('The export has no data in it.');
  }

  const tables = data.tables;
  const fileVersion = data.schemaVersion;
  for (const name of Object.keys(tables)) {
    if (!(TABLE_NAMES as string[]).includes(name)) {
      throw new ImportError(`The export has data Mep doesn't know about ("${name}").`);
    }
  }

  const result = {} as Record<TableName, unknown[]>;
  for (const name of TABLE_NAMES) {
    const rows = tables[name] ?? [];
    if (!Array.isArray(rows)) {
      throw new ImportError(`The export's "${name}" data is damaged.`);
    }
    const keyField = name === 'settings' ? 'key' : 'id';
    for (const row of rows) {
      if (!isObject(row) || typeof row[keyField] !== 'string') {
        throw new ImportError(`The export's "${name}" data has a row without an ${keyField}.`);
      }
    }
    // An export from an older Mep is brought up to date, row by row, the
    // same way the database upgrades itself (migrations.ts).
    const upgraded = rows.map((row) => upgradeRow(name, row as Record<string, unknown>, fileVersion, SCHEMA_VERSION));
    result[name] = name === 'media' ? restoreMedia(upgraded as unknown as ExportedMedia[], files) : upgraded;
  }
  return result;
}

/** Puts each media file back into its row as a Blob. */
function restoreMedia(rows: ExportedMedia[], files: Record<string, Uint8Array>) {
  return rows.map(({ file, ...row }) => {
    const bytes = files[file];
    if (!bytes) {
      throw new ImportError(`The export is missing a photo or voice note (${file}).`);
    }
    return { ...row, blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: row.type }) };
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
