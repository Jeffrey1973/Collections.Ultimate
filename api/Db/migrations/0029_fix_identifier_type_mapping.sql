-- ============================================================================
-- 0029: Repair historical IdentifierType mis-mapping
--
-- Three incompatible IdentifierType maps existed (web/src/api/backend.ts,
-- web/src/pages/BookEditPage.tsx, and the DB seed), so the SAME identifier was
-- written under DIFFERENT type IDs depending on which page saved the book.
-- The frontend now has one canonical map (web/src/api/lookups.ts) transcribed
-- from this database, so NEW writes are correct. This repairs the old rows.
--
-- Evidence (production, 2026-08-08, n=100 rows inspected individually):
--   type 3 "ASIN"  -> 71 rows, ALL LCCN-shaped. backend.ts mapped LCCN->3.
--   type 4 "OCLC"  -> 21 rows, ALL LCCN-shaped. BookEditPage mapped LCCN->4.
--   type 5 "LCCN"  ->  8 rows, correctly filed by the import path, EXCEPT one
--                      ISSN ('0738176X') a user typed into the LCCN field.
-- Diagnostic shapes that make this unambiguous: hyphenated ('74-21344'),
-- alphabetic prefixes ('sf 96093694'), and MARC suffixes ('75118104 //',
-- '86071606 /M'). OCLC numbers never carry those; ASINs look like 'B00X4WHP5E'.
-- Not one row in types 3 or 4 was a real ASIN or a real OCLC number.
--
-- Pre-verified on a restored copy of production:
--   0 exact (EditionId, Value) duplicates across types 3/4/5
--   0 collisions against existing type-5 rows
--   0 rows with IsPrimary = 1
-- so no PK_EditionIdentifier (EditionId, IdentifierTypeId, Value) conflicts.
--
-- !! RUNS EXACTLY ONCE. !!
-- Guarded on dbo.SchemaVersions because the corrected frontend now writes
-- genuine ASIN->3 and OCLC->4 rows. Re-running would relabel real ASINs and
-- OCLC numbers as LCCNs. The value-shape predicates below are a second line of
-- defence, not the primary guard.
-- ============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

