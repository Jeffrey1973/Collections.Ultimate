/* =============================================================================
   Collections.Ultimate — restore / migration fidelity verification
   =============================================================================
   READ-ONLY. Run against BOTH the source database and the restored (or migrated)
   copy, then diff the two outputs. Identical output = verified.

   This is the assertion set that turns "I copied a file" into "I have a backup",
   and it is the same set used to verify the Azure SQL cutover later.

     docker exec -i cu-sqlserver /opt/mssql-tools18/bin/sqlcmd \
       -S localhost -U sa -P "$SA_PASSWORD" -C -d CollectionsUltimate \
       -i /dev/stdin < ops/verify.sql > ops/verify-prod.txt

     ...then the same against the restore, and:  diff verify-prod.txt verify-restore.txt
   ============================================================================= */

SET NOCOUNT ON;

/* --- 1. Row counts for every table ---------------------------------------- */
PRINT '=== ROW COUNTS ===';
SELECT
    s.name + '.' + t.name AS TableName,
    SUM(p.rows)           AS [RowCount]
FROM sys.tables t
JOIN sys.schemas s    ON s.schema_id = t.schema_id
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
GROUP BY s.name, t.name
ORDER BY s.name, t.name;

/* --- 2. Per-table content fingerprints ------------------------------------
   CHECKSUM_AGG over BINARY_CHECKSUM detects content drift, not just row loss.
   Ordered so the aggregate is deterministic across engines.
   ------------------------------------------------------------------------- */
PRINT '';
PRINT '=== CONTENT FINGERPRINTS ===';
SELECT 'Work'         AS TableName, COUNT(*) AS Rows, CHECKSUM_AGG(BINARY_CHECKSUM(Id, Title, NormalizedTitle)) AS Fingerprint FROM dbo.Work
UNION ALL SELECT 'Edition',        COUNT(*), CHECKSUM_AGG(BINARY_CHECKSUM(Id, WorkId, Publisher, PublishedYear)) FROM dbo.Edition
UNION ALL SELECT 'LibraryItem',    COUNT(*), CHECKSUM_AGG(BINARY_CHECKSUM(Id, HouseholdId, WorkId, Title))       FROM dbo.LibraryItem
UNION ALL SELECT 'ItemEvent',      COUNT(*), CHECKSUM_AGG(BINARY_CHECKSUM(Id))                                   FROM dbo.ItemEvent
UNION ALL SELECT 'EditionIdentifier', COUNT(*), CHECKSUM_AGG(BINARY_CHECKSUM(EditionId, IdentifierTypeId, Value)) FROM dbo.EditionIdentifier
UNION ALL SELECT 'Account',        COUNT(*), CHECKSUM_AGG(BINARY_CHECKSUM(Id, Email))                             FROM dbo.Account
UNION ALL SELECT 'Household',      COUNT(*), CHECKSUM_AGG(BINARY_CHECKSUM(Id, Name))                              FROM dbo.Household
UNION ALL SELECT 'Person',         COUNT(*), CHECKSUM_AGG(BINARY_CHECKSUM(Id))                                    FROM dbo.Person
UNION ALL SELECT 'UserPreference', COUNT(*), CHECKSUM_AGG(BINARY_CHECKSUM(AccountId))                             FROM dbo.UserPreference;

/* --- 3. Blob integrity ----------------------------------------------------
   ~105 of ~155 fields live inside these three JSON blobs. A byte-length sum
   catches silent truncation that row counts would miss.
   ------------------------------------------------------------------------- */
PRINT '';
PRINT '=== METADATA BLOB TOTALS ===';
SELECT 'LibraryItem' AS TableName,
       SUM(DATALENGTH(MetadataJson)) AS TotalBytes,
       SUM(CASE WHEN MetadataJson IS NOT NULL AND ISJSON(MetadataJson) = 0 THEN 1 ELSE 0 END) AS InvalidJsonRows
FROM dbo.LibraryItem
UNION ALL
SELECT 'Work', SUM(DATALENGTH(MetadataJson)),
       SUM(CASE WHEN MetadataJson IS NOT NULL AND ISJSON(MetadataJson) = 0 THEN 1 ELSE 0 END)
FROM dbo.Work
UNION ALL
SELECT 'Edition', SUM(DATALENGTH(MetadataJson)),
       SUM(CASE WHEN MetadataJson IS NOT NULL AND ISJSON(MetadataJson) = 0 THEN 1 ELSE 0 END)
FROM dbo.Edition;

/* --- 4. Aggregate invariants ---------------------------------------------
   Numeric and temporal sums catch type-coercion damage during a migration —
   the class of error that row counts and checksums both miss.
   ------------------------------------------------------------------------- */
PRINT '';
PRINT '=== AGGREGATE INVARIANTS ===';
SELECT
    SUM(Price)          AS TotalPrice,
    SUM(UserRating)     AS TotalUserRating,
    MIN(CreatedUtc)     AS EarliestCreated,
    MAX(CreatedUtc)     AS LatestCreated,
    MIN(AcquiredOn)     AS EarliestAcquired,
    MAX(AcquiredOn)     AS LatestAcquired,
    COUNT(DISTINCT HouseholdId) AS DistinctHouseholds
FROM dbo.LibraryItem;

/* --- 5. Cover references --------------------------------------------------
   Must match, AND every reference must have a file in the uploads archive.
   The .bak contains no image bytes, so this is the only link between the two.
   ------------------------------------------------------------------------- */
PRINT '';
PRINT '=== COVER REFERENCE COUNTS ===';
SELECT 'Edition.CoverImageUrl' AS Source, COUNT(*) AS LocalRefs
FROM dbo.Edition WHERE CoverImageUrl LIKE '/uploads/%'
UNION ALL
SELECT 'LibraryItem.CustomCoverUrl', COUNT(*)
FROM dbo.LibraryItem WHERE CustomCoverUrl LIKE '/uploads/%';

/* --- 6. Visual spot-check -------------------------------------------------
   Checksums prove equality; humans catch "equal but wrong". Read these.
   ------------------------------------------------------------------------- */
PRINT '';
PRINT '=== 20 NEWEST ITEMS (eyeball these) ===';
SELECT TOP 20 Id, Title, CreatedUtc
FROM dbo.LibraryItem
ORDER BY CreatedUtc DESC;

PRINT '';
PRINT '=== VERIFICATION COMPLETE ===';
