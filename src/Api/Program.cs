using System.Text.Json;
using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using CollectionsUltimate.Infrastructure.Sql;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var connectionString = builder.Configuration.GetConnectionString("Collections")
    ?? builder.Configuration["Collections:ConnectionString"]
    ?? throw new InvalidOperationException("Missing connection string. Configure ConnectionStrings:Collections or Collections:ConnectionString.");

builder.Services.AddSingleton(new SqlConnectionFactory(connectionString));

builder.Services.AddScoped<IHouseholdRepository, HouseholdRepository>();
builder.Services.AddScoped<IBookRepository, BookRepository>();

builder.Services.AddScoped<IAccountRepository, AccountRepository>();
builder.Services.AddScoped<IAccountHouseholdRepository, AccountHouseholdRepository>();

builder.Services.AddScoped<IImportRepository, ImportRepository>();

builder.Services.AddScoped<IWorkRepository, WorkRepository>();
builder.Services.AddScoped<IEditionRepository, EditionRepository>();
builder.Services.AddScoped<ILibraryItemRepository, LibraryItemRepository>();
builder.Services.AddScoped<IWorkMetadataRepository, WorkMetadataRepository>();

builder.Services.AddScoped<IEditionLookupRepository, EditionLookupRepository>();
builder.Services.AddScoped<IWorkLookupRepository, WorkLookupRepository>();
builder.Services.AddScoped<ILibraryItemLookupRepository, LibraryItemLookupRepository>();

builder.Services.AddScoped<IItemSearchRepository, ItemSearchRepository>();
builder.Services.AddScoped<IItemUpdateRepository, ItemUpdateRepository>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapGet("/api/households", async (IHouseholdRepository repo, CancellationToken ct) =>
{
    var households = await repo.ListAsync(ct);
    return Results.Ok(households);
});

app.MapPost("/api/households", async (CreateHouseholdRequest request, IHouseholdRepository repo, CancellationToken ct) =>
{
    var household = new Household { Name = request.Name };
    await repo.CreateAsync(household, ct);
    return Results.Created($"/api/households/{household.Id.Value}", household);
});

app.MapDelete("/api/households/{householdId:guid}", async (
    Guid householdId,
    IHouseholdRepository repo,
    CancellationToken ct) =>
{
    var deleted = await repo.DeleteAsync(new HouseholdId(householdId), ct);
    return deleted ? Results.NoContent() : Results.NotFound();
});

// Normalized items search (household)
app.MapGet("/api/households/{householdId:guid}/items", async (
    Guid householdId,
    string? q,
    string? tag,
    string? subject,
    string? barcode,
    string? status,
    string? location,
    int? take,
    int? skip,
    IItemSearchRepository repo,
    CancellationToken ct) =>
{
    var results = await repo.SearchAsync(
        new HouseholdId(householdId),
        q,
        tag,
        subject,
        barcode,
        status,
        location,
        Math.Clamp(take ?? 50, 1, 200),
        Math.Max(skip ?? 0, 0),
        ct);

    return Results.Ok(results);
});

// Import monitoring
app.MapGet("/api/households/{householdId:guid}/imports", async (
    Guid householdId,
    int? take,
    int? skip,
    IImportRepository repo,
    CancellationToken ct) =>
{
    var batches = await repo.ListBatchesAsync(new HouseholdId(householdId), Math.Clamp(take ?? 50, 1, 200), Math.Max(skip ?? 0, 0), ct);
    return Results.Ok(batches);
});

app.MapGet("/api/imports/batches/{batchId:guid}", async (Guid batchId, IImportRepository repo, CancellationToken ct) =>
{
    var batch = await repo.GetBatchAsync(new ImportBatchId(batchId), ct);
    if (batch is null)
        return Results.NotFound();

    var counts = await repo.GetBatchStatusCountsAsync(new ImportBatchId(batchId), ct);
    return Results.Ok(new { batch, counts });
});

