set nocount on;
set xact_abort on;

begin transaction;

if object_id(N'dbo.Works', N'U') is not null
begin
    if col_length('dbo.Works', 'NormalizedTitle') is null
        alter table dbo.Works add NormalizedTitle nvarchar(400) null;

    if col_length('dbo.Works', 'NormalizedTitle') is not null
    begin
        exec sp_executesql N'
            update dbo.Works
            set NormalizedTitle = upper(
                    ltrim(
                        rtrim(
                            replace(
                                replace(
                                    replace(Title, char(13), '' ''),
                                    char(10), '' ''
                                ),
                                char(9), '' ''
                            )
                        )
                    )
                )
            where NormalizedTitle is null;
        ';

        if not exists (
            select 1
            from sys.indexes
            where object_id = object_id(N'dbo.Works')
              and name = N'IX_Works_NormalizedTitle'
        )
        begin
            exec sp_executesql N'create index IX_Works_NormalizedTitle on dbo.Works(NormalizedTitle);';
        end
    end
end

commit transaction;
