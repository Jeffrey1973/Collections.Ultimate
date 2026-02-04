-- Migration: Extended Book Schema for Frontend Fields
-- Adds ~180 book fields across Work, Edition, and Item tables
-- Uses JSONB (nvarchar(max) with JSON) for flexible metadata storage

set nocount on;
set xact_abort on;

begin transaction;

-- =============================================================================
-- WORK TABLE: Extended fields for intellectual work metadata
-- =============================================================================

if object_id(N'dbo.Works', N'U') is not null
begin
    -- Original title (for translations)
    if col_length('dbo.Works', 'OriginalTitle') is null
        alter table dbo.Works add OriginalTitle nvarchar(512) null;

    -- Language code (ISO 639-1, e.g., 'en', 'de', 'la')
    if col_length('dbo.Works', 'Language') is null
        alter table dbo.Works add Language nvarchar(10) null;

    -- Extended metadata as JSON for flexible storage
    if col_length('dbo.Works', 'MetadataJson') is null
        alter table dbo.Works add MetadataJson nvarchar(max) null;
end

-- =============================================================================
-- EDITION TABLE: Extended fields for publication details
-- =============================================================================

if object_id(N'dbo.Editions', N'U') is not null
begin
    -- Format: Hardcover, Paperback, eBook, Audiobook
    if col_length('dbo.Editions', 'Format') is null
        alter table dbo.Editions add Format nvarchar(50) null;

    -- Binding type: Hardcover, Paperback, Mass Market, Library Binding
    if col_length('dbo.Editions', 'Binding') is null
        alter table dbo.Editions add Binding nvarchar(50) null;

    -- Edition statement (e.g., "2nd ed.", "Revised edition")
    if col_length('dbo.Editions', 'EditionStatement') is null
        alter table dbo.Editions add EditionStatement nvarchar(256) null;

    -- Place of publication
    if col_length('dbo.Editions', 'PlaceOfPublication') is null
        alter table dbo.Editions add PlaceOfPublication nvarchar(200) null;

    -- Language of this specific edition
    if col_length('dbo.Editions', 'Language') is null
        alter table dbo.Editions add Language nvarchar(10) null;

    -- Extended metadata as JSON for flexible storage
    if col_length('dbo.Editions', 'MetadataJson') is null
        alter table dbo.Editions add MetadataJson nvarchar(max) null;
end

-- =============================================================================
-- ITEMS TABLE: Extended fields for physical/digital copies
-- =============================================================================

if object_id(N'dbo.Items', N'U') is not null
begin
    -- MetadataJson already exists from migration 0012, but ensure it's there
    if col_length('dbo.Items', 'MetadataJson') is null
        alter table dbo.Items add MetadataJson nvarchar(max) null;
end

-- Also check LibraryItem table if it exists separately
if object_id(N'dbo.LibraryItem', N'U') is not null
begin
    if col_length('dbo.LibraryItem', 'MetadataJson') is null
        alter table dbo.LibraryItem add MetadataJson nvarchar(max) null;
end

-- =============================================================================
-- IDENTIFIER TYPES: Expand to support all frontend identifiers
-- =============================================================================

if object_id(N'dbo.IdentifierTypes', N'U') is not null
begin
    -- Add new identifier types (continue from existing 1-6)
    if not exists (select 1 from dbo.IdentifierTypes where Id = 7)
        insert into dbo.IdentifierTypes (Id, Name) values (7, N'ISSN');
    if not exists (select 1 from dbo.IdentifierTypes where Id = 8)
        insert into dbo.IdentifierTypes (Id, Name) values (8, N'OCLC');
    if not exists (select 1 from dbo.IdentifierTypes where Id = 9)
        insert into dbo.IdentifierTypes (Id, Name) values (9, N'OCLCWork');
    if not exists (select 1 from dbo.IdentifierTypes where Id = 10)
        insert into dbo.IdentifierTypes (Id, Name) values (10, N'DOI');
    if not exists (select 1 from dbo.IdentifierTypes where Id = 11)
        insert into dbo.IdentifierTypes (Id, Name) values (11, N'GoogleBooks');
    if not exists (select 1 from dbo.IdentifierTypes where Id = 12)
        insert into dbo.IdentifierTypes (Id, Name) values (12, N'Goodreads');
    if not exists (select 1 from dbo.IdentifierTypes where Id = 13)
        insert into dbo.IdentifierTypes (Id, Name) values (13, N'LibraryThing');
    if not exists (select 1 from dbo.IdentifierTypes where Id = 14)
        insert into dbo.IdentifierTypes (Id, Name) values (14, N'OpenLibrary');
    if not exists (select 1 from dbo.IdentifierTypes where Id = 15)
        insert into dbo.IdentifierTypes (Id, Name) values (15, N'DNB');
    if not exists (select 1 from dbo.IdentifierTypes where Id = 16)
        insert into dbo.IdentifierTypes (Id, Name) values (16, N'BNF');
    if not exists (select 1 from dbo.IdentifierTypes where Id = 17)
        insert into dbo.IdentifierTypes (Id, Name) values (17, N'NLA');
    if not exists (select 1 from dbo.IdentifierTypes where Id = 18)
        insert into dbo.IdentifierTypes (Id, Name) values (18, N'NDL');
    if not exists (select 1 from dbo.IdentifierTypes where Id = 19)
        insert into dbo.IdentifierTypes (Id, Name) values (19, N'LAC');
    if not exists (select 1 from dbo.IdentifierTypes where Id = 20)
        insert into dbo.IdentifierTypes (Id, Name) values (20, N'BL');
