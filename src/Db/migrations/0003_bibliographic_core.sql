set nocount on;
set xact_abort on;

begin transaction;

if schema_id(N'dbo') is null
    exec(N'create schema dbo');

if object_id(N'dbo.Works', N'U') is null
begin
    create table dbo.Works
    (
        Id uniqueidentifier not null constraint PK_Works primary key,
        Title nvarchar(512) not null,
        Subtitle nvarchar(512) null,
        SortTitle nvarchar(512) null,
        Description nvarchar(max) null,
        CreatedUtc datetimeoffset(7) not null constraint DF_Works_CreatedUtc default (sysdatetimeoffset())
    );

    create index IX_Works_Title on dbo.Works(Title);
end

if object_id(N'dbo.Editions', N'U') is null
begin
    create table dbo.Editions
    (
        Id uniqueidentifier not null constraint PK_Editions primary key,
        WorkId uniqueidentifier not null,

        EditionTitle nvarchar(512) null,
        EditionSubtitle nvarchar(512) null,

        Publisher nvarchar(200) null,
        PublishedYear int null,
        PageCount int null,
        Description nvarchar(max) null,

        CreatedUtc datetimeoffset(7) not null constraint DF_Editions_CreatedUtc default (sysdatetimeoffset()),

        constraint FK_Editions_Works_WorkId foreign key (WorkId)
            references dbo.Works(Id)
            on delete cascade
    );

    create index IX_Editions_WorkId on dbo.Editions(WorkId);
end

if object_id(N'dbo.Items', N'U') is null
begin
    create table dbo.Items
    (
        Id uniqueidentifier not null constraint PK_Items primary key,
        OwnerHouseholdId uniqueidentifier not null,
        Kind int not null,

        WorkId uniqueidentifier not null,
        EditionId uniqueidentifier null,

        Title nvarchar(512) not null,
        Subtitle nvarchar(512) null,

        Notes nvarchar(max) null,
        CreatedUtc datetimeoffset(7) not null constraint DF_Items_CreatedUtc default (sysdatetimeoffset()),

        constraint FK_Items_Households_OwnerHouseholdId
            foreign key (OwnerHouseholdId)
            references dbo.Households(Id)
            on delete cascade,

        constraint FK_Items_Works_WorkId
            foreign key (WorkId)
            references dbo.Works(Id)
            on delete no action,

        constraint FK_Items_Editions_EditionId
            foreign key (EditionId)
            references dbo.Editions(Id)
            on delete set null
    );

    create index IX_Items_OwnerHouseholdId_Kind_Title on dbo.Items(OwnerHouseholdId, Kind, Title);
    create index IX_Items_WorkId on dbo.Items(WorkId);
    create index IX_Items_EditionId on dbo.Items(EditionId);
end

commit transaction;
