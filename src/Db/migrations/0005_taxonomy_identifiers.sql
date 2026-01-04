set nocount on;
set xact_abort on;

begin transaction;

if schema_id(N'dbo') is null
    exec(N'create schema dbo');

-- Per-household free-form tags
if object_id(N'dbo.Tags', N'U') is null
begin
    create table dbo.Tags
    (
        Id uniqueidentifier not null constraint PK_Tags primary key,
        OwnerHouseholdId uniqueidentifier not null,
        Name nvarchar(128) not null,
        NormalizedName nvarchar(128) not null,
        CreatedUtc datetimeoffset(7) not null constraint DF_Tags_CreatedUtc default (sysdatetimeoffset()),

        constraint FK_Tags_Households_OwnerHouseholdId
            foreign key (OwnerHouseholdId)
            references dbo.Households(Id)
            on delete cascade
    );

    create unique index UX_Tags_OwnerHouseholdId_NormalizedName on dbo.Tags(OwnerHouseholdId, NormalizedName);
end

if object_id(N'dbo.WorkTags', N'U') is null
begin
    create table dbo.WorkTags
    (
        WorkId uniqueidentifier not null,
        TagId uniqueidentifier not null,

        constraint PK_WorkTags primary key clustered (WorkId, TagId),
        constraint FK_WorkTags_Works_WorkId foreign key (WorkId)
            references dbo.Works(Id)
            on delete cascade,
        constraint FK_WorkTags_Tags_TagId foreign key (TagId)
            references dbo.Tags(Id)
            on delete cascade
    );

    create index IX_WorkTags_TagId on dbo.WorkTags(TagId);
end

-- Controlled subjects (scheme + heading)
if object_id(N'dbo.SubjectSchemes', N'U') is null
begin
    create table dbo.SubjectSchemes
    (
        Id int not null,
        Name nvarchar(64) not null,
        constraint PK_SubjectSchemes primary key clustered (Id),
        constraint UX_SubjectSchemes_Name unique (Name)
    );

    -- Basic starting schemes
    if not exists (select 1 from dbo.SubjectSchemes where Id = 1)
        insert into dbo.SubjectSchemes (Id, Name) values (1, N'Local');
    if not exists (select 1 from dbo.SubjectSchemes where Id = 2)
        insert into dbo.SubjectSchemes (Id, Name) values (2, N'LCSH');
end

if object_id(N'dbo.SubjectHeadings', N'U') is null
begin
    create table dbo.SubjectHeadings
    (
        Id uniqueidentifier not null constraint PK_SubjectHeadings primary key,
        SchemeId int not null,
        Text nvarchar(512) not null,
        NormalizedText nvarchar(512) not null,
        CreatedUtc datetimeoffset(7) not null constraint DF_SubjectHeadings_CreatedUtc default (sysdatetimeoffset()),

        constraint FK_SubjectHeadings_Schemes_SchemeId foreign key (SchemeId)
            references dbo.SubjectSchemes(Id)
            on delete no action
    );

    create unique index UX_SubjectHeadings_SchemeId_NormalizedText on dbo.SubjectHeadings(SchemeId, NormalizedText);
end

if object_id(N'dbo.WorkSubjects', N'U') is null
begin
    create table dbo.WorkSubjects
    (
        WorkId uniqueidentifier not null,
        SubjectHeadingId uniqueidentifier not null,

        constraint PK_WorkSubjects primary key clustered (WorkId, SubjectHeadingId),
        constraint FK_WorkSubjects_Works_WorkId foreign key (WorkId)
            references dbo.Works(Id)
            on delete cascade,
        constraint FK_WorkSubjects_SubjectHeadings_SubjectHeadingId foreign key (SubjectHeadingId)
            references dbo.SubjectHeadings(Id)
            on delete cascade
    );

    create index IX_WorkSubjects_SubjectHeadingId on dbo.WorkSubjects(SubjectHeadingId);
end

-- Edition identifiers (ISBN, ASIN, etc.)
if object_id(N'dbo.IdentifierTypes', N'U') is null
begin
    create table dbo.IdentifierTypes
    (
        Id int not null,
        Name nvarchar(64) not null,
        constraint PK_IdentifierTypes primary key clustered (Id),
        constraint UX_IdentifierTypes_Name unique (Name)
    );

    if not exists (select 1 from dbo.IdentifierTypes where Id = 1)
        insert into dbo.IdentifierTypes (Id, Name) values (1, N'ISBN10');
    if not exists (select 1 from dbo.IdentifierTypes where Id = 2)
        insert into dbo.IdentifierTypes (Id, Name) values (2, N'ISBN13');
    if not exists (select 1 from dbo.IdentifierTypes where Id = 3)
        insert into dbo.IdentifierTypes (Id, Name) values (3, N'ASIN');
    if not exists (select 1 from dbo.IdentifierTypes where Id = 4)
        insert into dbo.IdentifierTypes (Id, Name) values (4, N'LCCN');
    if not exists (select 1 from dbo.IdentifierTypes where Id = 5)
        insert into dbo.IdentifierTypes (Id, Name) values (5, N'EAN');
    if not exists (select 1 from dbo.IdentifierTypes where Id = 6)
        insert into dbo.IdentifierTypes (Id, Name) values (6, N'UPC');
end

if object_id(N'dbo.EditionIdentifiers', N'U') is null
begin
    create table dbo.EditionIdentifiers
    (
        EditionId uniqueidentifier not null,
        IdentifierTypeId int not null,
        Value nvarchar(64) not null,
        NormalizedValue nvarchar(64) not null,
        IsPrimary bit not null constraint DF_EditionIdentifiers_IsPrimary default (0),

        constraint PK_EditionIdentifiers primary key clustered (EditionId, IdentifierTypeId, NormalizedValue),
        constraint FK_EditionIdentifiers_Editions_EditionId foreign key (EditionId)
            references dbo.Editions(Id)
            on delete cascade,
        constraint FK_EditionIdentifiers_Types_IdentifierTypeId foreign key (IdentifierTypeId)
            references dbo.IdentifierTypes(Id)
            on delete no action
    );

    create index IX_EditionIdentifiers_NormalizedValue on dbo.EditionIdentifiers(IdentifierTypeId, NormalizedValue);
end

commit transaction;
