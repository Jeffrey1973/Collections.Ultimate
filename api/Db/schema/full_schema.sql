-- ============================================================================
-- Collections Ultimate — Full Schema
-- Generated from LocalDB on 2026-02-13
-- Run against a FRESH, EMPTY database (e.g. Azure SQL Basic tier)
-- ============================================================================

-- ============================================================================
-- 1. LOOKUP / REFERENCE TABLES (no FKs)
-- ============================================================================

CREATE TABLE dbo.ContributorRole (
    Id          INT             NOT NULL,
    Name        NVARCHAR(200)   NOT NULL,
    CONSTRAINT PK_ContributorRole PRIMARY KEY (Id)
);

CREATE TABLE dbo.IdentifierType (
    Id          INT             NOT NULL,
    Name        NVARCHAR(100)   NOT NULL,
    CONSTRAINT PK_IdentifierType PRIMARY KEY (Id)
);

CREATE TABLE dbo.SubjectScheme (
    Id          INT             NOT NULL,
    Name        NVARCHAR(200)   NOT NULL,
    CONSTRAINT PK_SubjectScheme PRIMARY KEY (Id)
);

-- ============================================================================
-- 2. CORE ENTITY TABLES
-- ============================================================================

CREATE TABLE dbo.Household (
    Id          UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
    Name        NVARCHAR(400)    NOT NULL,
    CreatedUtc  DATETIMEOFFSET   NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
    CONSTRAINT PK_Household PRIMARY KEY (Id)
);

CREATE TABLE dbo.Account (
    Id          UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
    DisplayName NVARCHAR(400)    NOT NULL,
    Email       NVARCHAR(640)    NULL,
    CreatedUtc  DATETIMEOFFSET   NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
    Auth0Sub    NVARCHAR(400)    NULL,
    FirstName   NVARCHAR(200)    NULL,
    LastName    NVARCHAR(200)    NULL,
    CONSTRAINT PK_Account PRIMARY KEY (Id)
);

CREATE TABLE dbo.AccountCredential (
    AccountId              UNIQUEIDENTIFIER NOT NULL,
    UserName               NVARCHAR(200)    NOT NULL,
    PasswordHash           VARBINARY(64)    NOT NULL,
    PasswordSalt           VARBINARY(32)    NOT NULL,
    PasswordHashAlgorithm  VARCHAR(50)      NOT NULL DEFAULT ('PBKDF2-SHA256'),
    CreatedUtc             DATETIMEOFFSET   NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
    CONSTRAINT PK_AccountCredential PRIMARY KEY (AccountId),
    CONSTRAINT FK_AccountCredential_Account FOREIGN KEY (AccountId) REFERENCES dbo.Account (Id),
    CONSTRAINT UQ_AccountCredential_UserName UNIQUE (UserName)
);

CREATE TABLE dbo.AccountHousehold (
    AccountId   UNIQUEIDENTIFIER NOT NULL,
    HouseholdId UNIQUEIDENTIFIER NOT NULL,
    CreatedUtc  DATETIMEOFFSET   NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
    Role        NVARCHAR(40)     NOT NULL DEFAULT ('Owner'),
    CONSTRAINT PK_AccountHousehold PRIMARY KEY (AccountId, HouseholdId),
    CONSTRAINT FK_AccountHousehold_Account   FOREIGN KEY (AccountId)   REFERENCES dbo.Account (Id),
    CONSTRAINT FK_AccountHousehold_Household FOREIGN KEY (HouseholdId) REFERENCES dbo.Household (Id)
);

CREATE TABLE dbo.AccountInvitation (
    Id                  UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
    Token               NVARCHAR(200)    NOT NULL,
    Email               NVARCHAR(640)    NOT NULL,
    InvitedByAccountId  UNIQUEIDENTIFIER NULL,
    HouseholdId         UNIQUEIDENTIFIER NULL,
    ExpiresUtc          DATETIMEOFFSET   NOT NULL,
    AcceptedUtc         DATETIMEOFFSET   NULL,
    AcceptedAccountId   UNIQUEIDENTIFIER NULL,
    CreatedUtc          DATETIMEOFFSET   NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
    CONSTRAINT PK_AccountInvitation PRIMARY KEY (Id),
    CONSTRAINT FK_AccountInvitation_InvitedBy FOREIGN KEY (InvitedByAccountId) REFERENCES dbo.Account (Id),
    CONSTRAINT FK_AccountInvitation_Household FOREIGN KEY (HouseholdId)        REFERENCES dbo.Household (Id),
    CONSTRAINT FK_AccountInvitation_Accepted  FOREIGN KEY (AcceptedAccountId)  REFERENCES dbo.Account (Id),
    CONSTRAINT UQ_AccountInvitation_Token UNIQUE (Token)
);

