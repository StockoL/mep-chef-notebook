# Export format

Mep's export is open and documented so a chef's notebook is never locked in (DECISIONS 2, 14). The code is in `src/data/exportFormat.ts`, `exportData.ts` and `importData.ts`; keep this file in step with them.

## The file

`mep-export-YYYY-MM-DD.zip` (the date is local), containing:

```
data.json            everything except photos and voice notes
media/<id>.<ext>     one file per photo or voice note
```

## data.json

```json
{
  "format": "mep-export",
  "formatVersion": 1,
  "schemaVersion": 1,
  "exportedAt": "2026-11-24T18:30:00.000Z",
  "appVersion": "0.0.0",
  "tables": {
    "kitchens": [ { "id": "none", "name": "No kitchen", "...": "..." } ],
    "notes": [ ],
    "media": [ { "id": "…", "type": "image/jpeg", "file": "media/….jpg", "createdAt": "…", "updatedAt": "…" } ],
    "settings": [ { "key": "theme", "value": "dark" } ]
  }
}
```

- `format` is always `"mep-export"`.
- `formatVersion` changes only if the file's layout changes (not for new tables or fields).
- `schemaVersion` is the database schema the rows follow (`SCHEMA_VERSION` in `src/data/db.ts`). An older one is migrated on import; a newer one is refused with "update the app first".
- `tables` holds every table by name, each an array of its rows exactly as stored. The tables and their fields are defined in `src/data/types.ts` (SPEC → Data model). A table with no rows may be an empty array or left out.
- In `media`, each row's `blob` is replaced by `file`, the path of its file in the zip.

## Conventions in the rows

From `src/data/types.ts`:

- Every row has `id` (a UUID string), `createdAt` and `updatedAt` (ISO timestamps in UTC). `settings` rows have `key` and `value` instead.
- Calendar dates are `"YYYY-MM-DD"`; times of day `"HH:MM"`; days of the week 1–7 from Monday.
- Money is whole pence.
- Fields ending in `Id` point at another row by id. Editable-list fields point at a `listValues` row.
- `kitchenId: "none"` means "No kitchen". `kitchenId: null` means "not tied to any kitchen" (the chef's own).

## Import

Import checks the whole file before changing anything. A file that isn't a Mep export, is damaged, comes from a newer Mep, names a table Mep doesn't know, has a row without an id, or is missing a media file is refused with a message saying which, and the notebook is left as it was.

In this version, import replaces everything in one step. Merging an export into an existing notebook comes later.
