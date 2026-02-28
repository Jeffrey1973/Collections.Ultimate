-- Widen Description column to NVARCHAR(MAX) so digital locations can store
-- JSON metadata (platform, url, accountEmail, notes) in this field.

IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'HouseholdLocation' AND COLUMN_NAME = 'Description'
      AND CHARACTER_MAXIMUM_LENGTH <> -1  -- -1 means MAX
)
BEGIN
    ALTER TABLE dbo.HouseholdLocation ALTER COLUMN Description NVARCHAR(MAX) NULL;
END