-- ============================================================================
-- 3. BIBLIOGRAPHIC TABLES
-- ============================================================================

CREATE TABLE dbo.Person (
    Id          UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
    DisplayName NVARCHAR(600)    NOT NULL,
    SortName    NVARCHAR(600)    NULL,
    BirthYear   INT              NULL,
    DeathYear   INT              NULL,
    CreatedUtc  DATETIMEOFFSET   NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
    CONSTRAINT PK_Person PRIMARY KEY (Id)
);

CREATE TABLE dbo.Work (
    Id              UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
    Title           NVARCHAR(1000)   NOT NULL,
    Subtitle        NVARCHAR(1000)   NULL,
    SortTitle       NVARCHAR(1000)   NULL,
    Description     NVARCHAR(MAX)    NULL,
    NormalizedTitle NVARCHAR(1000)   NULL,
    CreatedUtc      DATETIMEOFFSET   NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
    OriginalTitle   NVARCHAR(1024)   NULL,
    Language        NVARCHAR(20)     NULL,
    MetadataJson    NVARCHAR(MAX)    NULL,
    CONSTRAINT PK_Work PRIMARY KEY (Id)
);

CREATE TABLE dbo.Edition (
    Id                  UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
    WorkId              UNIQUEIDENTIFIER NOT NULL,
    EditionTitle        NVARCHAR(1000)   NULL,
    EditionSubtitle     NVARCHAR(1000)   NULL,
    Publisher           NVARCHAR(600)    NULL,
    PublishedYear       INT              NULL,
    PageCount           INT              NULL,
    Description         NVARCHAR(MAX)    NULL,
    CreatedUtc          DATETIMEOFFSET   NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
    CoverImageUrl       NVARCHAR(1000)   NULL,
    Format              NVARCHAR(100)    NULL,
    Binding             NVARCHAR(100)    NULL,
    EditionStatement    NVARCHAR(512)    NULL,
    PlaceOfPublication  NVARCHAR(400)    NULL,
    Language            NVARCHAR(20)     NULL,
    MetadataJson        NVARCHAR(MAX)    NULL,
    CONSTRAINT PK_Edition PRIMARY KEY (Id),
    CONSTRAINT FK_Edition_Work FOREIGN KEY (WorkId) REFERENCES dbo.Work (Id)
);

CREATE TABLE dbo.EditionIdentifier (
    EditionId        UNIQUEIDENTIFIER NOT NULL,
    IdentifierTypeId INT              NOT NULL,
    Value            NVARCHAR(400)    NOT NULL,
    NormalizedValue  NVARCHAR(400)    NOT NULL,
    IsPrimary        BIT              NOT NULL DEFAULT (0),
    CONSTRAINT PK_EditionIdentifier PRIMARY KEY (EditionId, IdentifierTypeId, Value),
    CONSTRAINT FK_EditionIdentifier_Edition FOREIGN KEY (EditionId)        REFERENCES dbo.Edition (Id),
    CONSTRAINT FK_EditionIdentifier_Type    FOREIGN KEY (IdentifierTypeId) REFERENCES dbo.IdentifierType (Id)
);

CREATE TABLE dbo.EditionImage (
    Id          UNIQUEIDENTIFIER NOT NULL,
    EditionId   UNIQUEIDENTIFIER NOT NULL,
    ImageSize   NVARCHAR(40)     NOT NULL,
    Url         NVARCHAR(MAX)    NOT NULL,
    Width       INT              NULL,
    Height      INT              NULL,
    CreatedUtc  DATETIMEOFFSET   NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
    CONSTRAINT PK_EditionImage PRIMARY KEY (Id),
    CONSTRAINT FK_EditionImage_Edition FOREIGN KEY (EditionId) REFERENCES dbo.Edition (Id) ON DELETE CASCADE,
    CONSTRAINT UX_EditionImage_EditionId_Size UNIQUE (EditionId, ImageSize)
);
CREATE INDEX IX_EditionImage_EditionId ON dbo.EditionImage (EditionId);

CREATE TABLE dbo.Series (
    Id              UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
    Name            NVARCHAR(1024)   NOT NULL,
    NormalizedName  NVARCHAR(1024)   NOT NULL,
    Description     NVARCHAR(MAX)    NULL,
    CreatedUtc      DATETIMEOFFSET   NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
    CONSTRAINT PK_Series PRIMARY KEY (Id),
    CONSTRAINT UX_Series_NormalizedName UNIQUE (NormalizedName)
);

