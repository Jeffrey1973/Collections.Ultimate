set nocount on;
set xact_abort on;

begin transaction;

if schema_id(N'dbo') is null
    exec(N'create schema dbo');

if object_id(N'dbo.ImportBatches', N'U') is null
begin
    create table dbo.ImportBatches
    (
        Id uniqueidentifier not null constraint PK_ImportBatches primary key,
        OwnerHouseholdId uniqueidentifier not null,
        Source nvarchar(64) not null,
        FileName nvarchar(260) null,
        StartedUtc datetimeoffset(7) not null constraint DF_ImportBatches_StartedUtc default (sysdatetimeoffset()),
        FinishedUtc datetimeoffset(7) null,
        Status nvarchar(32) not null,

        constraint FK_ImportBatches_Households_OwnerHouseholdId
            foreign key (OwnerHouseholdId)
            references dbo.Households(Id)
            on delete cascade
    );

    create index IX_ImportBatches_OwnerHouseholdId_StartedUtc on dbo.ImportBatches(OwnerHouseholdId, StartedUtc);
end

if object_id(N'dbo.ImportRecords', N'U') is null
begin
    create table dbo.ImportRecords
    (
        Id uniqueidentifier not null constraint PK_ImportRecords primary key,
        BatchId uniqueidentifier not null,
        ExternalId nvarchar(128) null,
        PayloadJson nvarchar(max) not null,
        PayloadSha256 varbinary(32) not null,
        CreatedUtc datetimeoffset(7) not null constraint DF_ImportRecords_CreatedUtc default (sysdatetimeoffset()),
        Status nvarchar(32) not null,
        Error nvarchar(max) null,

        constraint FK_ImportRecords_ImportBatches_BatchId
            foreign key (BatchId)
            references dbo.ImportBatches(Id)
            on delete cascade
    );

    create index IX_ImportRecords_BatchId on dbo.ImportRecords(BatchId);
    create index IX_ImportRecords_BatchId_Status on dbo.ImportRecords(BatchId, Status);
    create index IX_ImportRecords_ExternalId on dbo.ImportRecords(ExternalId);

    -- Prevent accidental duplicate rows for the same batch + external id when present.
    create unique index UX_ImportRecords_BatchId_ExternalId
        on dbo.ImportRecords(BatchId, ExternalId)
        where ExternalId is not null;
end

commit transaction;
