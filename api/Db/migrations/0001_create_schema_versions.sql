set nocount on;
set xact_abort on;

begin transaction;

if schema_id(N'dbo') is null
    exec(N'create schema dbo');

if object_id(N'dbo.SchemaVersions', N'U') is null
begin
    create table dbo.SchemaVersions
    (
        Version int not null,
        AppliedUtc datetimeoffset(7) not null,
        ScriptName nvarchar(260) not null,
        Checksum varbinary(32) not null,
        constraint PK_SchemaVersions primary key clustered (Version)
    );

    create unique index UX_SchemaVersions_ScriptName on dbo.SchemaVersions(ScriptName);
end

commit transaction;