CREATE TABLE dbo.SubjectHeading (
    Id              UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
    SchemeId        INT              NOT NULL,
    Text            NVARCHAR(4000)   NOT NULL,
    NormalizedText  NVARCHAR(4000)   NOT NULL,
    CreatedUtc      DATETIMEOFFSET   NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
    CONSTRAINT PK_SubjectHeading PRIMARY KEY (Id),
    CONSTRAINT FK_SubjectHeading_Scheme FOREIGN KEY (SchemeId) REFERENCES dbo.SubjectScheme (Id)
);

CREATE TABLE dbo.Tag (
    Id              UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
    HouseholdId     UNIQUEIDENTIFIER NOT NULL,
    Name            NVARCHAR(200)    NOT NULL,
    NormalizedName  NVARCHAR(200)    NOT NULL,
    CreatedUtc      DATETIMEOFFSET   NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
    CONSTRAINT PK_Tag PRIMARY KEY (Id),
    CONSTRAINT FK_Tag_Household FOREIGN KEY (HouseholdId) REFERENCES dbo.Household (Id),
    CONSTRAINT UQ_Tag_Household_Name UNIQUE (HouseholdId, NormalizedName)
);

-- ============================================================================
-- 4. JUNCTION / RELATIONSHIP TABLES
-- ============================================================================

CREATE TABLE dbo.WorkContributor (
    WorkId   UNIQUEIDENTIFIER NOT NULL,
    PersonId UNIQUEIDENTIFIER NOT NULL,
    RoleId   INT              NOT NULL,
    Ordinal  INT              NOT NULL DEFAULT (0),
    CONSTRAINT PK_WorkContributor PRIMARY KEY (WorkId, PersonId, RoleId),
    CONSTRAINT FK_WorkContributor_Work   FOREIGN KEY (WorkId)   REFERENCES dbo.Work (Id),
    CONSTRAINT FK_WorkContributor_Person FOREIGN KEY (PersonId) REFERENCES dbo.Person (Id),
    CONSTRAINT FK_WorkContributor_Role   FOREIGN KEY (RoleId)   REFERENCES dbo.ContributorRole (Id)
);

CREATE TABLE dbo.WorkSeries (
    WorkId       UNIQUEIDENTIFIER NOT NULL,
    SeriesId     UNIQUEIDENTIFIER NOT NULL,
    VolumeNumber NVARCHAR(100)    NULL,
    Ordinal      INT              NULL,
    CONSTRAINT PK_WorkSeries PRIMARY KEY (WorkId, SeriesId),
    CONSTRAINT FK_WorkSeries_Work   FOREIGN KEY (WorkId)   REFERENCES dbo.Work (Id)   ON DELETE CASCADE,
    CONSTRAINT FK_WorkSeries_Series FOREIGN KEY (SeriesId) REFERENCES dbo.Series (Id) ON DELETE CASCADE
);
CREATE INDEX IX_WorkSeries_SeriesId ON dbo.WorkSeries (SeriesId);

CREATE TABLE dbo.WorkSubject (
    WorkId           UNIQUEIDENTIFIER NOT NULL,
    SubjectHeadingId UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT PK_WorkSubject PRIMARY KEY (WorkId, SubjectHeadingId),
    CONSTRAINT FK_WorkSubject_Work    FOREIGN KEY (WorkId)           REFERENCES dbo.Work (Id),
    CONSTRAINT FK_WorkSubject_Subject FOREIGN KEY (SubjectHeadingId) REFERENCES dbo.SubjectHeading (Id)
);

CREATE TABLE dbo.WorkTag (
    WorkId UNIQUEIDENTIFIER NOT NULL,
    TagId  UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT PK_WorkTag PRIMARY KEY (WorkId, TagId),
    CONSTRAINT FK_WorkTag_Work FOREIGN KEY (WorkId) REFERENCES dbo.Work (Id),
    CONSTRAINT FK_WorkTag_Tag  FOREIGN KEY (TagId)  REFERENCES dbo.Tag (Id)
);