end

-- =============================================================================
-- CONTRIBUTOR ROLES: Expand to support all frontend contributor types
-- =============================================================================

if object_id(N'dbo.ContributorRoles', N'U') is not null
begin
    -- Add new contributor roles (continue from existing 1-4)
    if not exists (select 1 from dbo.ContributorRoles where Id = 5)
        insert into dbo.ContributorRoles (Id, Name) values (5, N'Narrator');
    if not exists (select 1 from dbo.ContributorRoles where Id = 6)
        insert into dbo.ContributorRoles (Id, Name) values (6, N'Introduction');
    if not exists (select 1 from dbo.ContributorRoles where Id = 7)
        insert into dbo.ContributorRoles (Id, Name) values (7, N'Foreword');
    if not exists (select 1 from dbo.ContributorRoles where Id = 8)
        insert into dbo.ContributorRoles (Id, Name) values (8, N'Afterword');
    if not exists (select 1 from dbo.ContributorRoles where Id = 9)
        insert into dbo.ContributorRoles (Id, Name) values (9, N'Photographer');
    if not exists (select 1 from dbo.ContributorRoles where Id = 10)
        insert into dbo.ContributorRoles (Id, Name) values (10, N'Designer');
    if not exists (select 1 from dbo.ContributorRoles where Id = 11)
        insert into dbo.ContributorRoles (Id, Name) values (11, N'Contributor');
end

-- =============================================================================
-- SUBJECT SCHEMES: Add classification systems
-- =============================================================================

if object_id(N'dbo.SubjectSchemes', N'U') is not null
begin
    -- Add new subject schemes (continue from existing 1-2)
    if not exists (select 1 from dbo.SubjectSchemes where Id = 3)
        insert into dbo.SubjectSchemes (Id, Name) values (3, N'DDC');  -- Dewey Decimal
    if not exists (select 1 from dbo.SubjectSchemes where Id = 4)
        insert into dbo.SubjectSchemes (Id, Name) values (4, N'LCC');  -- Library of Congress Classification
    if not exists (select 1 from dbo.SubjectSchemes where Id = 5)
        insert into dbo.SubjectSchemes (Id, Name) values (5, N'BISAC');
    if not exists (select 1 from dbo.SubjectSchemes where Id = 6)
        insert into dbo.SubjectSchemes (Id, Name) values (6, N'Thema');
    if not exists (select 1 from dbo.SubjectSchemes where Id = 7)
        insert into dbo.SubjectSchemes (Id, Name) values (7, N'FAST');
end

-- =============================================================================
-- SERIES TABLE: Track book series information
-- =============================================================================

if object_id(N'dbo.Series', N'U') is null
begin
    create table dbo.Series
    (
        Id uniqueidentifier not null constraint PK_Series primary key,
        Name nvarchar(512) not null,
        NormalizedName nvarchar(512) not null,
        Description nvarchar(max) null,
        CreatedUtc datetimeoffset(7) not null constraint DF_Series_CreatedUtc default (sysdatetimeoffset())
    );

    create unique index UX_Series_NormalizedName on dbo.Series(NormalizedName);
end

-- =============================================================================
-- WORK SERIES: Link works to series with volume number
-- =============================================================================

if object_id(N'dbo.WorkSeries', N'U') is null
begin
    create table dbo.WorkSeries
    (
        WorkId uniqueidentifier not null,
        SeriesId uniqueidentifier not null,
        VolumeNumber nvarchar(50) null,
        Ordinal int null,

        constraint PK_WorkSeries primary key clustered (WorkId, SeriesId),
        constraint FK_WorkSeries_Works_WorkId foreign key (WorkId)
            references dbo.Works(Id)
            on delete cascade,
        constraint FK_WorkSeries_Series_SeriesId foreign key (SeriesId)
            references dbo.Series(Id)
            on delete cascade
    );

    create index IX_WorkSeries_SeriesId on dbo.WorkSeries(SeriesId);
end

-- =============================================================================
-- COVER IMAGES: Extended image support (multiple sizes)
-- =============================================================================

if object_id(N'dbo.EditionImages', N'U') is null
begin
    create table dbo.EditionImages
    (
        Id uniqueidentifier not null constraint PK_EditionImages primary key,
        EditionId uniqueidentifier not null,
        ImageSize nvarchar(20) not null,  -- 'thumbnail', 'small', 'medium', 'large', 'extraLarge'
        Url nvarchar(2048) not null,
        Width int null,
        Height int null,
        CreatedUtc datetimeoffset(7) not null constraint DF_EditionImages_CreatedUtc default (sysdatetimeoffset()),

        constraint FK_EditionImages_Editions_EditionId foreign key (EditionId)
            references dbo.Editions(Id)
            on delete cascade
    );

    create index IX_EditionImages_EditionId on dbo.EditionImages(EditionId);
    create unique index UX_EditionImages_EditionId_ImageSize on dbo.EditionImages(EditionId, ImageSize);
end

commit transaction;
