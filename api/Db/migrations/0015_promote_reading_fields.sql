-- =============================================================================
-- 0015_promote_reading_fields.sql
-- Promote ReadStatus, CompletedDate, DateStarted, UserRating from MetadataJson
-- to real columns on dbo.LibraryItem for queryability and indexing.
-- AcquiredOn already exists as a real column (AcquiredDate is a frontend alias).
-- =============================================================================

-- 1. Add the new columns (idempotent)
IF COL_LENGTH('dbo.LibraryItem', 'ReadStatus') IS NULL
    ALTER TABLE dbo.LibraryItem ADD ReadStatus nvarchar(50) NULL;
IF COL_LENGTH('dbo.LibraryItem', 'CompletedDate') IS NULL
    ALTER TABLE dbo.LibraryItem ADD CompletedDate nvarchar(50) NULL;
IF COL_LENGTH('dbo.LibraryItem', 'DateStarted') IS NULL
    ALTER TABLE dbo.LibraryItem ADD DateStarted nvarchar(50) NULL;
IF COL_LENGTH('dbo.LibraryItem', 'UserRating') IS NULL
    ALTER TABLE dbo.LibraryItem ADD UserRating decimal(3,1) NULL;
GO

-- 2. Backfill from MetadataJson where values exist
UPDATE dbo.LibraryItem
SET
    ReadStatus    = JSON_VALUE(MetadataJson, '$.readStatus'),
    CompletedDate = JSON_VALUE(MetadataJson, '$.completedDate'),
    DateStarted   = JSON_VALUE(MetadataJson, '$.dateStarted'),
    UserRating    = TRY_CAST(JSON_VALUE(MetadataJson, '$.userRating') AS decimal(3,1))
WHERE MetadataJson IS NOT NULL
  AND (
        JSON_VALUE(MetadataJson, '$.readStatus')    IS NOT NULL
     OR JSON_VALUE(MetadataJson, '$.completedDate') IS NOT NULL
     OR JSON_VALUE(MetadataJson, '$.dateStarted')   IS NOT NULL
     OR JSON_VALUE(MetadataJson, '$.userRating')    IS NOT NULL
  );
GO

-- 3. (Optional) Remove the promoted keys from MetadataJson to avoid drift.
--    This is safe because the values are now in real columns.
--    Only run on rows that still have MetadataJson with those keys.
UPDATE dbo.LibraryItem
SET MetadataJson =
    JSON_MODIFY(
        JSON_MODIFY(
            JSON_MODIFY(
                JSON_MODIFY(MetadataJson, '$.readStatus', NULL),
            '$.completedDate', NULL),
        '$.dateStarted', NULL),
    '$.userRating', NULL)
WHERE MetadataJson IS NOT NULL
  AND (
        JSON_VALUE(MetadataJson, '$.readStatus')    IS NOT NULL
     OR JSON_VALUE(MetadataJson, '$.completedDate') IS NOT NULL
     OR JSON_VALUE(MetadataJson, '$.dateStarted')   IS NOT NULL
     OR JSON_VALUE(MetadataJson, '$.userRating')    IS NOT NULL
  );
GO

-- 4. Record migration (matches SchemaVersions schema from 0001)
--    Uncomment if running manually outside the migration runner:
-- INSERT INTO dbo.SchemaVersions (Version, AppliedUtc, ScriptName, Checksum)
-- VALUES (15, SYSUTCDATETIME(), '0015_promote_reading_fields.sql', 0x00);
GO
