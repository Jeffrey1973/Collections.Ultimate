-- User-defined category/tag master list per household
-- (separate from dbo.Tag which stores tags actually assigned to works)

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'HouseholdCategory')
BEGIN
    CREATE TABLE dbo.HouseholdCategory
    (
        Id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        HouseholdId     UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.Household(Id),
        Name            NVARCHAR(200)    NOT NULL,
        SortOrder       INT              NOT NULL DEFAULT 0,
        CreatedUtc      DATETIMEOFFSET   NOT NULL DEFAULT SYSUTCDATETIME()
    );

    CREATE UNIQUE INDEX UX_HouseholdCategory_Name
        ON dbo.HouseholdCategory (HouseholdId, Name);

    -- Seed the master list from all existing tags already assigned to books.
    -- This ensures every category that was previously added via the edit page
    -- appears in the household's category list and the autocomplete dropdown.
    INSERT INTO dbo.HouseholdCategory (Id, HouseholdId, Name, SortOrder, CreatedUtc)
    SELECT NEWID(), t.HouseholdId, t.Name, 0, SYSUTCDATETIME()
    FROM dbo.Tag t
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.HouseholdCategory hc
        WHERE hc.HouseholdId = t.HouseholdId AND hc.Name = t.Name
    );

    PRINT 'Created dbo.HouseholdCategory and seeded ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows from existing tags.';
END
