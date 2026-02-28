-- Switch LibraryItem.Location from a free-text string to a foreign key
-- referencing HouseholdLocation.Id, so renaming a location automatically
-- propagates everywhere.

-- 1. Add the new FK column
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.LibraryItem') AND name = 'LocationId'
)
BEGIN
    ALTER TABLE dbo.LibraryItem
        ADD LocationId UNIQUEIDENTIFIER NULL;
END
GO

-- 2. Ensure every distinct Location string has a HouseholdLocation row.
--    Insert any that are missing (i.e. location strings on items that were
--    assigned before the HouseholdLocation table existed).
INSERT INTO dbo.HouseholdLocation (Id, HouseholdId, Name)
SELECT NEWID(), i.HouseholdId, i.Location
FROM (
    SELECT DISTINCT HouseholdId, Location
    FROM dbo.LibraryItem
    WHERE Location IS NOT NULL AND Location <> ''
) i
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.HouseholdLocation hl
    WHERE hl.HouseholdId = i.HouseholdId AND hl.Name = i.Location
);
GO

-- 3. Back-fill LocationId from the existing Location string
UPDATE li
SET li.LocationId = hl.Id
FROM dbo.LibraryItem li
INNER JOIN dbo.HouseholdLocation hl
    ON hl.HouseholdId = li.HouseholdId
   AND hl.Name = li.Location
WHERE li.Location IS NOT NULL AND li.Location <> '';
GO

-- 4. Add the foreign key constraint
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_LibraryItem_HouseholdLocation'
)
BEGIN
    ALTER TABLE dbo.LibraryItem
        ADD CONSTRAINT FK_LibraryItem_HouseholdLocation
        FOREIGN KEY (LocationId) REFERENCES dbo.HouseholdLocation(Id);
END
GO

-- 5. Add an index on LocationId for efficient lookups
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.LibraryItem') AND name = 'IX_LibraryItem_LocationId'
)
BEGIN
    CREATE INDEX IX_LibraryItem_LocationId ON dbo.LibraryItem (LocationId);
END
GO

-- 6. Drop the old Location string column (no longer needed)
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.LibraryItem') AND name = 'Location'
)
BEGIN
    -- First drop any indexes that reference Location
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.LibraryItem') AND name = 'IX_LibraryItem_Location')
        DROP INDEX IX_LibraryItem_Location ON dbo.LibraryItem;
    ALTER TABLE dbo.LibraryItem DROP COLUMN Location;
END
GO
