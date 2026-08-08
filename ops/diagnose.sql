/* =============================================================================
   Collections.Ultimate — production diagnostic
   =============================================================================
   READ-ONLY. Makes no changes. Run against the LIVE database and keep the output.

   Purpose:
     1. Establish the real schema (api/Db/schema/full_schema.sql is known stale).
     2. Measure headroom against the SQL Server Express 10 GB ceiling.
     3. Profile identifier + contributor rows so the three-way ID divergence can be
        remapped from evidence rather than guesswork.
     4. Find rows already damaged by migration 0013's naive JSON concatenation.

   Usage (from the VPS):
     docker exec -i cu-sqlserver /opt/mssql-tools18/bin/sqlcmd \
       -S localhost -U sa -P "$SA_PASSWORD" -C -d CollectionsUltimate \
       -i /dev/stdin < ops/diagnose.sql > ops/diagnose-output.txt
   ============================================================================= */

SET NOCOUNT ON;

/* -----------------------------------------------------------------------------
   1. DATABASE SIZE vs THE EXPRESS 10 GB CEILING
   MSSQL_PID=Express caps each database at 10240 MB. Past that, INSERTs fail with
   error 1105 — new user data silently rejected. This number sets the urgency of
   the Azure SQL move.
   -------------------------------------------------------------------------- */
PRINT '=== 1. DATABASE SIZE ===';
SELECT
    DB_NAME()                                                   AS DatabaseName,
    CAST(SUM(size) * 8.0 / 1024 AS DECIMAL(10,2))               AS AllocatedMB,
    CAST(SUM(FILEPROPERTY(name, 'SpaceUsed')) * 8.0 / 1024
         AS DECIMAL(10,2))                                      AS UsedMB,
    CAST(10240 - SUM(FILEPROPERTY(name, 'SpaceUsed')) * 8.0 / 1024
         AS DECIMAL(10,2))                                      AS ExpressHeadroomMB
FROM sys.database_files
WHERE type_desc = 'ROWS';

PRINT '';
PRINT '=== 1b. LARGEST TABLES ===';
SELECT TOP 20
    s.name + '.' + t.name                          AS TableName,
    p.rows                                         AS [RowCount],
    CAST(SUM(a.total_pages) * 8.0 / 1024
         AS DECIMAL(10,2))                         AS TotalMB
FROM sys.tables t
JOIN sys.schemas s      ON s.schema_id = t.schema_id
JOIN sys.indexes i      ON i.object_id = t.object_id
JOIN sys.partitions p   ON p.object_id = i.object_id AND p.index_id = i.index_id
JOIN sys.allocation_units a ON a.container_id = p.partition_id
WHERE i.index_id IN (0, 1)
GROUP BY s.name, t.name, p.rows
ORDER BY SUM(a.total_pages) DESC;

/* -----------------------------------------------------------------------------
   2. THE REAL SCHEMA
   full_schema.sql predates migrations 0015-0028 and is missing tables the running
   code queries. Treat THIS output as the source of truth when authoring the new
   baseline migration.
   -------------------------------------------------------------------------- */
PRINT '';
PRINT '=== 2. TABLES THAT ACTUALLY EXIST ===';
SELECT s.name AS SchemaName, t.name AS TableName
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
ORDER BY s.name, t.name;

PRINT '';
PRINT '=== 2b. COLUMN WIDTHS FOR THE TABLES WITH KNOWN TRUNCATION BUGS ===';
SELECT
    TABLE_NAME, COLUMN_NAME, DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH AS MaxLen,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('EditionIdentifier', 'Edition', 'Work', 'LibraryItem')
ORDER BY TABLE_NAME, ORDINAL_POSITION;

/* -----------------------------------------------------------------------------
   3. LOOKUP TABLES AS THEY ACTUALLY EXIST
   The canonical map must be built from these rows, because FK_EditionIdentifier_Type
   already enforces them and existing data already points at them.
   -------------------------------------------------------------------------- */
PRINT '';
PRINT '=== 3. IdentifierType (actual rows) ===';
SELECT Id, Name FROM dbo.IdentifierType ORDER BY Id;

PRINT '';
PRINT '=== 3b. ContributorRole (actual rows) ===';
SELECT Id, Name FROM dbo.ContributorRole ORDER BY Id;

PRINT '';
PRINT '=== 3c. SubjectScheme (actual rows) ===';
SELECT Id, Name FROM dbo.SubjectScheme ORDER BY Id;

PRINT '';
PRINT '=== 3d. DUPLICATE NAMES IN LOOKUP TABLES ===';
PRINT '(Known: OCLC appears at both 4 and 8. Confirm before adding UNIQUE(Name).)';
SELECT 'IdentifierType' AS TableName, Name, COUNT(*) AS Copies,
       STRING_AGG(CAST(Id AS VARCHAR(10)), ',') AS Ids
FROM dbo.IdentifierType GROUP BY Name HAVING COUNT(*) > 1
UNION ALL
SELECT 'ContributorRole', Name, COUNT(*),
       STRING_AGG(CAST(Id AS VARCHAR(10)), ',')
