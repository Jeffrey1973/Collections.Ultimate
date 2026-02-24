-- Persist user-defined locations for a household
-- (separate from the Location column on LibraryItem which stores actual assignments)

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'HouseholdLocation')
BEGIN
    CREATE TABLE dbo.HouseholdLocation
    (
        Id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        HouseholdId     UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.Household(Id),
        Name            NVARCHAR(200)    NOT NULL,
        Description     NVARCHAR(500)    NULL,
        LocationType    NVARCHAR(50)     NULL,  -- room, shelf, cabinet, box, other
        SortOrder       INT              NOT NULL DEFAULT 0,
        CreatedUtc      DATETIMEOFFSET   NOT NULL DEFAULT SYSUTCDATETIME()
    );

    CREATE UNIQUE INDEX UX_HouseholdLocation_Name
        ON dbo.HouseholdLocation (HouseholdId, Name);
END
