-- Collections.Ultimate local development schema
-- Target: SQL Server (LocalDB)

set nocount on;

if schema_id('dbo') is null
begin
    exec('create schema dbo');
end

if object_id('dbo.Households', 'U') is null
begin
    create table dbo.Households
    (
        Id uniqueidentifier not null constraint PK_Households primary key,
        Name nvarchar(200) not null
    );

    create unique index UX_Households_Name on dbo.Households (Name);
end

if object_id('dbo.Books', 'U') is null
begin
    create table dbo.Books
    (
        Id uniqueidentifier not null constraint PK_Books primary key,
        OwnerHouseholdId uniqueidentifier not null,
        Title nvarchar(400) not null,
        Subtitle nvarchar(400) null,
        Notes nvarchar(max) null,
        CreatedUtc datetimeoffset(7) not null,
        Isbn10 nvarchar(20) null,
        Isbn13 nvarchar(20) null,
        Authors nvarchar(400) null,
        PublishedYear int null,
        Publisher nvarchar(200) null,

        constraint FK_Books_Households_OwnerHouseholdId
            foreign key (OwnerHouseholdId)
            references dbo.Households (Id)
            on delete cascade
    );

    create index IX_Books_OwnerHouseholdId on dbo.Books (OwnerHouseholdId);
    create index IX_Books_Title on dbo.Books (Title);
end