-- ============================================================================
-- 5. LIBRARY ITEM (the user's physical/owned item)
-- ============================================================================

CREATE TABLE dbo.LibraryItem (
    Id            UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
    HouseholdId   UNIQUEIDENTIFIER NOT NULL,
    Kind          INT              NOT NULL DEFAULT (1),
    WorkId        UNIQUEIDENTIFIER NOT NULL,
    EditionId     UNIQUEIDENTIFIER NULL,
    Title         NVARCHAR(1000)   NOT NULL,
    Subtitle      NVARCHAR(1000)   NULL,
    Notes         NVARCHAR(MAX)    NULL,
    Barcode       NVARCHAR(200)    NULL,
    Location      NVARCHAR(400)    NULL,
    Status        NVARCHAR(100)    NULL,
    Condition     NVARCHAR(100)    NULL,
    AcquiredOn    DATE             NULL,
    Price         DECIMAL(10,2)    NULL,
    CreatedUtc    DATETIMEOFFSET   NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
    MetadataJson  NVARCHAR(MAX)    NULL,
    ReadStatus    NVARCHAR(100)    NULL,
    CompletedDate NVARCHAR(100)    NULL,
    DateStarted   NVARCHAR(100)    NULL,
    UserRating    DECIMAL(5,2)     NULL,
    LibraryOrder  INT              NULL,
    CustomCoverUrl NVARCHAR(1000)  NULL,
    CONSTRAINT PK_LibraryItem PRIMARY KEY (Id),
    CONSTRAINT FK_LibraryItem_Household FOREIGN KEY (HouseholdId) REFERENCES dbo.Household (Id),
    CONSTRAINT FK_LibraryItem_Work      FOREIGN KEY (WorkId)      REFERENCES dbo.Work (Id),
    CONSTRAINT FK_LibraryItem_Edition   FOREIGN KEY (EditionId)   REFERENCES dbo.Edition (Id)
);
CREATE INDEX IX_LibraryItem_HouseholdId ON dbo.LibraryItem (HouseholdId);
CREATE INDEX IX_LibraryItem_Barcode     ON dbo.LibraryItem (Barcode);

-- ============================================================================
-- 6. IMPORT TABLES
-- ============================================================================

CREATE TABLE dbo.ImportBatch (
    Id            UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
    HouseholdId   UNIQUEIDENTIFIER NOT NULL,
    FileName      NVARCHAR(1000)   NULL,
    Status        NVARCHAR(100)    NOT NULL DEFAULT ('Pending'),
    TotalRows     INT              NULL,
    ProcessedRows INT              NULL,
    SuccessRows   INT              NULL,
    FailedRows    INT              NULL,
    StartedUtc    DATETIMEOFFSET   NULL,
    CompletedUtc  DATETIMEOFFSET   NULL,
    CreatedUtc    DATETIMEOFFSET   NOT NULL DEFAULT (SYSDATETIMEOFFSET()),
    CONSTRAINT PK_ImportBatch PRIMARY KEY (Id),
    CONSTRAINT FK_ImportBatch_Household FOREIGN KEY (HouseholdId) REFERENCES dbo.Household (Id)
);

CREATE TABLE dbo.ImportRow (
    Id            UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWID()),
    BatchId       UNIQUEIDENTIFIER NOT NULL,
    RowNumber     INT              NOT NULL,
    Status        NVARCHAR(100)    NOT NULL DEFAULT ('Pending'),
    RawData       NVARCHAR(MAX)    NULL,
    ErrorMessage  NVARCHAR(MAX)    NULL,
    CreatedItemId UNIQUEIDENTIFIER NULL,
    ProcessedUtc  DATETIMEOFFSET   NULL,
    CONSTRAINT PK_ImportRow PRIMARY KEY (Id),
    CONSTRAINT FK_ImportRow_Batch FOREIGN KEY (BatchId) REFERENCES dbo.ImportBatch (Id)
);

-- ============================================================================
-- 7. SEED DATA — Lookup tables
-- ============================================================================

INSERT INTO dbo.ContributorRole (Id, Name) VALUES
    (1,  'Author'),
    (2,  'Editor'),
    (3,  'Illustrator'),
    (4,  'Translator'),
    (5,  'Narrator'),
    (6,  'Contributor'),
    (7,  'Foreword'),
    (8,  'Afterword'),
    (9,  'Photographer'),
    (10, 'Designer'),
    (11, 'Contributor');

INSERT INTO dbo.IdentifierType (Id, Name) VALUES
    (1,  'ISBN-10'),
    (2,  'ISBN-13'),
    (3,  'ASIN'),
    (4,  'OCLC'),
    (5,  'LCCN'),
    (7,  'ISSN'),
    (8,  'OCLC'),
    (9,  'OCLCWork'),
    (10, 'DOI'),
    (11, 'GoogleBooks'),
    (12, 'Goodreads'),
    (13, 'LibraryThing'),
    (14, 'OpenLibrary'),
    (15, 'DNB'),
    (16, 'BNF'),
    (17, 'NLA'),
    (18, 'NDL'),
    (19, 'LAC'),
    (20, 'BL');

