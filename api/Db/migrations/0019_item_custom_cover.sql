-- 0019: Add CustomCoverUrl to LibraryItem for user-uploaded book photos
IF COL_LENGTH('dbo.LibraryItem', 'CustomCoverUrl') IS NULL
    ALTER TABLE dbo.LibraryItem
        ADD CustomCoverUrl NVARCHAR(500) NULL;
GO
