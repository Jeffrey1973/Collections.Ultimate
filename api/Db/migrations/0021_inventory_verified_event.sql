-- 0021_inventory_verified_event.sql
-- Adds the "InventoryVerified" event type for tracking physical inventory checks.

IF NOT EXISTS (SELECT 1 FROM dbo.ItemEventType WHERE Name = 'InventoryVerified')
BEGIN
    SET IDENTITY_INSERT dbo.ItemEventType ON;
    INSERT INTO dbo.ItemEventType (Id, Name, Label, Icon, SortOrder)
    VALUES (24, 'InventoryVerified', 'Inventory verified', N'✔️', 24);
    SET IDENTITY_INSERT dbo.ItemEventType OFF;
END
GO