app.MapGet("/api/imports/batches/{batchId:guid}/errors", async (
    Guid batchId,
    int? take,
    int? skip,
    IImportRepository repo,
    CancellationToken ct) =>
{
    var failures = await repo.ListFailuresAsync(new ImportBatchId(batchId), Math.Clamp(take ?? 50, 1, 200), Math.Max(skip ?? 0, 0), ct);
    return Results.Ok(failures);
});

// Accounts
app.MapPost("/api/accounts", async (CreateAccountRequest request, IAccountRepository repo, CancellationToken ct) =>
{
    var account = new Account
    {
        DisplayName = request.DisplayName,
        Email = request.Email
    };

    await repo.CreateAsync(account, ct);
    return Results.Created($"/api/accounts/{account.Id.Value}", account);
});

app.MapGet("/api/accounts/{accountId:guid}", async (Guid accountId, IAccountRepository repo, CancellationToken ct) =>
{
    var account = await repo.GetByIdAsync(new AccountId(accountId), ct);
    return account is null ? Results.NotFound() : Results.Ok(account);
});

app.MapPost("/api/accounts/{accountId:guid}/households/{householdId:guid}", async (
    Guid accountId,
    Guid householdId,
    IAccountHouseholdRepository repo,
    CancellationToken ct) =>
{
    await repo.AddAsync(new AccountId(accountId), new HouseholdId(householdId), ct);
    return Results.NoContent();
});

app.MapGet("/api/accounts/{accountId:guid}/households", async (
    Guid accountId,
    IAccountHouseholdRepository repo,
    CancellationToken ct) =>
{
    var households = await repo.ListHouseholdsAsync(new AccountId(accountId), ct);
    return Results.Ok(households.Select(h => new { id = h.Value }));
});

app.MapGet("/api/households/{householdId:guid}/books", async (
    Guid householdId,
    string? q,
    int? take,
    int? skip,
    IBookRepository repo,
    CancellationToken ct) =>
{
    var result = await repo.SearchAsync(new HouseholdId(householdId), q, Math.Clamp(take ?? 50, 1, 200), Math.Max(skip ?? 0, 0), ct);
    return Results.Ok(result);
});

app.MapPost("/api/households/{householdId:guid}/books", async (
    Guid householdId,
    CreateBookRequest request,
    IBookRepository repo,
    CancellationToken ct) =>
{
    var book = new Book
    {
        OwnerHouseholdId = new HouseholdId(householdId),
        Kind = ItemKind.Book,
        Title = request.Title,
        Subtitle = request.Subtitle,
        Authors = request.Authors,
        Isbn10 = request.Isbn10,
        Isbn13 = request.Isbn13,
        PublishedYear = request.PublishedYear,
        Publisher = request.Publisher,
        Notes = request.Notes
    };

    await repo.CreateAsync(book, ct);
    return Results.Created($"/api/books/{book.Id.Value}", book);
});

// Normalized model endpoints
app.MapGet("/api/works/{workId:guid}", async (Guid workId, IWorkRepository repo, CancellationToken ct) =>
{
    var work = await repo.GetByIdAsync(new WorkId(workId), ct);
    return work is null ? Results.NotFound() : Results.Ok(work);
});

app.MapGet("/api/editions/{editionId:guid}", async (Guid editionId, IEditionRepository repo, CancellationToken ct) =>
{
    var edition = await repo.GetByIdAsync(new EditionId(editionId), ct);
    return edition is null ? Results.NotFound() : Results.Ok(edition);
});

app.MapGet("/api/items/{itemId:guid}", async (Guid itemId, ILibraryItemRepository repo, CancellationToken ct) =>
{
    var item = await repo.GetByIdAsync(new ItemId(itemId), ct);
    return item is null ? Results.NotFound() : Results.Ok(item);
});

app.MapPost("/api/works", async (CreateWorkRequest request, IWorkRepository repo, CancellationToken ct) =>
{
    var work = new Work
    {
        Title = request.Title,
        Subtitle = request.Subtitle,
        SortTitle = request.SortTitle,
        Description = request.Description,
        NormalizedTitle = NormalizeTitle(request.Title)
    };

    await repo.CreateAsync(work, ct);
    return Results.Created($"/api/works/{work.Id.Value}", work);
});