INSERT INTO dbo.SubjectScheme (Id, Name) VALUES
    (1, 'LCSH'),
    (2, 'BISAC'),
    (3, 'Custom'),
    (4, 'LCC'),
    (5, 'BISAC'),
    (6, 'Thema'),
    (7, 'FAST');

-- ── Item Event Log ──────────────────────────────────────────────────────────

CREATE TABLE dbo.ItemEventType (
    Id          INT            NOT NULL IDENTITY(1,1),
    Name        NVARCHAR(50)   NOT NULL,
    Label       NVARCHAR(100)  NOT NULL,
    Icon        NVARCHAR(10)   NULL,
    SortOrder   INT            NOT NULL DEFAULT 0,
    CONSTRAINT PK_ItemEventType PRIMARY KEY (Id),
    CONSTRAINT UQ_ItemEventType_Name UNIQUE (Name)
);

CREATE TABLE dbo.ItemEvent (
    Id              UNIQUEIDENTIFIER   NOT NULL DEFAULT NEWID(),
    ItemId          UNIQUEIDENTIFIER   NOT NULL,
    EventTypeId     INT                NOT NULL,
    OccurredUtc     DATETIMEOFFSET     NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    Notes           NVARCHAR(MAX)      NULL,
    DetailJson      NVARCHAR(MAX)      NULL,
    CreatedUtc      DATETIMEOFFSET     NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT PK_ItemEvent PRIMARY KEY (Id),
    CONSTRAINT FK_ItemEvent_LibraryItem FOREIGN KEY (ItemId)
        REFERENCES dbo.LibraryItem (Id) ON DELETE CASCADE,
    CONSTRAINT FK_ItemEvent_EventType FOREIGN KEY (EventTypeId)
        REFERENCES dbo.ItemEventType (Id)
);

CREATE NONCLUSTERED INDEX IX_ItemEvent_ItemId_OccurredUtc
    ON dbo.ItemEvent (ItemId, OccurredUtc DESC);

CREATE NONCLUSTERED INDEX IX_ItemEvent_EventTypeId
    ON dbo.ItemEvent (EventTypeId);

SET IDENTITY_INSERT dbo.ItemEventType ON;
INSERT INTO dbo.ItemEventType (Id, Name, Label, Icon, SortOrder) VALUES
    ( 1, 'Acquired',        'Acquired',                 N'📥',  1),
    ( 2, 'Shelved',         'Placed on shelf',          N'📚',  2),
    ( 3, 'Moved',           'Moved to different shelf',  N'🔀',  3),
    ( 4, 'StartedReading',  'Started reading',          N'📖',  4),
    ( 5, 'FinishedReading', 'Finished reading',         N'✅',  5),
    ( 6, 'Lent',            'Lent out',                 N'🤝',  6),
    ( 7, 'Returned',        'Returned',                 N'↩️',  7),
    ( 8, 'Sold',            'Sold',                     N'💲',  8),
    ( 9, 'Gifted',          'Gifted',                   N'🎁',  9),
    (10, 'Destroyed',       'Destroyed / discarded',    N'🗑️', 10),
    (11, 'Lost',            'Lost',                     N'❓',  11),
    (12, 'Damaged',         'Damaged',                  N'💥',  12),
    (13, 'Repaired',        'Repaired',                 N'🔧',  13),
    (14, 'Rated',           'Rated',                    N'⭐',  14),
    (15, 'Reviewed',        'Reviewed / noted',         N'📝',  15),
    (16, 'CoverUploaded',   'Cover photo uploaded',     N'📷',  16),
    (17, 'MetadataUpdated', 'Metadata updated',         N'🔄',  17),
    (18, 'Donated',         'Donated',                  N'❤️',  18),
    (19, 'StatusChanged',   'Status changed',           N'🏷️',  19),
    (20, 'Custom',          'Custom event',             N'📋',  20),
    (21, 'Imported',        'Imported from file',       N'📂',  21),
    (22, 'Enriched',        'Enriched from API',        N'✨',  22),
    (23, 'Edited',          'Manually edited',          N'✏️',  23),
    (24, 'InventoryVerified','Inventory verified',      N'✔️',  24);
SET IDENTITY_INSERT dbo.ItemEventType OFF;

PRINT '=== Schema creation complete ===';
GO
