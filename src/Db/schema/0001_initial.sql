/*
  Collections.Ultimate - Initial SQL Server schema

  This schema matches the current Dapper repositories:
  - `HouseholdRepository` expects: dbo.Households(Id, Name)
  - `BookRepository` expects: dbo.Books(
        Id, OwnerHouseholdId, Title, Subtitle, Notes, CreatedUtc,
        Isbn10, Isbn13, Authors, PublishedYear, Publisher
    )

  Notes:
  - Uses `datetimeoffset(7)` for `CreatedUtc` to match .NET `DateTimeOffset`.
  - Keeps string columns as `nvarchar` to support international titles/authors.
*/

set nocount on;
set xact_abort on;

go

begin transaction;

-- Ensure dbo schema exists (normally does).
if schema_id(N'dbo') is null
    exec(N'create schema dbo');

go

if object_id(N'dbo.Households', N'U') is null
begin
    create table dbo.Households
    (
        Id uniqueidentifier not null,
        Name nvarchar(200) not null,

        constraint PK_Households primary key clustered (Id)
    );

    create unique index UX_Households_Name on dbo.Households(Name);
end

go

if object_id(N'dbo.Books', N'U') is null
begin
    create table dbo.Books
    (
        Id uniqueidentifier not null,
        OwnerHouseholdId uniqueidentifier not null,

        Title nvarchar(500) not null,
        Subtitle nvarchar(500) null,
        Notes nvarchar(max) null,
        CreatedUtc datetimeoffset(7) not null,

        Isbn10 varchar(10) null,
        Isbn13 varchar(13) null,
        Authors nvarchar(500) null,
        PublishedYear int null,
        Publisher nvarchar(200) null,

        constraint PK_Books primary key clustered (Id),
        constraint FK_Books_Households foreign key (OwnerHouseholdId)
            references dbo.Households(Id)
    );

    create index IX_Books_OwnerHouseholdId_Title on dbo.Books(OwnerHouseholdId, Title);
    create index IX_Books_OwnerHouseholdId_Authors on dbo.Books(OwnerHouseholdId, Authors);
    create index IX_Books_OwnerHouseholdId_Isbn10 on dbo.Books(OwnerHouseholdId, Isbn10);
    create index IX_Books_OwnerHouseholdId_Isbn13 on dbo.Books(OwnerHouseholdId, Isbn13);
end

go

commit transaction;

go
