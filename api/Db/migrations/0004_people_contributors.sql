set nocount on;
set xact_abort on;

begin transaction;

if schema_id(N'dbo') is null
    exec(N'create schema dbo');

if object_id(N'dbo.People', N'U') is null
begin
    create table dbo.People
    (
        Id uniqueidentifier not null constraint PK_People primary key,
        DisplayName nvarchar(256) not null,
        SortName nvarchar(256) null,
        BirthYear int null,
        DeathYear int null,
        CreatedUtc datetimeoffset(7) not null constraint DF_People_CreatedUtc default (sysdatetimeoffset())
    );

    create index IX_People_DisplayName on dbo.People(DisplayName);
    create index IX_People_SortName on dbo.People(SortName);
end

if object_id(N'dbo.ContributorRoles', N'U') is null
begin
    create table dbo.ContributorRoles
    (
        Id int not null,
        Name nvarchar(64) not null,
        constraint PK_ContributorRoles primary key clustered (Id),
        constraint UX_ContributorRoles_Name unique (Name)
    );

    -- Seed a small standard set. Safe to rerun.
    if not exists (select 1 from dbo.ContributorRoles where Id = 1)
        insert into dbo.ContributorRoles (Id, Name) values (1, N'Author');
    if not exists (select 1 from dbo.ContributorRoles where Id = 2)
        insert into dbo.ContributorRoles (Id, Name) values (2, N'Editor');
    if not exists (select 1 from dbo.ContributorRoles where Id = 3)
        insert into dbo.ContributorRoles (Id, Name) values (3, N'Translator');
    if not exists (select 1 from dbo.ContributorRoles where Id = 4)
        insert into dbo.ContributorRoles (Id, Name) values (4, N'Illustrator');
end

if object_id(N'dbo.WorkContributors', N'U') is null
begin
    create table dbo.WorkContributors
    (
        WorkId uniqueidentifier not null,
        PersonId uniqueidentifier not null,
        RoleId int not null,
        Ordinal int not null,

        constraint PK_WorkContributors primary key clustered (WorkId, PersonId, RoleId),
        constraint FK_WorkContributors_Works_WorkId foreign key (WorkId)
            references dbo.Works(Id)
            on delete cascade,
        constraint FK_WorkContributors_People_PersonId foreign key (PersonId)
            references dbo.People(Id)
            on delete cascade,
        constraint FK_WorkContributors_Roles_RoleId foreign key (RoleId)
            references dbo.ContributorRoles(Id)
            on delete no action
    );

    create unique index UX_WorkContributors_WorkId_RoleId_Ordinal on dbo.WorkContributors(WorkId, RoleId, Ordinal);
    create index IX_WorkContributors_PersonId on dbo.WorkContributors(PersonId);
end

commit transaction;
