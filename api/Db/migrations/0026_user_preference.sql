-- Generic user preferences table (JSON blob per account + key)
-- Supports display fields, filter defaults, view mode, etc.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'UserPreference')
BEGIN
    CREATE TABLE dbo.UserPreference
    (
        AccountId   UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.Account(Id),
        [Key]       NVARCHAR(100)    NOT NULL,
        Value       NVARCHAR(MAX)    NOT NULL,  -- JSON payload
        UpdatedUtc  DATETIMEOFFSET   NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_UserPreference PRIMARY KEY (AccountId, [Key])
    );

    PRINT 'Created dbo.UserPreference table.';
END
