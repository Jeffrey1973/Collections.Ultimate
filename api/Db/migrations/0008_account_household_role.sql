-- Add Role column to AccountHousehold for member roles (Owner, Member, ReadOnly)
if col_length('dbo.AccountHousehold', 'Role') is null
begin
    alter table dbo.AccountHousehold
        add Role nvarchar(20) not null
            constraint DF_AccountHousehold_Role default 'Owner';
end
go
