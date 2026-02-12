-- =============================================================================
-- 0016_library_order.sql
-- Add LibraryOrder column to dbo.LibraryItem.
-- Tracks the order in which a book was entered into the library (1 = first).
-- =============================================================================

IF COL_LENGTH('dbo.LibraryItem', 'LibraryOrder') IS NULL
    ALTER TABLE dbo.LibraryItem ADD LibraryOrder int NULL;
GO