app.MapPost("/api/works/{workId:guid}/editions", async (Guid workId, CreateEditionRequest request, IEditionRepository repo, CancellationToken ct) =>
{
    var edition = new Edition
    {
        WorkId = new WorkId(workId),
        EditionTitle = request.EditionTitle,
        EditionSubtitle = request.EditionSubtitle,
        Publisher = request.Publisher,
        PublishedYear = request.PublishedYear,
        PageCount = request.PageCount,
        Description = request.Description
    };

    await repo.CreateAsync(edition, ct);
    return Results.Created($"/api/editions/{edition.Id.Value}", edition);
});

app.MapPost("/api/households/{householdId:guid}/items", async (
    Guid householdId,
    CreateItemRequest request,
    ILibraryItemRepository repo,
    CancellationToken ct) =>
{
    var item = new LibraryItem
    {
        OwnerHouseholdId = new HouseholdId(householdId),
        Kind = request.Kind,
        WorkId = new WorkId(request.WorkId),
        EditionId = request.EditionId is null ? null : new EditionId(request.EditionId.Value),
        Title = request.Title,
        Subtitle = request.Subtitle,
        Notes = request.Notes,
        Barcode = request.Barcode,
        Location = request.Location,
        Status = request.Status,
        Condition = request.Condition,
        AcquiredOn = request.AcquiredOn,
        Price = request.Price
    };

    await repo.CreateAsync(item, ct);
    return Results.Created($"/api/items/{item.Id.Value}", item);
});

// One-shot create: work + edition + item + metadata
app.MapPost("/api/households/{householdId:guid}/library/books", async (
    Guid householdId,
    CreateBookIngestRequest request,
    IWorkRepository workRepo,
    IEditionRepository editionRepo,
    ILibraryItemRepository itemRepo,
    IWorkMetadataRepository metaRepo,
    CancellationToken ct) =>
{
    var work = new Work
    {
        Title = request.Work.Title,
        Subtitle = request.Work.Subtitle,
        SortTitle = request.Work.SortTitle,
        Description = request.Work.Description,
        NormalizedTitle = NormalizeTitle(request.Work.Title)
    };

    await workRepo.CreateAsync(work, ct);

    EditionId? editionId = null;
    if (request.Edition is not null)
    {
        var edition = new Edition
        {
            WorkId = work.Id,
            EditionTitle = request.Edition.EditionTitle,
            EditionSubtitle = request.Edition.EditionSubtitle,
            Publisher = request.Edition.Publisher,
            PublishedYear = request.Edition.PublishedYear,
            PageCount = request.Edition.PageCount,
            Description = request.Edition.Description
        };

        await editionRepo.CreateAsync(edition, ct);
        editionId = edition.Id;

        if (request.Edition.Identifiers is not null)
        {
            foreach (var i in request.Edition.Identifiers)
                await metaRepo.AddEditionIdentifierAsync(edition.Id, new IdentifierTypeId(i.IdentifierTypeId), i.Value, i.IsPrimary, ct);
        }
    }

    var item = new LibraryItem
    {
        OwnerHouseholdId = new HouseholdId(householdId),
        Kind = ItemKind.Book,
        WorkId = work.Id,
        EditionId = editionId,
        Title = request.Item.Title ?? work.Title,
        Subtitle = request.Item.Subtitle ?? work.Subtitle,
        Notes = request.Item.Notes,
        Barcode = request.Item.Barcode,
        Location = request.Item.Location,
        Status = request.Item.Status,
        Condition = request.Item.Condition,
        AcquiredOn = request.Item.AcquiredOn,
        Price = request.Item.Price
    };

    await itemRepo.CreateAsync(item, ct);

    if (request.Contributors is not null)
    {
        foreach (var c in request.Contributors)
        {
            var person = new Person
            {
                Id = c.PersonId is null ? new PersonId(Guid.NewGuid()) : new PersonId(c.PersonId.Value),
                DisplayName = c.DisplayName,
                SortName = c.SortName,
                BirthYear = c.BirthYear,
                DeathYear = c.DeathYear
            };

            await metaRepo.AddContributorAsync(work.Id, person, new ContributorRoleId(c.RoleId), c.Ordinal, ct);
        }
    }

    if (request.Tags is not null)
    {
        foreach (var t in request.Tags)
            await metaRepo.AddTagAsync(work.Id, new HouseholdId(householdId), t, ct);
    }

    if (request.Subjects is not null)
    {
        foreach (var s in request.Subjects)
            await metaRepo.AddSubjectAsync(work.Id, new SubjectSchemeId(s.SchemeId), s.Text, ct);
    }

    var response = new CreateBookIngestResponse(work.Id.Value, editionId?.Value, item.Id.Value);
    return Results.Created($"/api/items/{item.Id.Value}", response);
});

