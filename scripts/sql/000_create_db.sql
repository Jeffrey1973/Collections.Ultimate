-- Creates the development database if it does not already exist.
-- Execute against the 'master' database.

declare @DatabaseName sysname = N'CollectionsUltimate';

if db_id(@DatabaseName) is null
begin
    declare @sql nvarchar(max) = N'create database [' + replace(@DatabaseName, ']', ']]') + N']';
    exec(@sql);
end
