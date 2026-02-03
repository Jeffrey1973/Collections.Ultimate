set nocount on;
set xact_abort on;

begin transaction;

-- Add MetadataJson column to LibraryItem for flexible type-specific attributes
if object_id(N'dbo.LibraryItem', N'U') is not null
begin
    if col_length('dbo.LibraryItem', 'MetadataJson') is null
        alter table dbo.LibraryItem add MetadataJson nvarchar(max) null;
end

commit transaction;