-- dbo.SchemaVersions does not exist in production: 0001_create_schema_versions.sql
-- was never applied there, because the production database was provisioned from
-- api/Db/schema/full_schema.sql rather than by running the migration chain. There is
-- therefore NO ledger of which migrations have been applied. Create it here so this
-- migration's once-only guard has somewhere to record itself.
--
-- Note what this table does and does not mean after this runs: it will contain
-- version 29 ONLY. That is honest — it records what we actually know was applied by
-- the runner, and does not fabricate history for 0001-0028, whose effects reached
-- production via full_schema.sql by an unknown route. Reconciling the baseline is a
-- separate task ("make the schema reproducible").
IF OBJECT_ID(N'dbo.SchemaVersions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SchemaVersions
    (
        Version    int              NOT NULL,
        AppliedUtc datetimeoffset(7) NOT NULL,
        ScriptName nvarchar(260)    NOT NULL,
        Checksum   varbinary(32)    NOT NULL,
        CONSTRAINT PK_SchemaVersions PRIMARY KEY CLUSTERED (Version)
    );

    CREATE UNIQUE INDEX UX_SchemaVersions_ScriptName ON dbo.SchemaVersions(ScriptName);

    PRINT '0029: created dbo.SchemaVersions (did not exist)';
END
GO

IF EXISTS (SELECT 1 FROM dbo.SchemaVersions WHERE Version = 29)
BEGIN
    PRINT '0029 already applied - skipping (this migration is once-only by design)';
END
ELSE
BEGIN
    BEGIN TRANSACTION;

    DECLARE @issn int = 0, @from3 int = 0, @from4 int = 0, @from11 int = 0, @from8 int = 0;

    -- 1. The lone ISSN sitting in the LCCN bucket. An 8-character value ending in
    --    the ISSN 'X' check digit cannot be an LCCN, which is always numeric after
    --    any prefix. Done FIRST so it is not swept up by step 2/3.
    UPDATE dbo.EditionIdentifier
    SET IdentifierTypeId = 7                                  -- ISSN
    WHERE IdentifierTypeId = 5                                -- LCCN
      AND LEN(Value) = 8
      AND Value LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9]X';
    SET @issn = @@ROWCOUNT;

    -- 2. backend.ts wrote LCCN as 3 (the row labelled ASIN).
    UPDATE dbo.EditionIdentifier
    SET IdentifierTypeId = 5                                  -- LCCN
    WHERE IdentifierTypeId = 3
      AND Value LIKE '%[0-9][0-9][0-9][0-9]%'                 -- 4+ consecutive digits
      AND Value NOT LIKE 'B0%';                               -- never touch a real ASIN
    -- 4 digits, not 6: hyphenated LCCNs like '74-21344' and '93-1857' have only
    -- 5 and 4 consecutive digits respectively. A 6-digit threshold silently skips
    -- them -- caught on the restored copy, where it left 1 of 71 and 1 of 21 behind.
    -- An ASIN ('B00X4WHP5E') has no 4 consecutive digits, so this still excludes them.
    SET @from3 = @@ROWCOUNT;

    -- 3. BookEditPage.tsx wrote LCCN as 4 (the row labelled OCLC).
    UPDATE dbo.EditionIdentifier
    SET IdentifierTypeId = 5                                  -- LCCN
    WHERE IdentifierTypeId = 4
      AND Value LIKE '%[0-9][0-9][0-9][0-9]%'                 -- see note on step 2
      AND Value NOT LIKE 'B0%';
    SET @from4 = @@ROWCOUNT;

    -- 4. backend.ts wrote OpenLibrary as 11 (the row labelled GoogleBooks).
    --    MUST run BEFORE step 5, which moves rows INTO 11. Verified: all 76 rows are
    --    OL-prefixed OpenLibrary IDs, and type 14 is empty, so nothing can collide.
    UPDATE dbo.EditionIdentifier
    SET IdentifierTypeId = 14                                 -- OpenLibrary
    WHERE IdentifierTypeId = 11
      AND Value LIKE 'OL%';
    SET @from11 = @@ROWCOUNT;

    -- 5. backend.ts wrote GoogleBooks as 8 (the SECOND, duplicate row labelled OCLC).
    --    Verified: all 1,646 rows are exactly 12 characters and NOT ONE is purely
    --    numeric. A genuine OCLC number is always numeric, so none of these are OCLC.
    --    Google Books volume IDs are 12-character alphanumerics ('zZBZngEACAAJ').
    UPDATE dbo.EditionIdentifier
    SET IdentifierTypeId = 11                                 -- GoogleBooks
    WHERE IdentifierTypeId = 8
      AND LEN(Value) = 12
      AND Value LIKE '%[^0-9]%';                              -- not a real OCLC number
    SET @from8 = @@ROWCOUNT;

    PRINT '0029: ISSN rescued from LCCN bucket : ' + CAST(@issn   AS varchar(10));
    PRINT '0029: type 3  (ASIN)        -> 5  (LCCN)       : ' + CAST(@from3  AS varchar(10));
    PRINT '0029: type 4  (OCLC)        -> 5  (LCCN)       : ' + CAST(@from4  AS varchar(10));
    PRINT '0029: type 11 (GoogleBooks) -> 14 (OpenLibrary): ' + CAST(@from11 AS varchar(10));
    PRINT '0029: type 8  (OCLC dup)    -> 11 (GoogleBooks): ' + CAST(@from8  AS varchar(10));

    INSERT INTO dbo.SchemaVersions (Version, AppliedUtc, ScriptName, Checksum)
    VALUES (29, SYSDATETIMEOFFSET(), N'0029_fix_identifier_type_mapping.sql', 0x00);

    COMMIT TRANSACTION;
END
GO

PRINT '=== 0029_fix_identifier_type_mapping complete ==='
GO
