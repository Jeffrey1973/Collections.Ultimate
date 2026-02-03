set nocount on;
set xact_abort on;

begin transaction;

if object_id(N'dbo.ImportRecords', N'U') is not null
begin
    if col_length('dbo.ImportRecords', 'WorkId') is null
        alter table dbo.ImportRecords add WorkId uniqueidentifier null;

    if col_length('dbo.ImportRecords', 'EditionId') is null
        alter table dbo.ImportRecords add EditionId uniqueidentifier null;

    if col_length('dbo.ImportRecords', 'ItemId') is null
        alter table dbo.ImportRecords add ItemId uniqueidentifier null;

    if col_length('dbo.ImportRecords', 'ProcessedUtc') is null
        alter table dbo.ImportRecords add ProcessedUtc datetimeoffset(7) null;

    if not exists (
        select 1 from sys.indexes
        where object_id = object_id(N'dbo.ImportRecords')
          and name = N'IX_ImportRecords_BatchId_ProcessedUtc'
    )
    begin
        create index IX_ImportRecords_BatchId_ProcessedUtc
            on dbo.ImportRecords(BatchId, ProcessedUtc);
    end
end

commit transaction;
