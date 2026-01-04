set nocount on;
set xact_abort on;

begin transaction;

if object_id(N'dbo.Items', N'U') is not null
begin
    if col_length('dbo.Items', 'Barcode') is null
        alter table dbo.Items add Barcode nvarchar(64) null;

    if col_length('dbo.Items', 'Location') is null
        alter table dbo.Items add Location nvarchar(200) null;

    if col_length('dbo.Items', 'Status') is null
        alter table dbo.Items add Status nvarchar(50) null;

    if col_length('dbo.Items', 'Condition') is null
        alter table dbo.Items add Condition nvarchar(50) null;

    if col_length('dbo.Items', 'AcquiredOn') is null
        alter table dbo.Items add AcquiredOn date null;

    if col_length('dbo.Items', 'Price') is null
        alter table dbo.Items add Price decimal(10,2) null;

    if not exists (
        select 1
        from sys.indexes
        where object_id = object_id(N'dbo.Items')
          and name = N'UX_Items_OwnerHouseholdId_Barcode'
    )
    begin
        create unique index UX_Items_OwnerHouseholdId_Barcode
            on dbo.Items(OwnerHouseholdId, Barcode)
            where Barcode is not null;
    end
end

commit transaction;