app.MapPost("/api/works/{workId:guid}/contributors", async (Guid workId, AddContributorRequest request, IWorkMetadataRepository repo, CancellationToken ct) =>
{
    var person = new Person
    {
        Id = request.PersonId is null ? new PersonId(Guid.NewGuid()) : new PersonId(request.PersonId.Value),
        DisplayName = request.DisplayName,
        SortName = request.SortName,
        BirthYear = request.BirthYear,
        DeathYear = request.DeathYear
    };

    await repo.AddContributorAsync(new WorkId(workId), person, new ContributorRoleId(request.RoleId), request.Ordinal, ct);
    return Results.Ok();
});

app.MapPost("/api/households/{householdId:guid}/works/{workId:guid}/tags", async (Guid householdId, Guid workId, AddTagRequest request, IWorkMetadataRepository repo, CancellationToken ct) =>
{
    await repo.AddTagAsync(new WorkId(workId), new HouseholdId(householdId), request.Name, ct);
    return Results.Ok();
});

app.MapPost("/api/works/{workId:guid}/subjects", async (Guid workId, AddSubjectRequest request, IWorkMetadataRepository repo, CancellationToken ct) =>
{
    await repo.AddSubjectAsync(new WorkId(workId), new SubjectSchemeId(request.SchemeId), request.Text, ct);
    return Results.Ok();
});

app.MapPost("/api/editions/{editionId:guid}/identifiers", async (Guid editionId, AddEditionIdentifierRequest request, IWorkMetadataRepository repo, CancellationToken ct) =>
{
    await repo.AddEditionIdentifierAsync(new EditionId(editionId), new IdentifierTypeId(request.IdentifierTypeId), request.Value, request.IsPrimary, ct);
    return Results.Ok();
});

app.MapPatch("/api/items/{itemId:guid}", async (
    Guid itemId,
    PatchItemRequest request,
    IItemUpdateRepository repo,
    CancellationToken ct) =>
{
    var patch = new ItemInventoryPatch(
        Barcode: ToPatchString(request.Barcode),
        Location: ToPatchString(request.Location),
        Status: ToPatchString(request.Status),
        Condition: ToPatchString(request.Condition),
        AcquiredOn: ToPatchDateOnly(request.AcquiredOn),
        Price: ToPatchDecimal(request.Price),
        Notes: ToPatchString(request.Notes));

    try
    {
        var updated = await repo.UpdateInventoryAsync(new ItemId(itemId), patch, ct);
        return updated ? Results.NoContent() : Results.NotFound();
    }
    catch (InvalidOperationException ex) when (ex.InnerException is not null)
    {
        return Results.Conflict(new { message = ex.Message });
    }
});

static PatchField<string> ToPatchString(JsonElement? el)
{
    if (el is null) return PatchField<string>.Unspecified;
    return el.Value.ValueKind == JsonValueKind.Null
        ? PatchField<string>.From(null)
        : PatchField<string>.From(el.Value.GetString());
}

static PatchField<DateOnly?> ToPatchDateOnly(JsonElement? el)
{
    if (el is null) return PatchField<DateOnly?>.Unspecified;
    if (el.Value.ValueKind == JsonValueKind.Null) return PatchField<DateOnly?>.From(null);

    if (el.Value.ValueKind == JsonValueKind.String && DateOnly.TryParse(el.Value.GetString(), out var d))
        return PatchField<DateOnly?>.From(d);

    throw new InvalidOperationException("Invalid date format for acquiredOn. Use YYYY-MM-DD.");
}

