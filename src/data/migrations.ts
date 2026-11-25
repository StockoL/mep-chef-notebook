/**
 * How stored rows change between schema versions. Used in two places, so
 * old data is upgraded the same way however it arrives:
 * - the database upgrade (db.ts → this.version(n).upgrade), for data already
 *   on the phone;
 * - import (importData.ts), for an export file made by an older version.
 *
 * Each fix edits a row in place and must be safe to run twice.
 * NEVER change a released version's fixes; add a new version instead.
 */

import type { TableName } from './db';

type Row = Record<string, unknown>;
type RowFix = (row: Row) => void;

export const ROW_FIXES: Record<number, Partial<Record<TableName, RowFix>>> = {
  /** Schema v2 (Phase 1): usual section, merging, services hold a list of time windows. */
  2: {
    kitchens: (row) => {
      row.usualSectionId ??= null;
    },
    sections: (row) => {
      row.mergedIntoId ??= null;
    },
    services: (row) => {
      if (!Array.isArray(row.windows)) {
        // v1 stored one window's fields on the service itself.
        const hadTimes = row.firstTickets != null || row.lastBookings != null;
        row.windows = hadTimes
          ? [
              {
                days: row.days ?? [],
                firstTickets: row.firstTickets ?? null,
                lastBookings: row.lastBookings ?? null,
                usualFinish: row.usualFinish ?? null,
              },
            ]
          : [];
        delete row.days;
        delete row.firstTickets;
        delete row.lastBookings;
        delete row.usualFinish;
      }
      row.order ??= 0;
      row.hidden ??= false;
      row.mergedIntoId ??= null;
    },
  },
  /** Schema v3 (Phase 3): a sheet can keep the photo it was entered from. */
  3: {
    sheets: (row) => {
      row.photoId ??= null;
    },
  },
};

/** Brings one row from `fromVersion` up to `toVersion`. */
export function upgradeRow(table: TableName, row: Row, fromVersion: number, toVersion: number): Row {
  for (let version = fromVersion + 1; version <= toVersion; version++) {
    ROW_FIXES[version]?.[table]?.(row);
  }
  return row;
}
