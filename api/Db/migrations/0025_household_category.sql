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
END
