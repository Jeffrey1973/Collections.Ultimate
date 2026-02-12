-- Add Auth0 subject identifier to Account table
-- and Role column to AccountHousehold for authorization

-- 1. Add Auth0Sub column to Account
IF COL_LENGTH('dbo.Account', 'Auth0Sub') IS NULL
BEGIN
    ALTER TABLE dbo.Account ADD Auth0Sub nvarchar(200) NULL;
END
GO

-- 2. Create unique index on Auth0Sub (filtered to non-null)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Account_Auth0Sub' AND object_id = OBJECT_ID('dbo.Account'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_Account_Auth0Sub
        ON dbo.Account (Auth0Sub)
        WHERE Auth0Sub IS NOT NULL;
END
GO

-- 3. Add Role column to AccountHousehold (Owner, Member, ReadOnly)
IF COL_LENGTH('dbo.AccountHousehold', 'Role') IS NULL
BEGIN
    ALTER TABLE dbo.AccountHousehold ADD Role nvarchar(50) NOT NULL DEFAULT 'Owner';
END
GO
