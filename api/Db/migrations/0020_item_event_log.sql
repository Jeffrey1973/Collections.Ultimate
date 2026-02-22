-- 0020: Item Event Log — chronological history of everything that happens to a library item
-- Event types are open-ended via a lookup table so new events can be added without schema changes.

-- ── Lookup table for event types ────────────────────────────────────────────

IF OBJECT_ID('dbo.ItemEventType', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ItemEventType
    (
        Id          INT            NOT NULL IDENTITY(1,1),
        Name        NVARCHAR(50)   NOT NULL,   -- machine-readable key (e.g. 'Acquired')
        Label       NVARCHAR(100)  NOT NULL,   -- human-friendly display label
        Icon        NVARCHAR(10)   NULL,        -- optional emoji/icon hint for UI
        SortOrder   INT            NOT NULL DEFAULT 0,

        CONSTRAINT PK_ItemEventType PRIMARY KEY (Id),
        CONSTRAINT UQ_ItemEventType_Name UNIQUE (Name)
    );
END
GO

-- ── Seed the initial set of event types ─────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM dbo.ItemEventType WHERE Name = 'Acquired')
BEGIN
    SET IDENTITY_INSERT dbo.ItemEventType ON;

    INSERT INTO dbo.ItemEventType (Id, Name, Label, Icon, SortOrder)
    VALUES
        ( 1, 'Acquired',       'Acquired',                N'📥',  1),
        ( 2, 'Shelved',        'Placed on shelf',         N'📚',  2),
        ( 3, 'Moved',          'Moved to different shelf', N'🔀',  3),
        ( 4, 'StartedReading', 'Started reading',         N'📖',  4),
        ( 5, 'FinishedReading','Finished reading',        N'✅',  5),
        ( 6, 'Lent',           'Lent out',                N'🤝',  6),
        ( 7, 'Returned',       'Returned',                N'↩️',  7),
        ( 8, 'Sold',           'Sold',                    N'💲',  8),
        ( 9, 'Gifted',         'Gifted',                  N'🎁',  9),
        (10, 'Destroyed',      'Destroyed / discarded',   N'🗑️', 10),
        (11, 'Lost',           'Lost',                    N'❓',  11),
        (12, 'Damaged',        'Damaged',                 N'💥',  12),
        (13, 'Repaired',       'Repaired',                N'🔧',  13),
        (14, 'Rated',          'Rated',                   N'⭐',  14),
        (15, 'Reviewed',       'Reviewed / noted',        N'📝',  15),
        (16, 'CoverUploaded',  'Cover photo uploaded',    N'📷',  16),
        (17, 'MetadataUpdated','Metadata updated',        N'🔄',  17),
        (18, 'Donated',        'Donated',                 N'❤️',  18),
        (19, 'StatusChanged',  'Status changed',          N'🏷️',  19),
        (20, 'Custom',         'Custom event',            N'📋',  20),
        (21, 'Imported',       'Imported from file',      N'📂',  21),
        (22, 'Enriched',       'Enriched from API',       N'✨',  22),
        (23, 'Edited',         'Manually edited',         N'✏️',  23);

    SET IDENTITY_INSERT dbo.ItemEventType OFF;
END
GO

-- Backfill new event types if the seed already ran
IF NOT EXISTS (SELECT 1 FROM dbo.ItemEventType WHERE Name = 'Imported')
BEGIN
    SET IDENTITY_INSERT dbo.ItemEventType ON;
    INSERT INTO dbo.ItemEventType (Id, Name, Label, Icon, SortOrder)
    VALUES
        (21, 'Imported',  'Imported from file', N'📂', 21),
        (22, 'Enriched',  'Enriched from API',  N'✨', 22),
        (23, 'Edited',    'Manually edited',    N'✏️', 23);
    SET IDENTITY_INSERT dbo.ItemEventType OFF;
END
GO

-- ── Transaction table for item events ───────────────────────────────────────

IF OBJECT_ID('dbo.ItemEvent', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ItemEvent
    (
        Id              UNIQUEIDENTIFIER   NOT NULL DEFAULT NEWID(),
        ItemId          UNIQUEIDENTIFIER   NOT NULL,
        EventTypeId     INT                NOT NULL,
        OccurredUtc     DATETIMEOFFSET     NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        Notes           NVARCHAR(MAX)      NULL,
        DetailJson      NVARCHAR(MAX)      NULL,     -- structured context (e.g. {"shelf":"A3"}, {"lentTo":"John"})
        CreatedUtc      DATETIMEOFFSET     NOT NULL DEFAULT SYSDATETIMEOFFSET(),

        CONSTRAINT PK_ItemEvent PRIMARY KEY (Id),
        CONSTRAINT FK_ItemEvent_LibraryItem FOREIGN KEY (ItemId)
            REFERENCES dbo.LibraryItem (Id) ON DELETE CASCADE,
        CONSTRAINT FK_ItemEvent_EventType FOREIGN KEY (EventTypeId)
            REFERENCES dbo.ItemEventType (Id)
    );

    -- Primary query: "show me everything that happened to this book"
    CREATE NONCLUSTERED INDEX IX_ItemEvent_ItemId_OccurredUtc
        ON dbo.ItemEvent (ItemId, OccurredUtc DESC);

    -- Secondary query: "show me all events of a given type"
    CREATE NONCLUSTERED INDEX IX_ItemEvent_EventTypeId
        ON dbo.ItemEvent (EventTypeId);
END
GO
