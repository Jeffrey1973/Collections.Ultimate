-- Widen SubjectHeading.Text from nvarchar(500) to nvarchar(2000)
-- to accommodate pipe-delimited subject lists from LibraryThing imports.

-- Also widen UserRating from decimal(3,1) to decimal(5,2) to avoid
-- arithmetic overflow on ratings with higher precision.

-- NOTE: These were applied live during an active import session.

SET QUOTED_IDENTIFIER ON;
GO

-- 1. SubjectHeading text columns
IF COL_LENGTH('dbo.SubjectHeading', 'Text') IS NOT NULL
    ALTER TABLE dbo.SubjectHeading ALTER COLUMN [Text] nvarchar(2000) NOT NULL;
GO

IF COL_LENGTH('dbo.SubjectHeading', 'NormalizedText') IS NOT NULL
    ALTER TABLE dbo.SubjectHeading ALTER COLUMN NormalizedText nvarchar(2000) NOT NULL;
GO

-- 2. UserRating precision
IF COL_LENGTH('dbo.LibraryItem', 'UserRating') IS NOT NULL
    ALTER TABLE dbo.LibraryItem ALTER COLUMN UserRating decimal(5,2) NULL;
GO