FROM dbo.ContributorRole GROUP BY Name HAVING COUNT(*) > 1
UNION ALL
SELECT 'SubjectScheme', Name, COUNT(*),
       STRING_AGG(CAST(Id AS VARCHAR(10)), ',')
FROM dbo.SubjectScheme GROUP BY Name HAVING COUNT(*) > 1;

/* -----------------------------------------------------------------------------
   4. IDENTIFIER PROFILE — THE CORE OF THE REMAP
   Two frontend paths write DIFFERENT ids for the same logical identifier
   (backend.ts vs BookEditPage.tsx), so a row's IdentifierTypeId alone does not
   tell you what it is. Value SHAPE is the disambiguator. This classifies every
   row by shape so the remap can be written from evidence.
   -------------------------------------------------------------------------- */
PRINT '';
PRINT '=== 4. IDENTIFIER ROWS BY TYPE, WITH INFERRED SHAPE ===';
WITH Classified AS (
    SELECT
        ei.IdentifierTypeId,
        it.Name AS StoredTypeName,
        ei.Value,
        CASE
            WHEN ei.Value LIKE '10.[0-9]%/%'                       THEN 'DOI'
            WHEN ei.Value LIKE 'B0%' AND LEN(ei.Value) = 10        THEN 'ASIN'
            WHEN LEN(REPLACE(REPLACE(ei.Value,'-',''),' ','')) = 13
                 AND REPLACE(REPLACE(ei.Value,'-',''),' ','') NOT LIKE '%[^0-9]%'
                                                                   THEN 'ISBN-13'
            WHEN LEN(REPLACE(REPLACE(ei.Value,'-',''),' ','')) = 10
                 AND REPLACE(REPLACE(ei.Value,'-',''),' ','') NOT LIKE '%[^0-9X]%'
                                                                   THEN 'ISBN-10'
            WHEN ei.Value LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9X]'
                                                                   THEN 'ISSN'
            WHEN ei.Value LIKE '%[a-z][a-z]%[0-9][0-9][0-9][0-9][0-9][0-9]%'
                 AND LEN(ei.Value) BETWEEN 8 AND 12                THEN 'LCCN-like'
            WHEN ei.Value NOT LIKE '%[^0-9]%' AND LEN(ei.Value) >= 6
                                                                   THEN 'numeric (OCLC/Goodreads/LibraryThing)'
            WHEN ei.Value LIKE 'OL%'                               THEN 'OpenLibrary'
            WHEN LEN(ei.Value) = 12
                 AND ei.Value LIKE '%[A-Za-z]%'                    THEN 'GoogleBooks-like'
            ELSE 'unclassified'
        END AS InferredShape
    FROM dbo.EditionIdentifier ei
    LEFT JOIN dbo.IdentifierType it ON it.Id = ei.IdentifierTypeId
)
SELECT
    IdentifierTypeId,
    StoredTypeName,
    InferredShape,
    COUNT(*)      AS Rows,
    MIN(Value)    AS SampleA,
    MAX(Value)    AS SampleB
FROM Classified
GROUP BY IdentifierTypeId, StoredTypeName, InferredShape
ORDER BY IdentifierTypeId, COUNT(*) DESC;

PRINT '';
PRINT '=== 4b. IDENTIFIERS AT EXACTLY 50 CHARS (evidence of past truncation) ===';
PRINT '(These were amputated by WorkMetadataRepository and cannot be recovered from the DB.)';
SELECT ei.IdentifierTypeId, it.Name AS StoredTypeName, COUNT(*) AS TruncatedRows
FROM dbo.EditionIdentifier ei
LEFT JOIN dbo.IdentifierType it ON it.Id = ei.IdentifierTypeId
WHERE LEN(ei.Value) = 50 OR LEN(ei.NormalizedValue) = 50
GROUP BY ei.IdentifierTypeId, it.Name
ORDER BY COUNT(*) DESC;

PRINT '';
PRINT '=== 4c. ORPHANED IdentifierTypeId VALUES (FK should prevent, but verify) ===';
SELECT ei.IdentifierTypeId, COUNT(*) AS Rows
FROM dbo.EditionIdentifier ei
LEFT JOIN dbo.IdentifierType it ON it.Id = ei.IdentifierTypeId
WHERE it.Id IS NULL
GROUP BY ei.IdentifierTypeId;

/* -----------------------------------------------------------------------------
   5. CONTRIBUTOR ROLE PROFILE
   Same divergence class: 9 roles are stored under the wrong labels.
   -------------------------------------------------------------------------- */
PRINT '';
PRINT '=== 5. CONTRIBUTOR ROWS BY ROLE ===';
SELECT
    wc.RoleId,
    cr.Name       AS StoredRoleName,
    COUNT(*)      AS Rows
FROM dbo.WorkContributor wc
LEFT JOIN dbo.ContributorRole cr ON cr.Id = wc.RoleId
GROUP BY wc.RoleId, cr.Name
ORDER BY COUNT(*) DESC;

