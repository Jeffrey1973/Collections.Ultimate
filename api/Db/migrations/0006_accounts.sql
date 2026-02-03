set nocount on;
set xact_abort on;

begin transaction;

if schema_id(N'dbo') is null
    exec(N'create schema dbo');

if object_id(N'dbo.Accounts', N'U') is null
begin
    create table dbo.Accounts
    (
        Id uniqueidentifier not null constraint PK_Accounts primary key,
        DisplayName nvarchar(200) not null,
        Email nvarchar(320) null,
        CreatedUtc datetimeoffset(7) not null constraint DF_Accounts_CreatedUtc default (sysdatetimeoffset())
    );

    create unique index UX_Accounts_Email on dbo.Accounts(Email) where Email is not null;
end

if object_id(N'dbo.AccountHouseholds', N'U') is null
begin
    create table dbo.AccountHouseholds
    (
        AccountId uniqueidentifier not null,
        HouseholdId uniqueidentifier not null,
        CreatedUtc datetimeoffset(7) not null constraint DF_AccountHouseholds_CreatedUtc default (sysdatetimeoffset()),

        constraint PK_AccountHouseholds primary key clustered (AccountId, HouseholdId),
        constraint FK_AccountHouseholds_Accounts_AccountId foreign key (AccountId)
            references dbo.Accounts(Id)
            on delete cascade,
        constraint FK_AccountHouseholds_Households_HouseholdId foreign key (HouseholdId)
            references dbo.Households(Id)
            on delete cascade
    );

    create index IX_AccountHouseholds_HouseholdId on dbo.AccountHouseholds(HouseholdId);
end

commit transaction;