static PatchField<decimal?> ToPatchDecimal(JsonElement? el)
{
    if (el is null) return PatchField<decimal?>.Unspecified;
    if (el.Value.ValueKind == JsonValueKind.Null) return PatchField<decimal?>.From(null);

    if (el.Value.ValueKind == JsonValueKind.Number && el.Value.TryGetDecimal(out var d))
        return PatchField<decimal?>.From(d);

    if (el.Value.ValueKind == JsonValueKind.String && decimal.TryParse(el.Value.GetString(), out var ds))
        return PatchField<decimal?>.From(ds);

    throw new InvalidOperationException("Invalid decimal format for price.");
}

static string NormalizeTitle(string title)
    => string.Join(' ', title.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).ToUpperInvariant();

app.Run();

public sealed record CreateHouseholdRequest(string Name);
public sealed record CreateAccountRequest(string DisplayName, string? Email);

public sealed record CreateBookRequest(
    string Title,
    string? Subtitle,
    string? Authors,
    string? Isbn10,
    string? Isbn13,
    int? PublishedYear,
    string? Publisher,
    string? Notes);

public sealed record CreateWorkRequest(
    string Title,
    string? Subtitle,
    string? SortTitle,
    string? Description);

public sealed record CreateEditionRequest(
    string? EditionTitle,
    string? EditionSubtitle,
    string? Publisher,
    int? PublishedYear,
    int? PageCount,
    string? Description);

public sealed record CreateItemRequest(
    ItemKind Kind,
    Guid WorkId,
    Guid? EditionId,
    string Title,
    string? Subtitle,
    string? Notes,
    string? Barcode,
    string? Location,
    string? Status,
    string? Condition,
    DateOnly? AcquiredOn,
    decimal? Price);

public sealed record AddContributorRequest(
    Guid? PersonId,
    string DisplayName,
    int RoleId,
    int Ordinal,
    string? SortName,
    int? BirthYear,
    int? DeathYear);

public sealed record AddTagRequest(string Name);

public sealed record AddSubjectRequest(int SchemeId, string Text);

public sealed record AddEditionIdentifierRequest(int IdentifierTypeId, string Value, bool IsPrimary);

public sealed record CreateBookIngestRequest(
    CreateWorkRequest Work,
    CreateBookIngestItem Item,
    CreateBookIngestEdition? Edition,
    IReadOnlyList<CreateBookIngestContributor>? Contributors,
    IReadOnlyList<string>? Tags,
    IReadOnlyList<CreateBookIngestSubject>? Subjects);

public sealed record CreateBookIngestItem(
    string? Title,
    string? Subtitle,
    string? Notes,
    string? Barcode,
    string? Location,
    string? Status,
    string? Condition,
    DateOnly? AcquiredOn,
    decimal? Price);

public sealed record CreateBookIngestEdition(
    string? EditionTitle,
    string? EditionSubtitle,
    string? Publisher,
    int? PublishedYear,
    int? PageCount,
    string? Description,
    IReadOnlyList<CreateBookIngestIdentifier>? Identifiers);

public sealed record CreateBookIngestIdentifier(int IdentifierTypeId, string Value, bool IsPrimary);

public sealed record CreateBookIngestContributor(
    Guid? PersonId,
    string DisplayName,
    int RoleId,
    int Ordinal,
    string? SortName,
    int? BirthYear,
    int? DeathYear);

public sealed record CreateBookIngestSubject(int SchemeId, string Text);

public sealed record CreateBookIngestResponse(Guid WorkId, Guid? EditionId, Guid ItemId);

public sealed record PatchItemRequest(
    JsonElement? Barcode,
    JsonElement? Location,
    JsonElement? Status,
    JsonElement? Condition,
    JsonElement? AcquiredOn,
    JsonElement? Price,
    JsonElement? Notes);
