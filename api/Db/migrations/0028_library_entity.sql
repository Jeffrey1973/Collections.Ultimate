-- ============================================================================
-- 0028: Add Library entity between Household and LibraryItem
-- Supports multiple libraries per household with per-library member roles.
-- Migration is fully idempotent and preserves all existing data.
-- ============================================================================

-- 1. Create the Library table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Library')
BEGIN
    CREATE TABLE dbo.Library
    (
        Id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        HouseholdId     UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.Household(Id),
        Name            NVARCHAR(400)    NOT NULL,
        Description     NVARCHAR(1000)   NULL,
        IsDefault       BIT              NOT NULL DEFAULT 0,
        CreatedUtc      DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET()
    );

    CREATE INDEX IX_Library_HouseholdId ON dbo.Library (HouseholdId);
    CREATE UNIQUE INDEX UX_Library_HouseholdName ON dbo.Library (HouseholdId, Name);
END
GO

-- 2. Create the LibraryMember table (per-library roles)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'LibraryMember')
BEGIN
    CREATE TABLE dbo.LibraryMember
    (
        LibraryId   UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.Library(Id) ON DELETE CASCADE,
        AccountId   UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.Account(Id),
        Role        NVARCHAR(40)     NOT NULL DEFAULT 'Member',
        CreatedUtc  DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_LibraryMember PRIMARY KEY (LibraryId, AccountId)
    );

    CREATE INDEX IX_LibraryMember_AccountId ON dbo.LibraryMember (AccountId);
END
GO

-- 3. Add LibraryId column to LibraryItem (nullable initially for backfill)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.LibraryItem') AND name = 'LibraryId'
)
BEGIN
    ALTER TABLE dbo.LibraryItem
        ADD LibraryId UNIQUEIDENTIFIER NULL;
END
GO

-- 4. Create a default "Main Library" for every household that doesn't have one yet
INSERT INTO dbo.Library (Id, HouseholdId, Name, IsDefault)
SELECT NEWID(), h.Id, N'Main Library', 1
FROM dbo.Household h
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Library l
    WHERE l.HouseholdId = h.Id AND l.IsDefault = 1
);
GO

-- 5. Backfill: assign all unassigned items to their household's default library
UPDATE i
SET i.LibraryId = l.Id
FROM dbo.LibraryItem i
INNER JOIN dbo.Library l ON l.HouseholdId = i.HouseholdId AND l.IsDefault = 1
WHERE i.LibraryId IS NULL;
GO

-- 6. Copy existing AccountHousehold memberships into LibraryMember
--    for every library in the household (so existing members keep access)
INSERT INTO dbo.LibraryMember (LibraryId, AccountId, Role)
SELECT l.Id, ah.AccountId, ah.Role
FROM dbo.Library l
INNER JOIN dbo.AccountHousehold ah ON ah.HouseholdId = l.HouseholdId
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.LibraryMember lm
    WHERE lm.LibraryId = l.Id AND lm.AccountId = ah.AccountId
);
GO

-- 7. Add FK constraint (now that all rows are backfilled)
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_LibraryItem_Library'
)
BEGIN
    ALTER TABLE dbo.LibraryItem
        ADD CONSTRAINT FK_LibraryItem_Library
        FOREIGN KEY (LibraryId) REFERENCES dbo.Library(Id);
END
GO

-- 8. Add index on LibraryId for query performance
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.LibraryItem') AND name = 'IX_LibraryItem_LibraryId'
)
BEGIN
    CREATE INDEX IX_LibraryItem_LibraryId ON dbo.LibraryItem (LibraryId);
END
GO

PRINT '=== 0028_library_entity complete ==='
GO
