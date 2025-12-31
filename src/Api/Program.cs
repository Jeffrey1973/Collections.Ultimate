using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using CollectionsUltimate.Infrastructure.Sql;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

var connectionString = builder.Configuration.GetConnectionString("Collections")
    ?? builder.Configuration["Collections:ConnectionString"]
    ?? throw new InvalidOperationException("Missing connection string. Configure ConnectionStrings:Collections or Collections:ConnectionString.");

builder.Services.AddSingleton(new SqlConnectionFactory(connectionString));
builder.Services.AddScoped<IHouseholdRepository, HouseholdRepository>();
builder.Services.AddScoped<IBookRepository, BookRepository>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
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

app.Run();

public sealed record CreateHouseholdRequest(string Name);

public sealed record CreateBookRequest(
    string Title,
    string? Subtitle,
    string? Authors,
    string? Isbn10,
    string? Isbn13,
    int? PublishedYear,
    string? Publisher,
    string? Notes);