/* -----------------------------------------------------------------------------
   6. MALFORMED MetadataJson
   Migration 0013 built LibraryItem.MetadataJson by naive string concat, escaping
   ONLY the double-quote character. Any title or author containing a backslash
   produced invalid JSON. Those rows' fields are unreadable and invisible in the UI
   TODAY — and both the frontend parser and the API swallow the parse exception.
   ~105 of ~155 fields live inside these three blobs.
   -------------------------------------------------------------------------- */
PRINT '';
PRINT '=== 6. ROWS WITH INVALID MetadataJson ===';
SELECT 'LibraryItem' AS TableName, COUNT(*) AS InvalidRows
FROM dbo.LibraryItem
WHERE MetadataJson IS NOT NULL AND ISJSON(MetadataJson) = 0
UNION ALL
SELECT 'Work', COUNT(*)
FROM dbo.Work
WHERE MetadataJson IS NOT NULL AND ISJSON(MetadataJson) = 0
UNION ALL
SELECT 'Edition', COUNT(*)
FROM dbo.Edition
WHERE MetadataJson IS NOT NULL AND ISJSON(MetadataJson) = 0;

PRINT '';
PRINT '=== 6b. SAMPLE OF INVALID LibraryItem ROWS (for repair) ===';
SELECT TOP 20 Id, LEFT(MetadataJson, 300) AS MetadataHead
FROM dbo.LibraryItem
WHERE MetadataJson IS NOT NULL AND ISJSON(MetadataJson) = 0;

PRINT '';
PRINT '=== 6c. METADATA BLOB SIZES (drives on-device sync footprint) ===';
SELECT
    COUNT(*)                                        AS Items,
    AVG(DATALENGTH(MetadataJson)) / 2               AS AvgMetadataChars,
    MAX(DATALENGTH(MetadataJson)) / 2               AS MaxMetadataChars,
    SUM(DATALENGTH(MetadataJson)) / 1048576.0       AS TotalMetadataMB
FROM dbo.LibraryItem;

/* -----------------------------------------------------------------------------
   7. TENANCY BLAST RADIUS
   Sizes the multi-tenant defects: how many households share Work/Edition rows,
   which is what makes the unscoped bibliographic writes dangerous.
   -------------------------------------------------------------------------- */
PRINT '';
PRINT '=== 7. HOUSEHOLD / LIBRARY / ITEM COUNTS ===';
SELECT
    (SELECT COUNT(*) FROM dbo.Household)    AS Households,
    (SELECT COUNT(*) FROM dbo.Account)      AS Accounts,
    (SELECT COUNT(*) FROM dbo.LibraryItem)  AS Items,
    (SELECT COUNT(*) FROM dbo.Work)         AS Works,
    (SELECT COUNT(*) FROM dbo.Edition)      AS Editions,
    (SELECT COUNT(*) FROM dbo.ItemEvent)    AS ItemEvents;

/* dbo.Library was added by migration 0028 and is absent from full_schema.sql,
   so guard it rather than assuming. */
IF OBJECT_ID(N'dbo.Library', N'U') IS NOT NULL
    EXEC sp_executesql N'SELECT COUNT(*) AS Libraries FROM dbo.Library;';
ELSE
    PRINT 'dbo.Library does not exist — migration 0028 has not been applied.';

PRINT '';
PRINT '=== 7b. EDITIONS SHARED ACROSS MORE THAN ONE HOUSEHOLD ===';
PRINT '(Each is a row where one household''s edit rewrites another household''s book.)';
SELECT COUNT(*) AS SharedEditions
FROM (
    SELECT li.EditionId
    FROM dbo.LibraryItem li
    WHERE li.EditionId IS NOT NULL
    GROUP BY li.EditionId
    HAVING COUNT(DISTINCT li.HouseholdId) > 1
) x;

PRINT '';
PRINT '=== 7c. WORKS SHARED ACROSS MORE THAN ONE HOUSEHOLD ===';
SELECT COUNT(*) AS SharedWorks
FROM (
    SELECT li.WorkId
    FROM dbo.LibraryItem li
    GROUP BY li.WorkId
    HAVING COUNT(DISTINCT li.HouseholdId) > 1
) x;

/* -----------------------------------------------------------------------------
   8. COVER IMAGE REFERENCES
   Cross-check these against the api_uploads volume. Any reference without a file
   is already-lost data; any file without a reference is an orphan.
   -------------------------------------------------------------------------- */
PRINT '';
PRINT '=== 8. COVER REFERENCES ===';
SELECT 'Edition.CoverImageUrl' AS Source, COUNT(*) AS LocalUploadRefs
FROM dbo.Edition WHERE CoverImageUrl LIKE '/uploads/%'
UNION ALL
SELECT 'LibraryItem.CustomCoverUrl', COUNT(*)
FROM dbo.LibraryItem WHERE CustomCoverUrl LIKE '/uploads/%';

PRINT '';
PRINT '=== DIAGNOSTIC COMPLETE ===';
