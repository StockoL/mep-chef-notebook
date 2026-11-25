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
  /**
   * Schema v4 (Phase 4): a step holds the parts the step reader found
   * (DECISIONS 38). Readings stored on the step itself become its one part;
   * a step with no readings gets none, and is read at start-up
   * (steps.ts → readUnreadSteps).
   */
  4: {
    steps: (row) => {
      if (Array.isArray(row.parts)) return;
      const hadReadings = row.mode != null || row.minutesMin != null || row.equipmentTypeId != null;
      row.parts = hadReadings
        ? [
            {
              text: row.text ?? '',
              verb: null,
              mode: row.mode ?? null,
              minutesMin: row.minutesMin ?? null,
              minutesMax: row.minutesMax ?? null,
              equipmentTypeId: row.equipmentTypeId ?? null,
              equipmentSetting: row.equipmentSetting ?? null,
              checkEveryMinutes: null,
              dependsOnComponentIds: row.dependsOnComponentIds ?? [],
              scalesWithLineId: row.scalesWithLineId ?? null,
              templateComponentId: null,
              hold: null,
              pausable: row.pausable ?? true,
              pauseBlocker: row.pauseBlocker ?? null,
              criticalPoint: row.criticalPoint ?? null,
              atService: row.atService ?? false,
              relativeTime: false,
              noGap: false,
              previousDay: false,
            },
          ]
        : [];
      for (const field of [
        'mode',
        'minutesMin',
        'minutesMax',
        'equipmentTypeId',
        'equipmentSetting',
        'dependsOnComponentIds',
        'scalesWithLineId',
        'hold',
        'pausable',
        'pauseBlocker',
        'criticalPoint',
        'atService',
      ]) {
        delete row[field];
      }
      row.confirmed ??= false;
    },
  },
  /** Schema v5 (Phase 5): ingredients can hold the chef's own weights for counts (DECISIONS 41). */
  5: {
    ingredients: (row) => {
      row.unitWeights ??= {};
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
