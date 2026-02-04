    using System.Text.Json;
using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using CollectionsUltimate.Infrastructure.Sql;
using CollectionsUltimate.Infrastructure.Storage;

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
builder.Services.AddScoped<ITagRepository, TagRepository>();

// Register blob storage service
var storageProvider = builder.Configuration["Storage:Provider"] ?? "Local";
if (storageProvider.Equals("Azure", StringComparison.OrdinalIgnoreCase))
{
    var azureConnectionString = builder.Configuration["Storage:Azure:ConnectionString"]
        ?? throw new InvalidOperationException("Azure storage connection string not configured.");
    var containerName = builder.Configuration["Storage:Azure:ContainerName"] ?? "covers";
    builder.Services.AddSingleton<IBlobStorageService>(new AzureBlobStorageService(azureConnectionString, containerName));
}
else
{
    var basePath = Path.Combine(builder.Environment.ContentRootPath, builder.Configuration["Storage:Local:BasePath"] ?? "wwwroot/uploads");
    var baseUrl = builder.Configuration["Storage:Local:BaseUrl"] ?? "/uploads";
    builder.Services.AddSingleton<IBlobStorageService>(new LocalFileStorageService(basePath, baseUrl));
}

// Add CORS policy
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:5173", "http://localhost:3000"];

// Before var app = builder.Build();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
                "http://localhost:5174",  // Current Vite port
                "http://localhost:5173"   // Original Vite port
            )
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}


// Use CORS (must be before endpoints)
app.UseCors("AllowFrontend");


app.UseStaticFiles();

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
    IAccountHouseholdRepository accountHouseholdRepo,
    CancellationToken ct) =>
{
    var id = new HouseholdId(householdId);
    await accountHouseholdRepo.DeleteByHouseholdIdAsync(id, ct);
    var deleted = await repo.DeleteAsync(id, ct);
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
    var item = await repo.GetFullByIdAsync(new ItemId(itemId), ct);
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
        OriginalTitle = request.OriginalTitle,
        Language = request.Language,
        MetadataJson = request.MetadataJson,
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
        Description = request.Description,
        Format = request.Format,
        Binding = request.Binding,
        EditionStatement = request.EditionStatement,
        PlaceOfPublication = request.PlaceOfPublication,
        Language = request.Language,
        MetadataJson = request.MetadataJson
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
        Price = request.Price,
        MetadataJson = request.MetadataJson
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
        OriginalTitle = request.Work.OriginalTitle,
        Language = request.Work.Language,
        MetadataJson = request.Work.MetadataJson,
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
            Description = request.Edition.Description,
            Format = request.Edition.Format,
            Binding = request.Edition.Binding,
            EditionStatement = request.Edition.EditionStatement,
            PlaceOfPublication = request.Edition.PlaceOfPublication,
            Language = request.Edition.Language,
            MetadataJson = request.Edition.MetadataJson
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
        Price = request.Item.Price,
        MetadataJson = request.Item.MetadataJson
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

    if (request.Series is not null)
    {
        await metaRepo.AddSeriesAsync(work.Id, request.Series.Name, request.Series.VolumeNumber, request.Series.Ordinal, ct);
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
    IItemUpdateRepository updateRepo,
    ILibraryItemRepository itemRepo,
    ITagRepository tagRepo,
    CancellationToken ct) =>
{
    // Get item first to have access to WorkId and HouseholdId for tags
    var item = await itemRepo.GetByIdAsync(new ItemId(itemId), ct);
    if (item is null)
        return Results.NotFound();

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
        await updateRepo.UpdateInventoryAsync(new ItemId(itemId), patch, ct);
    }
    catch (InvalidOperationException ex) when (ex.InnerException is not null)
    {
        return Results.Conflict(new { message = ex.Message });
    }

    // Handle tags if provided
    if (request.TagNames is not null && request.TagNames.Value.ValueKind != JsonValueKind.Undefined)
    {
        var tagNames = ParseTagNames(request.TagNames.Value);

        if (tagNames is not null)
        {
            if (tagNames.Count == 0)
            {
                // Clear all tags
                await tagRepo.SetWorkTagsAsync(item.WorkId, [], ct);
            }
            else
            {
                var householdId = item.OwnerHouseholdId;
                var cleanedNames = tagNames
                    .Select(n => n.Trim())
                    .Where(n => !string.IsNullOrEmpty(n))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                // Find existing tags
                var existingTags = await tagRepo.GetByNamesAsync(householdId, cleanedNames, ct);
                var existingNormalized = existingTags
                    .Select(t => t.NormalizedName)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                // Create missing tags
                var newTags = new List<Tag>();
                foreach (var name in cleanedNames)
                {
                    var normalized = name.ToUpperInvariant();
                    if (!existingNormalized.Contains(normalized))
                    {
                        var newTag = new Tag
                        {
                            OwnerHouseholdId = householdId,
                            Name = name,
                            NormalizedName = normalized
                        };
                        await tagRepo.CreateAsync(newTag, ct);
                        newTags.Add(newTag);
                        existingNormalized.Add(normalized);
                    }
                }

                // Set all tag relationships
                var allTagIds = existingTags.Select(t => t.Id).Concat(newTags.Select(t => t.Id));
                await tagRepo.SetWorkTagsAsync(item.WorkId, allTagIds, ct);
            }
        }
    }

    // Return full response with updated tags
    var fullItem = await itemRepo.GetFullByIdAsync(new ItemId(itemId), ct);
    return Results.Ok(fullItem);
});

