-- 0027: Add AccountId to ItemEvent so we can track who performed each action
-- ============================================================================

IF COL_LENGTH('dbo.ItemEvent', 'AccountId') IS NULL
BEGIN
    ALTER TABLE dbo.ItemEvent
        ADD AccountId UNIQUEIDENTIFIER NULL;

    ALTER TABLE dbo.ItemEvent
        ADD CONSTRAINT FK_ItemEvent_Account FOREIGN KEY (AccountId)
            REFERENCES dbo.Account (Id);

    CREATE NONCLUSTERED INDEX IX_ItemEvent_AccountId
        ON dbo.ItemEvent (AccountId);
END
GO
