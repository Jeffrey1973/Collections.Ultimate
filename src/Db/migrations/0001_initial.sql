/*
  Migration: 0001_initial

  Apply to an empty database.

  This is currently identical to `src/Db/schema/0001_initial.sql`.
  As the project evolves:
  - Keep `schema/` as the canonical end-state schema
  - Add new incremental scripts to `migrations/`
*/

:r ..\schema\0001_initial.sql