static List<string>? ParseTagNames(JsonElement el)
{
    if (el.ValueKind == JsonValueKind.Null)
        return null;

    if (el.ValueKind == JsonValueKind.Array)
        return el.EnumerateArray()
            .Where(e => e.ValueKind == JsonValueKind.String)
            .Select(e => e.GetString()!)
            .ToList();

    return null;
}

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

// Cover image upload
app.MapPost("/api/editions/{editionId:guid}/cover", async (
    Guid editionId,
    IFormFile file,
    IBlobStorageService blobService,
    IEditionRepository editionRepo,
    CancellationToken ct) =>
{
    if (file.Length == 0)
        return Results.BadRequest(new { message = "File is empty." });

    if (file.Length > 5 * 1024 * 1024) // 5MB limit
        return Results.BadRequest(new { message = "File size exceeds 5MB limit." });

    var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
    if (!allowedTypes.Contains(file.ContentType.ToLowerInvariant()))
        return Results.BadRequest(new { message = "Invalid file type. Allowed: jpeg, png, webp, gif." });

    var edition = await editionRepo.GetByIdAsync(new EditionId(editionId), ct);
    if (edition is null)
        return Results.NotFound();

    var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
    if (string.IsNullOrEmpty(extension))
        extension = file.ContentType switch
        {
            "image/jpeg" => ".jpg",
            "image/png" => ".png",
            "image/webp" => ".webp",
            "image/gif" => ".gif",
            _ => ".jpg"
        };

    var fileName = $"covers/{editionId}/{Guid.NewGuid()}{extension}";

    await using var stream = file.OpenReadStream();
    var url = await blobService.UploadAsync(fileName, stream, file.ContentType, ct);

    await editionRepo.UpdateCoverUrlAsync(new EditionId(editionId), url, ct);

    return Results.Ok(new { coverImageUrl = url });
})
.DisableAntiforgery();

// Get cover image URL
app.MapGet("/api/editions/{editionId:guid}/cover", async (
    Guid editionId,
    IEditionRepository editionRepo,
    CancellationToken ct) =>
{
    var url = await editionRepo.GetCoverUrlAsync(new EditionId(editionId), ct);

    if (string.IsNullOrEmpty(url))
        return Results.NotFound();

    return Results.Ok(new { coverImageUrl = url });
});

// Delete cover image
app.MapDelete("/api/editions/{editionId:guid}/cover", async (
    Guid editionId,
    IBlobStorageService blobService,
    IEditionRepository editionRepo,
    CancellationToken ct) =>
{
    var edition = await editionRepo.GetByIdAsync(new EditionId(editionId), ct);
    if (edition is null)
        return Results.NotFound();

    if (!string.IsNullOrEmpty(edition.CoverImageUrl))
    {
        // Extract path from URL for deletion
        var uri = new Uri(edition.CoverImageUrl);
        var path = uri.AbsolutePath.TrimStart('/');
        await blobService.DeleteAsync(path, ct);
    }

    await editionRepo.UpdateCoverUrlAsync(new EditionId(editionId), null, ct);
    return Results.NoContent();
});

app.Run();

public sealed record CreateHouseholdRequest(string Name);
public sealed record CreateAccountRequest(string DisplayName, string? Email);

/// <summary>
/// Deprecated: Use CreateBookIngestRequest with POST /api/households/{id}/library/books instead.
/// </summary>
[Obsolete("Use CreateBookIngestRequest with the normalized model endpoints instead.")]
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
    string? Description,
    string? OriginalTitle,
    string? Language,
    string? MetadataJson);

public sealed record CreateEditionRequest(
    string? EditionTitle,
    string? EditionSubtitle,
    string? Publisher,
    int? PublishedYear,
    int? PageCount,
    string? Description,
    string? Format,
    string? Binding,
    string? EditionStatement,
    string? PlaceOfPublication,
    string? Language,
    string? MetadataJson);

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
decimal? Price,
string? MetadataJson);

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
    CreateBookIngestWork Work,
    CreateBookIngestItem Item,
    CreateBookIngestEdition? Edition,
    IReadOnlyList<CreateBookIngestContributor>? Contributors,
    IReadOnlyList<string>? Tags,
    IReadOnlyList<CreateBookIngestSubject>? Subjects,
    CreateBookIngestSeries? Series);

public sealed record CreateBookIngestWork(
    string Title,
    string? Subtitle,
    string? SortTitle,
    string? Description,
    string? OriginalTitle,
    string? Language,
    string? MetadataJson);

public sealed record CreateBookIngestSeries(
    string Name,
    string? VolumeNumber,
    int? Ordinal);

public sealed record CreateBookIngestItem(
string? Title,
string? Subtitle,
string? Notes,
string? Barcode,
string? Location,
string? Status,
string? Condition,
DateOnly? AcquiredOn,
decimal? Price,
string? MetadataJson);

public sealed record CreateBookIngestEdition(
string? EditionTitle,
string? EditionSubtitle,
string? Publisher,
int? PublishedYear,
int? PageCount,
string? Description,
string? Format,
string? Binding,
string? EditionStatement,
string? PlaceOfPublication,
string? Language,
string? MetadataJson,
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
JsonElement? Notes,
JsonElement? TagNames);

