/*
  Migration: Move data from Book table to normalized Work + LibraryItem model.
  
  This script:
  1. Creates a Work record for each unique book (by title + authors)
  2. Creates an Edition record with ISBN info
  3. Creates a LibraryItem record linked to the Work/Edition
  4. Stores book-specific metadata (ISBN, Authors) in MetadataJson
  5. Renames Book table to Book_Deprecated (keeps data for safety)
  
  Run this AFTER applying 0012_libraryitem_metadata_json.sql
*/

set nocount on;
set xact_abort on;

begin transaction;

-- Only proceed if Book table exists and has data
if object_id(N'dbo.Book', N'U') is not null
begin
    -- Ensure MetadataJson column exists
    if col_length('dbo.LibraryItem', 'MetadataJson') is null
    begin
        raiserror('MetadataJson column not found. Run 0012_libraryitem_metadata_json.sql first.', 16, 1);
        rollback transaction;
        return;
    end

    -- Step 1: Create Works for each unique book (grouped by normalized title)
    insert into dbo.Work (Id, Title, Subtitle, SortTitle, Description, NormalizedTitle, CreatedUtc)
    select 
        newid(),
        b.Title,
        b.Subtitle,
        b.Title, -- SortTitle defaults to Title
        null, -- No description in Book table
        upper(ltrim(rtrim(replace(replace(replace(b.Title, char(13), ' '), char(10), ' '), char(9), ' ')))),
        b.CreatedUtc
    from dbo.Book b
    where not exists (
        select 1 from dbo.Work w 
        where w.NormalizedTitle = upper(ltrim(rtrim(replace(replace(replace(b.Title, char(13), ' '), char(10), ' '), char(9), ' '))))
    );

    -- Step 2: Create Editions with ISBN info (one per book since we don't have edition-level grouping)
    insert into dbo.Edition (Id, WorkId, EditionTitle, EditionSubtitle, Publisher, PublishedYear, PageCount, Description, CreatedUtc)
    select 
        newid(),
        w.Id,
        null, -- EditionTitle
        null, -- EditionSubtitle
        b.Publisher,
        b.PublishedYear,
        null, -- PageCount not in Book table
        null, -- Description
        b.CreatedUtc
    from dbo.Book b
    inner join dbo.Work w on w.NormalizedTitle = upper(ltrim(rtrim(replace(replace(replace(b.Title, char(13), ' '), char(10), ' '), char(9), ' '))));

    -- Step 3: Create LibraryItems linked to Works/Editions
    -- We need to match books to the editions we just created
    ;with BookEditions as (
        select 
            b.Id as BookId,
            b.HouseholdId,
            b.Title,
            b.Subtitle,
            b.Notes,
            b.CreatedUtc,
            b.Isbn10,
            b.Isbn13,
            b.Authors,
            w.Id as WorkId,
            e.Id as EditionId,
            row_number() over (partition by b.Id order by e.CreatedUtc) as rn
        from dbo.Book b
        inner join dbo.Work w on w.NormalizedTitle = upper(ltrim(rtrim(replace(replace(replace(b.Title, char(13), ' '), char(10), ' '), char(9), ' '))))
        inner join dbo.Edition e on e.WorkId = w.Id and e.PublishedYear = b.PublishedYear
    )
    insert into dbo.LibraryItem (Id, HouseholdId, Kind, WorkId, EditionId, Title, Subtitle, Notes, Barcode, Location, Status, Condition, AcquiredOn, Price, MetadataJson, CreatedUtc)
    select 
        BookId, -- Preserve original Book ID
        HouseholdId,
        1, -- Kind = Book
        WorkId,
        EditionId,
        Title,
        Subtitle,
        Notes,
        null, -- Barcode
        null, -- Location
        null, -- Status
        null, -- Condition
        null, -- AcquiredOn
        null, -- Price
        -- Store book-specific metadata as JSON
        case 
            when Isbn10 is not null or Isbn13 is not null or Authors is not null 
            then concat(
                '{',
                case when Isbn10 is not null then concat('"isbn10":"', replace(Isbn10, '"', '\"'), '"') else '' end,
                case when Isbn10 is not null and Isbn13 is not null then ',' else '' end,
                case when Isbn13 is not null then concat('"isbn13":"', replace(Isbn13, '"', '\"'), '"') else '' end,
                case when (Isbn10 is not null or Isbn13 is not null) and Authors is not null then ',' else '' end,
                case when Authors is not null then concat('"authors":"', replace(Authors, '"', '\"'), '"') else '' end,
                '}'
            )
            else null 
        end,
        CreatedUtc
    from BookEditions
    where rn = 1
    and not exists (select 1 from dbo.LibraryItem li where li.Id = BookEditions.BookId);

    -- Step 4: Add edition identifiers for ISBNs
    insert into dbo.EditionIdentifier (EditionId, IdentifierTypeId, Value, NormalizedValue, IsPrimary)
    select distinct
        e.Id,
        1, -- ISBN10
        b.Isbn10,
        upper(replace(replace(b.Isbn10, '-', ''), ' ', '')),
        1
    from dbo.Book b
    inner join dbo.Work w on w.NormalizedTitle = upper(ltrim(rtrim(replace(replace(replace(b.Title, char(13), ' '), char(10), ' '), char(9), ' '))))
    inner join dbo.Edition e on e.WorkId = w.Id and e.PublishedYear = b.PublishedYear
    where b.Isbn10 is not null
    and not exists (
        select 1 from dbo.EditionIdentifier ei 
        where ei.EditionId = e.Id 
        and ei.IdentifierTypeId = 1 
        and ei.NormalizedValue = upper(replace(replace(b.Isbn10, '-', ''), ' ', ''))
    );

    insert into dbo.EditionIdentifier (EditionId, IdentifierTypeId, Value, NormalizedValue, IsPrimary)
    select distinct
        e.Id,
        2, -- ISBN13
        b.Isbn13,
        upper(replace(replace(b.Isbn13, '-', ''), ' ', '')),
        1
    from dbo.Book b
    inner join dbo.Work w on w.NormalizedTitle = upper(ltrim(rtrim(replace(replace(replace(b.Title, char(13), ' '), char(10), ' '), char(9), ' '))))
    inner join dbo.Edition e on e.WorkId = w.Id and e.PublishedYear = b.PublishedYear
    where b.Isbn13 is not null
    and not exists (
        select 1 from dbo.EditionIdentifier ei 
        where ei.EditionId = e.Id 
        and ei.IdentifierTypeId = 2 
        and ei.NormalizedValue = upper(replace(replace(b.Isbn13, '-', ''), ' ', ''))
    );

    -- Step 5: Rename Book table to Book_Deprecated (keep data for safety)
    if object_id(N'dbo.Book_Deprecated', N'U') is null
    begin
        exec sp_rename 'dbo.Book', 'Book_Deprecated';
    end

    print 'Migration complete. Book table renamed to Book_Deprecated.';
end
else
begin
    print 'Book table not found. Nothing to migrate.';
end

commit transaction;
