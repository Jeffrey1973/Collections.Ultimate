    using System.Text.Json;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using CollectionsUltimate.Infrastructure.Sql;
using CollectionsUltimate.Infrastructure.Storage;
using CollectionsUltimate.Infrastructure.Search;
using Meilisearch;

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
builder.Services.AddScoped<IItemEventRepository, ItemEventRepository>();

// Register Meilisearch
var meiliUrl = builder.Configuration["Meilisearch:Url"] ?? "http://localhost:7700";
var meiliKey = builder.Configuration["Meilisearch:MasterKey"] ?? "collectionsUltimateDevKey";
builder.Services.AddSingleton(new MeilisearchClient(meiliUrl, meiliKey));
builder.Services.AddSingleton<MeilisearchService>();
builder.Services.AddSingleton<IMeilisearchService>(sp => sp.GetRequiredService<MeilisearchService>());
builder.Services.AddHostedService<MeilisearchSyncHostedService>();

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
    ?? ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:3000"];

// Before var app = builder.Build();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

// Auth0 JWT authentication
var auth0Domain = builder.Configuration["Auth0:Domain"];
var auth0Audience = builder.Configuration["Auth0:Audience"];
var auth0Configured = !string.IsNullOrEmpty(auth0Domain) && !string.IsNullOrEmpty(auth0Audience);

var authBuilder = builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme);
if (auth0Configured)
{
    authBuilder.AddJwtBearer(options =>
    {
        options.Authority = $"https://{auth0Domain}/";
        options.Audience = auth0Audience;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidAudiences = new[]
            {
                auth0Audience,
                $"https://{auth0Domain}/api/v2/",
                $"https://{auth0Domain}/userinfo"
            },
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
        // Diagnostic logging for JWT failures
        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnAuthenticationFailed = context =>
            {
                var logger = context.HttpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("JwtBearer");
                logger.LogError(context.Exception, "JWT authentication failed. Authority={Authority}, Audience={Audience}", $"https://{auth0Domain}/", auth0Audience);
                return Task.CompletedTask;
            },
            OnTokenValidated = context =>
            {
                var logger = context.HttpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("JwtBearer");
                logger.LogInformation("JWT validated. Sub={Sub}", context.Principal?.FindFirst("sub")?.Value);
                return Task.CompletedTask;
            },
            OnChallenge = context =>
            {
                var logger = context.HttpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("JwtBearer");
                logger.LogWarning("JWT challenge. Error={Error}, ErrorDesc={Desc}", context.Error, context.ErrorDescription);
                return Task.CompletedTask;
            }
        };
    });
}
builder.Services.AddAuthorization();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}


// Use CORS (must be before endpoints)
app.UseCors("AllowFrontend");

// Auth middleware (only active when Auth0 is configured)
app.UseAuthentication();
app.UseAuthorization();

app.UseStaticFiles();

// ─── Health endpoint (unauthenticated, for load-balancer probes) ────────────

app.MapGet("/health", async (IMeilisearchService meili, CancellationToken ct) =>
{
    var meiliHealthy = false;
    try { meiliHealthy = await meili.IsHealthyAsync(ct); } catch { }

    return Results.Ok(new
    {
        status = "healthy",
        timestamp = DateTime.UtcNow,
        services = new
        {
            meilisearch = meiliHealthy ? "ok" : "unavailable"
        }
    });
});

// ─── CORS proxy for external book APIs ──────────────────────────────────────
// Replaces the standalone Node.js proxy server in production.
// Allows the SPA to call Google Books, ISBNdb, Open Library, etc. without
// running into browser CORS restrictions.

app.MapGet("/proxy", async (HttpContext ctx, CancellationToken ct) =>
{
    var targetUrl = ctx.Request.Query["url"].FirstOrDefault();
    if (string.IsNullOrWhiteSpace(targetUrl))
        return Results.BadRequest(new { error = "Missing url parameter" });

    // Allowlist: only proxy known book API domains
    var allowed = new[] {
        "googleapis.com", "openlibrary.org", "isbndb.com",
        "librarything.com", "worldcat.org", "loc.gov",
        "trove.nla.gov.au", "europeana.eu", "dp.la",
        "inventaire.io", "archive.org"
    };
    if (!Uri.TryCreate(targetUrl, UriKind.Absolute, out var uri)
        || !allowed.Any(d => uri.Host.EndsWith(d, StringComparison.OrdinalIgnoreCase)))
        return Results.BadRequest(new { error = "URL not in allowlist" });

    using var httpClient = new HttpClient();
    httpClient.Timeout = TimeSpan.FromSeconds(15);

    var apiKey = ctx.Request.Query["apiKey"].FirstOrDefault();
    if (!string.IsNullOrEmpty(apiKey))
        httpClient.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", apiKey);

    var response = await httpClient.GetAsync(targetUrl, ct);
    var content = await response.Content.ReadAsStringAsync(ct);
    var contentType = response.Content.Headers.ContentType?.MediaType ?? "application/json";

    return Results.Content(content, contentType, System.Text.Encoding.UTF8, (int)response.StatusCode);
});

app.MapPost("/proxy", async (HttpContext ctx, CancellationToken ct) =>
{
    var targetUrl = ctx.Request.Query["url"].FirstOrDefault();
    if (string.IsNullOrWhiteSpace(targetUrl))
        return Results.BadRequest(new { error = "Missing url parameter" });

    var allowed = new[] {
        "googleapis.com", "openlibrary.org", "isbndb.com",
        "librarything.com", "worldcat.org", "loc.gov",
        "trove.nla.gov.au", "europeana.eu", "dp.la",
        "inventaire.io", "archive.org"
    };
    if (!Uri.TryCreate(targetUrl, UriKind.Absolute, out var uri)
        || !allowed.Any(d => uri.Host.EndsWith(d, StringComparison.OrdinalIgnoreCase)))
        return Results.BadRequest(new { error = "URL not in allowlist" });

    using var httpClient = new HttpClient();
    httpClient.Timeout = TimeSpan.FromSeconds(15);

    using var reader = new StreamReader(ctx.Request.Body);
    var body = await reader.ReadToEndAsync(ct);
    var reqContent = new StringContent(body, System.Text.Encoding.UTF8,
        ctx.Request.ContentType ?? "application/json");

    var response = await httpClient.PostAsync(targetUrl, reqContent, ct);
    var content = await response.Content.ReadAsStringAsync(ct);
    var contentType = response.Content.Headers.ContentType?.MediaType ?? "application/json";

    return Results.Content(content, contentType, System.Text.Encoding.UTF8, (int)response.StatusCode);
});

app.MapGet("/api/households", async (
    HttpContext http,
    IAccountRepository accountRepo,
    IAccountHouseholdRepository accountHouseholdRepo,
    IHouseholdRepository householdRepo,
    CancellationToken ct) =>
{
    var sub = http.User.FindFirstValue(ClaimTypes.NameIdentifier)
           ?? http.User.FindFirstValue("sub");
    if (string.IsNullOrEmpty(sub))
        return Results.Unauthorized();

    var account = await accountRepo.GetByAuth0SubAsync(sub, ct);
    if (account is null)
        return Results.Unauthorized();

    var memberships = await accountHouseholdRepo.ListHouseholdsAsync(account.Id, ct);
    var households = new List<object>();
    foreach (var m in memberships)
    {
        var h = await householdRepo.GetByIdAsync(m.HouseholdId, ct);
        if (h is not null)
            households.Add(new { id = h.Id.Value, name = h.Name, role = m.Role });
    }
    return Results.Ok(households);
}).RequireAuthorization();

app.MapPost("/api/households", async (CreateHouseholdRequest request, IHouseholdRepository repo, CancellationToken ct) =>
{
    var household = new Household { Name = request.Name };
    await repo.CreateAsync(household, ct);
    return Results.Created($"/api/households/{household.Id.Value}", household);
}).RequireAuthorization();

app.MapPut("/api/households/{householdId:guid}", async (
    Guid householdId,
    CreateHouseholdRequest request,
    IHouseholdRepository repo,
    CancellationToken ct) =>
{
    var id = new HouseholdId(householdId);
    var updated = await repo.UpdateAsync(id, request.Name, ct);
    return updated ? Results.NoContent() : Results.NotFound();
}).RequireAuthorization();

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
}).RequireAuthorization();

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
    IMeilisearchService meili,
    CancellationToken ct) =>
{
    var actualTake = Math.Clamp(take ?? 500, 1, 10000);
    var actualSkip = Math.Max(skip ?? 0, 0);
    var hasFilters = tag is not null || subject is not null || barcode is not null
                  || status is not null || location is not null;

    // Use Meilisearch for free-text queries (it has typo tolerance),
    // fall back to SQL when Meilisearch is unreachable or when using structured filters.
    if (!string.IsNullOrWhiteSpace(q) && !hasFilters && await meili.IsHealthyAsync(ct))
    {
        var meiliResult = await meili.SearchAsync(householdId, q, actualTake, actualSkip, ct);
        if (meiliResult.ItemIds.Count > 0 || actualSkip > 0)
        {
            // Fetch full item data from SQL for the matched IDs
            var paged = await repo.GetByIdsAsync(
                new HouseholdId(householdId), meiliResult.ItemIds, ct);
            return Results.Ok(new { TotalCount = meiliResult.EstimatedTotalHits, Items = paged });
        }
        // If Meilisearch returned 0 hits at offset 0, return empty
        if (meiliResult.ItemIds.Count == 0 && actualSkip == 0)
            return Results.Ok(new { TotalCount = 0, Items = Array.Empty<ItemSearchResult>() });
    }

    // Fallback: SQL multi-word AND search
    var sqlPaged = await repo.SearchAsync(
        new HouseholdId(householdId),
        q,
        tag,
        subject,
        barcode,
        status,
        location,
        actualTake,
        actualSkip,
        ct);

    return Results.Ok(new { sqlPaged.TotalCount, Items = sqlPaged.Items });
}).RequireAuthorization();

// Distinct locations used across a household's library
app.MapGet("/api/households/{householdId:guid}/locations", async (
    Guid householdId,
    SqlConnectionFactory dbFactory,
    CancellationToken ct) =>
{
    using var db = dbFactory.Create();
    var locations = await Dapper.SqlMapper.QueryAsync<string>(db,
        """
        SELECT DISTINCT Location FROM dbo.LibraryItem
        WHERE OwnerHouseholdId = @HouseholdId AND Location IS NOT NULL AND Location <> ''
        ORDER BY Location
        """,
        new { HouseholdId = householdId });
    return Results.Ok(locations);
}).RequireAuthorization();

// Duplicate detection
app.MapGet("/api/households/{householdId:guid}/items/duplicates", async (
    Guid householdId,
    IItemSearchRepository repo,
    CancellationToken ct) =>
{
    var groups = await repo.FindDuplicatesAsync(new HouseholdId(householdId), ct);
    return Results.Ok(groups);
}).RequireAuthorization();

// Merge duplicates — keep one item, delete the rest
app.MapPost("/api/households/{householdId:guid}/items/merge-duplicates", async (
    Guid householdId,
    MergeDuplicatesRequest request,
    ILibraryItemRepository repo,
    CancellationToken ct) =>
{
    var deleted = 0;
    foreach (var id in request.DeleteItemIds)
    {
        if (await repo.DeleteAsync(new ItemId(id), ct))
            deleted++;
    }
    return Results.Ok(new { kept = request.KeepItemId, deleted });
}).RequireAuthorization();

// Bulk merge all duplicates — keeps oldest item per title+author group, deletes the rest
app.MapPost("/api/households/{householdId:guid}/items/merge-all-duplicates", async (
    Guid householdId,
    IItemSearchRepository searchRepo,
    ILibraryItemRepository itemRepo,
    CancellationToken ct) =>
{
    var groups = await searchRepo.FindDuplicatesAsync(new HouseholdId(householdId), ct);
    var totalDeleted = 0;
    var groupsMerged = 0;

    foreach (var group in groups)
    {
        // Keep the oldest item (first by CreatedUtc), delete the rest
        var keep = group.Items.OrderBy(i => i.CreatedUtc).First();
        foreach (var item in group.Items.Where(i => i.ItemId != keep.ItemId))
        {
            if (await itemRepo.DeleteAsync(new ItemId(item.ItemId), ct))
                totalDeleted++;
        }
        groupsMerged++;
    }

    return Results.Ok(new { groupsMerged, totalDeleted });
}).RequireAuthorization();

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
}).RequireAuthorization();

app.MapGet("/api/imports/batches/{batchId:guid}", async (Guid batchId, IImportRepository repo, CancellationToken ct) =>
{
    var batch = await repo.GetBatchAsync(new ImportBatchId(batchId), ct);
    if (batch is null)
        return Results.NotFound();

    var counts = await repo.GetBatchStatusCountsAsync(new ImportBatchId(batchId), ct);
    return Results.Ok(new { batch, counts });
}).RequireAuthorization();

app.MapGet("/api/imports/batches/{batchId:guid}/errors", async (
    Guid batchId,
    int? take,
    int? skip,
    IImportRepository repo,
    CancellationToken ct) =>
{
    var failures = await repo.ListFailuresAsync(new ImportBatchId(batchId), Math.Clamp(take ?? 50, 1, 200), Math.Max(skip ?? 0, 0), ct);
    return Results.Ok(failures);
}).RequireAuthorization();

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
}).RequireAuthorization();

app.MapGet("/api/accounts/{accountId:guid}", async (Guid accountId, IAccountRepository repo, CancellationToken ct) =>
{
    var account = await repo.GetByIdAsync(new AccountId(accountId), ct);
    return account is null ? Results.NotFound() : Results.Ok(account);
}).RequireAuthorization();

app.MapPost("/api/accounts/{accountId:guid}/households/{householdId:guid}", async (
    Guid accountId,
    Guid householdId,
    IAccountHouseholdRepository repo,
    CancellationToken ct) =>
{
    await repo.AddAsync(new AccountId(accountId), new HouseholdId(householdId), "Owner", ct);
    return Results.NoContent();
}).RequireAuthorization();

app.MapGet("/api/accounts/{accountId:guid}/households", async (
    Guid accountId,
    IAccountHouseholdRepository repo,
    CancellationToken ct) =>
{
    var households = await repo.ListHouseholdsAsync(new AccountId(accountId), ct);
    return Results.Ok(households.Select(h => new { id = h.HouseholdId.Value, role = h.Role }));
}).RequireAuthorization();

// ─── Household Members ────────────────────────────────────────────────────────

// List all members of a household
app.MapGet("/api/households/{householdId:guid}/members", async (
    Guid householdId,
    IAccountHouseholdRepository repo,
    CancellationToken ct) =>
{
    var members = await repo.ListMembersAsync(new HouseholdId(householdId), ct);
    return Results.Ok(members);
}).RequireAuthorization();

// Add a member to a household by email
app.MapPost("/api/households/{householdId:guid}/members", async (
    Guid householdId,
    AddMemberRequest request,
    IAccountRepository accountRepo,
    IAccountHouseholdRepository ahRepo,
    CancellationToken ct) =>
{
    var account = await accountRepo.GetByEmailAsync(request.Email, ct);
    if (account is null)
        return Results.NotFound(new { message = $"No account found with email '{request.Email}'" });

    var role = request.Role ?? "Member";
    await ahRepo.AddAsync(account.Id, new HouseholdId(householdId), role, ct);
    return Results.Ok(new { accountId = account.Id.Value, displayName = account.DisplayName, firstName = account.FirstName, lastName = account.LastName, email = account.Email, role });
}).RequireAuthorization();

// Update a member's role
app.MapPatch("/api/households/{householdId:guid}/members/{accountId:guid}", async (
    Guid householdId,
    Guid accountId,
    UpdateMemberRoleRequest request,
    IAccountHouseholdRepository repo,
    CancellationToken ct) =>
{
    await repo.UpdateRoleAsync(new AccountId(accountId), new HouseholdId(householdId), request.Role, ct);
    return Results.NoContent();
}).RequireAuthorization();

// Remove a member from a household
app.MapDelete("/api/households/{householdId:guid}/members/{accountId:guid}", async (
    Guid householdId,
    Guid accountId,
    IAccountHouseholdRepository repo,
    CancellationToken ct) =>
{
    await repo.RemoveMemberAsync(new AccountId(accountId), new HouseholdId(householdId), ct);
    return Results.NoContent();
}).RequireAuthorization();

// ─── Auth endpoints ───────────────────────────────────────────────────────────

// POST /api/auth/login — called after Auth0 login; auto-provisions account + default household
app.MapPost("/api/auth/login", async (
    HttpContext http,
    IAccountRepository accountRepo,
    IHouseholdRepository householdRepo,
    IAccountHouseholdRepository accountHouseholdRepo,
    CancellationToken ct) =>
{
    var sub = http.User.FindFirstValue(ClaimTypes.NameIdentifier)
           ?? http.User.FindFirstValue("sub");
    if (string.IsNullOrEmpty(sub))
        return Results.Unauthorized();

    var email = http.User.FindFirstValue(ClaimTypes.Email)
             ?? http.User.FindFirstValue("email");
    var firstName = http.User.FindFirstValue(ClaimTypes.GivenName)
                 ?? http.User.FindFirstValue("given_name");
    var lastName = http.User.FindFirstValue(ClaimTypes.Surname)
                ?? http.User.FindFirstValue("family_name");
    var name = http.User.FindFirstValue("name")
            ?? http.User.FindFirstValue(ClaimTypes.Name)
            ?? $"{firstName} {lastName}".Trim();
    if (string.IsNullOrWhiteSpace(name)) name = email ?? "User";

    // Build display name from first/last if available
    var displayName = !string.IsNullOrWhiteSpace(firstName)
        ? !string.IsNullOrWhiteSpace(lastName) ? $"{firstName} {lastName}" : firstName
        : name;

    // Check if account already exists by Auth0 sub
    var account = await accountRepo.GetByAuth0SubAsync(sub, ct);
    if (account is not null)
    {
        // Refresh name + email from Auth0 profile on each login
        await accountRepo.UpdateNameAsync(account.Id, firstName, lastName, displayName, email, ct);
        // Re-read so we get the COALESCE'd DB values (token claims may be null)
        account = await accountRepo.GetByAuth0SubAsync(sub, ct);
        var existingHouseholds = await accountHouseholdRepo.ListHouseholdsAsync(account!.Id, ct);

        return Results.Ok(new AuthLoginResponse(
            account.Id.Value,
            account.DisplayName,
            account.FirstName,
            account.LastName,
            email ?? account.Email,
            existingHouseholds.Select(h => new AuthHousehold(h.HouseholdId.Value, h.Role)).ToList(),
            false));
    }

    // Check if an account already exists by email (pre-existing user, first Auth0 login)
    if (!string.IsNullOrEmpty(email))
    {
        account = await accountRepo.GetByEmailAsync(email, ct);
        if (account is not null)
        {
            // Link the Auth0 sub to the existing account + update name
            await accountRepo.UpdateAuth0SubAsync(account.Id, sub, ct);
            await accountRepo.UpdateNameAsync(account.Id, firstName, lastName, displayName, email, ct);
            // Re-read so we get the COALESCE'd DB values (token claims may be null)
            account = await accountRepo.GetByAuth0SubAsync(sub, ct);
            var existingHouseholds = await accountHouseholdRepo.ListHouseholdsAsync(account!.Id, ct);

            // If user has no household where they are Owner, create a default one
            if (!existingHouseholds.Any(h => h.Role == "Owner"))
            {
                var defaultHousehold = new Household { Name = $"{account.DisplayName}'s Library" };
                await householdRepo.CreateAsync(defaultHousehold, ct);
                await accountHouseholdRepo.AddAsync(account.Id, defaultHousehold.Id, "Owner", ct);
                existingHouseholds = await accountHouseholdRepo.ListHouseholdsAsync(account.Id, ct);
            }

            return Results.Ok(new AuthLoginResponse(
                account.Id.Value,
                account.DisplayName,
                account.FirstName,
                account.LastName,
                email ?? account.Email,
                existingHouseholds.Select(h => new AuthHousehold(h.HouseholdId.Value, h.Role)).ToList(),
                false));
        }
    }

    // Brand-new user: create account, default household, link them
    account = new Account
    {
        DisplayName = displayName,
        FirstName = firstName,
        LastName = lastName,
        Email = email,
        Auth0Sub = sub
    };
    await accountRepo.CreateAsync(account, ct);

    var household = new Household { Name = $"{displayName}'s Library" };
    await householdRepo.CreateAsync(household, ct);
    await accountHouseholdRepo.AddAsync(account.Id, household.Id, "Owner", ct);

    var households = await accountHouseholdRepo.ListHouseholdsAsync(account.Id, ct);
    return Results.Ok(new AuthLoginResponse(
        account.Id.Value,
        account.DisplayName,
        account.FirstName,
        account.LastName,
        account.Email,
        households.Select(h => new AuthHousehold(h.HouseholdId.Value, h.Role)).ToList(),
        true));
}).RequireAuthorization();

// GET /api/auth/me — returns current user info + households
app.MapGet("/api/auth/me", async (
    HttpContext http,
    IAccountRepository accountRepo,
    IAccountHouseholdRepository accountHouseholdRepo,
    CancellationToken ct) =>
{
    var sub = http.User.FindFirstValue(ClaimTypes.NameIdentifier)
           ?? http.User.FindFirstValue("sub");
    if (string.IsNullOrEmpty(sub))
        return Results.Unauthorized();

    var account = await accountRepo.GetByAuth0SubAsync(sub, ct);
    if (account is null)
        return Results.NotFound();

    var households = await accountHouseholdRepo.ListHouseholdsAsync(account.Id, ct);
    return Results.Ok(new AuthMeResponse(
        account.Id.Value,
        account.DisplayName,
        account.FirstName,
        account.LastName,
        account.Email,
        households.Select(h => new AuthHousehold(h.HouseholdId.Value, h.Role)).ToList()));
}).RequireAuthorization();

// PUT /api/auth/profile — update current user's first/last name
app.MapPut("/api/auth/profile", async (
    HttpContext http,
    UpdateProfileRequest request,
    IAccountRepository accountRepo,
    CancellationToken ct) =>
{
    var sub = http.User.FindFirstValue(ClaimTypes.NameIdentifier)
           ?? http.User.FindFirstValue("sub");
    if (string.IsNullOrEmpty(sub))
        return Results.Unauthorized();

    var account = await accountRepo.GetByAuth0SubAsync(sub, ct);
    if (account is null)
        return Results.NotFound();

    var displayName = $"{request.FirstName} {request.LastName}".Trim();
    if (string.IsNullOrWhiteSpace(displayName)) displayName = account.DisplayName;

    await accountRepo.UpdateNameAsync(account.Id, request.FirstName, request.LastName, displayName, account.Email, ct);
    return Results.Ok(new { displayName, firstName = request.FirstName, lastName = request.LastName });
}).RequireAuthorization();

// Normalized model endpoints
app.MapGet("/api/works/{workId:guid}", async (Guid workId, IWorkRepository repo, CancellationToken ct) =>
{
    var work = await repo.GetByIdAsync(new WorkId(workId), ct);
    return work is null ? Results.NotFound() : Results.Ok(work);
}).RequireAuthorization();

app.MapGet("/api/editions/{editionId:guid}", async (Guid editionId, IEditionRepository repo, CancellationToken ct) =>
{
    var edition = await repo.GetByIdAsync(new EditionId(editionId), ct);
    return edition is null ? Results.NotFound() : Results.Ok(edition);
}).RequireAuthorization();

app.MapGet("/api/items/{itemId:guid}", async (Guid itemId, ILibraryItemRepository repo, CancellationToken ct) =>
{
    var item = await repo.GetFullByIdAsync(new ItemId(itemId), ct);
    return item is null ? Results.NotFound() : Results.Ok(item);
}).RequireAuthorization();

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
}).RequireAuthorization();

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
}).RequireAuthorization();

app.MapPost("/api/households/{householdId:guid}/items", async (
    Guid householdId,
    CreateItemRequest request,
    ILibraryItemRepository repo,
    IItemEventRepository eventRepo,
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
        ReadStatus = request.ReadStatus,
        CompletedDate = request.CompletedDate,
        DateStarted = request.DateStarted,
        UserRating = request.UserRating,
        MetadataJson = request.MetadataJson
    };

    await repo.CreateAsync(item, ct);

    // Auto-record "Acquired" event
    await eventRepo.CreateAsync(new ItemEvent
    {
        ItemId = item.Id,
        EventTypeId = 1, // Acquired
        OccurredUtc = item.AcquiredOn.HasValue
            ? new DateTimeOffset(item.AcquiredOn.Value, TimeOnly.MinValue, TimeSpan.Zero)
            : DateTimeOffset.UtcNow,
        Notes = "Added to library"
    }, ct);

    return Results.Created($"/api/items/{item.Id.Value}", item);
}).RequireAuthorization();

// Dedup index for import: returns existing barcodes, titles, identifiers
app.MapGet("/api/households/{householdId:guid}/library/dedup-index", async (
    Guid householdId,
    ILibraryItemLookupRepository lookupRepo,
    CancellationToken ct) =>
{
    var index = await lookupRepo.GetDedupIndexAsync(new HouseholdId(householdId), ct);
    return Results.Ok(new
    {
        barcodes = index.Barcodes,
        normalizedTitles = index.NormalizedTitles,
        identifiers = index.IdentifierValues.Keys
    });
}).RequireAuthorization();

// One-shot create: work + edition + item + metadata
app.MapPost("/api/households/{householdId:guid}/library/books", async (
    HttpContext http,
    Guid householdId,
    CreateBookIngestRequest request,
    IWorkRepository workRepo,
    IEditionRepository editionRepo,
    ILibraryItemRepository itemRepo,
    IWorkMetadataRepository metaRepo,
    IMeilisearchService meili,
    IItemSearchRepository searchRepo,
    IItemEventRepository eventRepo,
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
        ReadStatus = request.Item.ReadStatus,
        CompletedDate = request.Item.CompletedDate,
        DateStarted = request.Item.DateStarted,
        UserRating = request.Item.UserRating,
        LibraryOrder = request.Item.LibraryOrder,
        MetadataJson = request.Item.MetadataJson
    };

    await itemRepo.CreateAsync(item, ct);

    // Auto-record "Acquired" event
    _ = Task.Run(() => RecordAcquiredEventAsync(eventRepo, item.Id, request.Item.AcquiredOn));

    // Record source-specific event (Imported vs manual add)
    var source = http.Request.Query["source"].FirstOrDefault();
    if (string.Equals(source, "import", StringComparison.OrdinalIgnoreCase))
    {
        _ = Task.Run(async () =>
        {
            try
            {
                await eventRepo.CreateAsync(new ItemEvent
                {
                    ItemId = item.Id,
                    EventTypeId = 21, // Imported
                    Notes = "Imported from file"
                }, CancellationToken.None);
            }
            catch { /* best-effort */ }
        });
    }

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

    // Sync to Meilisearch (best effort)
    _ = Task.Run(async () =>
    {
        try
        {
            if (!await meili.IsHealthyAsync(CancellationToken.None)) return;
            // Re-fetch via SQL to get the full flattened search result with authors/tags/etc
            var items = await searchRepo.GetByIdsAsync(
                new HouseholdId(householdId), [item.Id.Value], CancellationToken.None);
            if (items.Count > 0)
                await meili.IndexItemAsync(householdId, items[0], CancellationToken.None);
        }
        catch { /* Meilisearch sync is best-effort */ }
    });

    return Results.Created($"/api/items/{item.Id.Value}", response);
}).RequireAuthorization();

// Fire-and-forget: record the "Acquired" event for the newly created book
static async Task RecordAcquiredEventAsync(IItemEventRepository eventRepo, ItemId itemId, DateOnly? acquiredOn)
{
    try
    {
        await eventRepo.CreateAsync(new ItemEvent
        {
            ItemId = itemId,
            EventTypeId = 1, // Acquired
            OccurredUtc = acquiredOn.HasValue
                ? new DateTimeOffset(acquiredOn.Value, TimeOnly.MinValue, TimeSpan.Zero)
                : DateTimeOffset.UtcNow,
            Notes = "Added to library"
        }, CancellationToken.None);
    }
    catch { /* best-effort */ }
}

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
}).RequireAuthorization();

app.MapPost("/api/households/{householdId:guid}/works/{workId:guid}/tags", async (Guid householdId, Guid workId, AddTagRequest request, IWorkMetadataRepository repo, CancellationToken ct) =>
{
    await repo.AddTagAsync(new WorkId(workId), new HouseholdId(householdId), request.Name, ct);
    return Results.Ok();
}).RequireAuthorization();

app.MapPost("/api/works/{workId:guid}/subjects", async (Guid workId, AddSubjectRequest request, IWorkMetadataRepository repo, CancellationToken ct) =>
{
    await repo.AddSubjectAsync(new WorkId(workId), new SubjectSchemeId(request.SchemeId), request.Text, ct);
    return Results.Ok();
}).RequireAuthorization();

app.MapPost("/api/editions/{editionId:guid}/identifiers", async (Guid editionId, AddEditionIdentifierRequest request, IWorkMetadataRepository repo, CancellationToken ct) =>
{
    await repo.AddEditionIdentifierAsync(new EditionId(editionId), new IdentifierTypeId(request.IdentifierTypeId), request.Value, request.IsPrimary, ct);
    return Results.Ok();
}).RequireAuthorization();

// ── Item Event Log ──────────────────────────────────────────────────────────

// List all event types (for dropdowns)
app.MapGet("/api/item-event-types", async (IItemEventRepository repo, CancellationToken ct) =>
{
    var types = await repo.ListEventTypesAsync(ct);
    return Results.Ok(types);
}).RequireAuthorization();

// Get chronological timeline for an item
app.MapGet("/api/items/{itemId:guid}/events", async (Guid itemId, IItemEventRepository repo, CancellationToken ct) =>
{
    var timeline = await repo.GetTimelineAsync(new ItemId(itemId), ct);
    return Results.Ok(timeline);
}).RequireAuthorization();

// Record a new event for an item
app.MapPost("/api/items/{itemId:guid}/events", async (
    Guid itemId,
    CreateItemEventRequest request,
    IItemEventRepository repo,
    ILibraryItemRepository itemRepo,
    CancellationToken ct) =>
{
    // Verify item exists
    var item = await itemRepo.GetByIdAsync(new ItemId(itemId), ct);
    if (item is null)
        return Results.NotFound();

    var evt = new ItemEvent
    {
        ItemId = new ItemId(itemId),
        EventTypeId = request.EventTypeId,
        OccurredUtc = request.OccurredUtc ?? DateTimeOffset.UtcNow,
        Notes = request.Notes,
        DetailJson = request.DetailJson
    };

    await repo.CreateAsync(evt, ct);
    return Results.Created($"/api/items/{itemId}/events/{evt.Id}", evt);
}).RequireAuthorization();

// Delete an event entry
app.MapDelete("/api/items/{itemId:guid}/events/{eventId:guid}", async (
    Guid itemId,
    Guid eventId,
    IItemEventRepository repo,
    CancellationToken ct) =>
{
    var deleted = await repo.DeleteAsync(eventId, ct);
    return deleted ? Results.NoContent() : Results.NotFound();
}).RequireAuthorization();

app.MapDelete("/api/items/{itemId:guid}", async (Guid itemId, ILibraryItemRepository repo, IMeilisearchService meili, CancellationToken ct) =>
{
    var deleted = await repo.DeleteAsync(new ItemId(itemId), ct);
    if (deleted)
    {
        // Remove from Meilisearch (best effort)
        _ = Task.Run(async () =>
        {
            try { await meili.RemoveItemAsync(itemId, CancellationToken.None); } catch { }
        });
    }
    return deleted ? Results.NoContent() : Results.NotFound();
}).RequireAuthorization();

app.MapPatch("/api/items/{itemId:guid}", async (
    HttpContext http,
    Guid itemId,
    PatchItemRequest request,
    IItemUpdateRepository updateRepo,
    ILibraryItemRepository itemRepo,
    ITagRepository tagRepo,
    IWorkRepository workRepo,
    IEditionRepository editionRepo,
    IWorkMetadataRepository workMetaRepo,
    IMeilisearchService meili,
    IItemSearchRepository searchRepo,
    IItemEventRepository eventRepo,
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
        Notes: ToPatchString(request.Notes),
        ReadStatus: ToPatchString(request.ReadStatus),
        CompletedDate: ToPatchString(request.CompletedDate),
        DateStarted: ToPatchString(request.DateStarted),
        UserRating: ToPatchDecimal(request.UserRating),
        LibraryOrder: ToPatchInt(request.LibraryOrder));

    try
    {
        await updateRepo.UpdateInventoryAsync(new ItemId(itemId), patch, ct);
    }
    catch (InvalidOperationException ex) when (ex.InnerException is not null)
    {
        return Results.Conflict(new { message = ex.Message });
    }

    // Auto-record events for meaningful field changes (best-effort, fire-and-forget)
    _ = Task.Run(async () =>
    {
        try
        {
            // Status changed (e.g. Available → Lent Out)
            if (patch.Status is { IsSpecified: true } patchStatus && patchStatus.Value != item.Status)
            {
                await eventRepo.CreateAsync(new ItemEvent
                {
                    ItemId = new ItemId(itemId),
                    EventTypeId = 19, // StatusChanged
                    Notes = $"Status changed from \"{item.Status ?? "none"}\" to \"{patchStatus.Value ?? "none"}\""
                }, CancellationToken.None);
            }

            // Location changed (shelf move)
            if (patch.Location is { IsSpecified: true } patchLoc && patchLoc.Value != item.Location)
            {
                await eventRepo.CreateAsync(new ItemEvent
                {
                    ItemId = new ItemId(itemId),
                    EventTypeId = 3, // Moved
                    Notes = $"Moved from \"{item.Location ?? "unset"}\" to \"{patchLoc.Value ?? "unset"}\""
                }, CancellationToken.None);
            }

            // Started reading
            if (patch.ReadStatus is { IsSpecified: true } patchRead)
            {
                if (patchRead.Value == "Reading" && item.ReadStatus != "Reading")
                {
                    await eventRepo.CreateAsync(new ItemEvent
                    {
                        ItemId = new ItemId(itemId),
                        EventTypeId = 4 // StartedReading
                    }, CancellationToken.None);
                }
                else if (patchRead.Value == "Read" && item.ReadStatus != "Read")
                {
                    await eventRepo.CreateAsync(new ItemEvent
                    {
                        ItemId = new ItemId(itemId),
                        EventTypeId = 5 // FinishedReading
                    }, CancellationToken.None);
                }
            }

            // Rating changed
            if (patch.UserRating is { IsSpecified: true } patchRating && patchRating.Value != item.UserRating)
            {
                await eventRepo.CreateAsync(new ItemEvent
                {
                    ItemId = new ItemId(itemId),
                    EventTypeId = 14, // Rated
                    Notes = $"Rated {patchRating.Value}"
                }, CancellationToken.None);
            }
        }
        catch { /* event recording is best-effort */ }
    });

    // Record source-specific event: Enriched vs Edited (best-effort)
    var patchSource = http.Request.Query["source"].FirstOrDefault();
    if (!string.IsNullOrEmpty(patchSource))
    {
        _ = Task.Run(async () =>
        {
            try
            {
                if (string.Equals(patchSource, "enrichment", StringComparison.OrdinalIgnoreCase))
                {
                    await eventRepo.CreateAsync(new ItemEvent
                    {
                        ItemId = new ItemId(itemId),
                        EventTypeId = 22, // Enriched
                        Notes = "Enriched from external API"
                    }, CancellationToken.None);
                }
                else if (string.Equals(patchSource, "edit", StringComparison.OrdinalIgnoreCase))
                {
                    await eventRepo.CreateAsync(new ItemEvent
                    {
                        ItemId = new ItemId(itemId),
                        EventTypeId = 23, // Edited
                        Notes = "Manually edited"
                    }, CancellationToken.None);
                }
            }
            catch { /* best-effort */ }
        });
    }

    // Handle tags if provided
    if (request.Tags is not null && request.Tags.Value.ValueKind != JsonValueKind.Undefined)
    {
        var tagNames = ParseTagNames(request.Tags.Value);

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

    try
    {
    // --- Update Work fields ---
    if (request.Work is not null)
    {
        var w = request.Work;
        var title = ToPatchString(w.Title);
        // Only call update if at least the title is resolvable
        var resolvedTitle = title.IsSpecified ? title.Value : null;
        // We always send all fields; unspecified means "leave as-is" handled by coalesce
        await workRepo.UpdateAsync(
            item.WorkId,
            resolvedTitle ?? item.Title, // fallback to current title
            ToPatchString(w.Subtitle) is { IsSpecified: true } sub ? sub.Value : null,
            ToPatchString(w.SortTitle) is { IsSpecified: true } st ? st.Value : null,
            ToPatchString(w.Description) is { IsSpecified: true } desc ? desc.Value : null,
            ToPatchString(w.OriginalTitle) is { IsSpecified: true } ot ? ot.Value : null,
            ToPatchString(w.Language) is { IsSpecified: true } lng ? lng.Value : null,
            ToPatchString(w.MetadataJson) is { IsSpecified: true } wmj ? wmj.Value : null,
            ct);
    }

    // --- Update Edition fields ---
    if (request.Edition is not null && item.EditionId is { } editionId)
    {
        var e = request.Edition;
        await editionRepo.UpdateAsync(
            editionId,
            ToPatchString(e.Publisher) is { IsSpecified: true } pub ? pub.Value : null,
            ToPatchInt(e.PublishedYear) is { IsSpecified: true } py ? (int?)py.Value : null,
            ToPatchInt(e.PageCount) is { IsSpecified: true } pc ? (int?)pc.Value : null,
            ToPatchString(e.Description) is { IsSpecified: true } edesc ? edesc.Value : null,
            ToPatchString(e.Format) is { IsSpecified: true } fmt ? fmt.Value : null,
            ToPatchString(e.Binding) is { IsSpecified: true } bnd ? bnd.Value : null,
            ToPatchString(e.EditionStatement) is { IsSpecified: true } es ? es.Value : null,
            ToPatchString(e.PlaceOfPublication) is { IsSpecified: true } pop ? pop.Value : null,
            ToPatchString(e.Language) is { IsSpecified: true } elng ? elng.Value : null,
            ToPatchString(e.MetadataJson) is { IsSpecified: true } emj ? emj.Value : null,
            ct);
    }

    // --- Update Item MetadataJson ---
    if (request.ItemMetadataJson is not null)
    {
        var metaVal = ToPatchString(request.ItemMetadataJson);
        if (metaVal.IsSpecified)
        {
            await updateRepo.UpdateMetadataJsonAsync(new ItemId(itemId), metaVal.Value, ct);
        }
    }

    // --- Replace Contributors ---
    if (request.Contributors is not null)
    {
        var contributors = request.Contributors.Select(c =>
        {
            var person = new Person
            {
                Id = new PersonId(c.PersonId ?? Guid.NewGuid()),
                DisplayName = c.DisplayName,
                SortName = c.SortName,
                BirthYear = c.BirthYear,
                DeathYear = c.DeathYear,
            };
            return (person, new ContributorRoleId(c.RoleId), c.Ordinal);
        }).ToList();

        await workMetaRepo.ReplaceContributorsAsync(item.WorkId, contributors, ct);
    }

    // --- Replace Subjects ---
    if (request.Subjects is not null)
    {
        var subjects = request.Subjects
            .Select(s => (new SubjectSchemeId(s.SchemeId), s.Text))
            .ToList();
        await workMetaRepo.ReplaceSubjectsAsync(item.WorkId, subjects, ct);
    }

    // --- Replace Identifiers ---
    if (request.Identifiers is not null && item.EditionId is { } eid)
    {
        var identifiers = request.Identifiers
            .Select(i => (new IdentifierTypeId(i.IdentifierTypeId), i.Value, i.IsPrimary))
            .ToList();
        await workMetaRepo.ReplaceIdentifiersAsync(eid, identifiers, ct);
    }

    // --- Replace Series ---
    if (request.Series is not null)
    {
        await workMetaRepo.ReplaceSeriesAsync(
            item.WorkId,
            request.Series.Name,
            request.Series.VolumeNumber,
            request.Series.Ordinal,
            ct);
    }
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"[PATCH /api/items/{itemId}] Error: {ex}");
        return Results.Problem(
            detail: ex.Message,
            statusCode: 500,
            title: "Error updating item");
    }

    // Return full response with updated data
    var fullItem = await itemRepo.GetFullByIdAsync(new ItemId(itemId), ct);

    // Sync to Meilisearch (best effort)
    _ = Task.Run(async () =>
    {
        try
        {
            if (!await meili.IsHealthyAsync(CancellationToken.None)) return;
            var items = await searchRepo.GetByIdsAsync(
                item.OwnerHouseholdId, [itemId], CancellationToken.None);
            if (items.Count > 0)
                await meili.IndexItemAsync(item.OwnerHouseholdId.Value, items[0], CancellationToken.None);
        }
        catch { /* Meilisearch sync is best-effort */ }
    });

    return Results.Ok(fullItem);
}).RequireAuthorization();

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

static PatchField<int?> ToPatchInt(JsonElement? el)
{
    if (el is null) return PatchField<int?>.Unspecified;
    if (el.Value.ValueKind == JsonValueKind.Null) return PatchField<int?>.From(null);

    if (el.Value.ValueKind == JsonValueKind.Number && el.Value.TryGetInt32(out var i))
        return PatchField<int?>.From(i);

    if (el.Value.ValueKind == JsonValueKind.String && int.TryParse(el.Value.GetString(), out var si))
        return PatchField<int?>.From(si);

    throw new InvalidOperationException("Invalid integer format for libraryOrder.");
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
.DisableAntiforgery()
.RequireAuthorization();

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
}).RequireAuthorization();

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
}).RequireAuthorization();

// ─── Item custom cover (user-uploaded photo of actual book) ─────────────

app.MapPost("/api/items/{itemId:guid}/cover", async (
    Guid itemId,
    IFormFile file,
    IBlobStorageService blobService,
    ILibraryItemRepository itemRepo,
    CancellationToken ct) =>
{
    if (file.Length == 0)
        return Results.BadRequest(new { message = "File is empty." });

    if (file.Length > 10 * 1024 * 1024) // 10MB for photos
        return Results.BadRequest(new { message = "File size exceeds 10MB limit." });

    var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic" };
    if (!allowedTypes.Contains(file.ContentType.ToLowerInvariant()))
        return Results.BadRequest(new { message = "Invalid file type. Allowed: jpeg, png, webp, gif, heic." });

    var item = await itemRepo.GetByIdAsync(new ItemId(itemId), ct);
    if (item is null)
        return Results.NotFound();

    var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
    if (string.IsNullOrEmpty(extension))
        extension = file.ContentType switch
        {
            "image/jpeg" => ".jpg",
            "image/png" => ".png",
            "image/webp" => ".webp",
            "image/gif" => ".gif",
            "image/heic" => ".heic",
            _ => ".jpg"
        };

    // Delete old custom cover if one exists
    if (!string.IsNullOrEmpty(item.CustomCoverUrl))
    {
        try
        {
            var oldPath = item.CustomCoverUrl.TrimStart('/');
            await blobService.DeleteAsync(oldPath, ct);
        }
        catch { /* ignore cleanup failures */ }
    }

    var fileName = $"item-covers/{itemId}/{Guid.NewGuid()}{extension}";

    await using var stream = file.OpenReadStream();
    var url = await blobService.UploadAsync(fileName, stream, file.ContentType, ct);

    await itemRepo.UpdateCustomCoverUrlAsync(new ItemId(itemId), url, ct);

    return Results.Ok(new { customCoverUrl = url });
})
.DisableAntiforgery()
.RequireAuthorization();

app.MapDelete("/api/items/{itemId:guid}/cover", async (
    Guid itemId,
    IBlobStorageService blobService,
    ILibraryItemRepository itemRepo,
    CancellationToken ct) =>
{
    var item = await itemRepo.GetByIdAsync(new ItemId(itemId), ct);
    if (item is null)
        return Results.NotFound();

    if (!string.IsNullOrEmpty(item.CustomCoverUrl))
    {
        try
        {
            var oldPath = item.CustomCoverUrl.TrimStart('/');
            await blobService.DeleteAsync(oldPath, ct);
        }
        catch { /* ignore cleanup failures */ }
    }

    await itemRepo.UpdateCustomCoverUrlAsync(new ItemId(itemId), null, ct);
    return Results.NoContent();
}).RequireAuthorization();

// ─── Inventory verification (mark a book as physically checked) ─────────
app.MapPost("/api/items/{itemId:guid}/verify", async (
    Guid itemId,
    ILibraryItemRepository itemRepo,
    IItemUpdateRepository updateRepo,
    IItemEventRepository eventRepo,
    CancellationToken ct) =>
{
    var item = await itemRepo.GetByIdAsync(new ItemId(itemId), ct);
    if (item is null) return Results.NotFound();

    // Merge inventoryVerifiedDate into existing metadata JSON
    var meta = new Dictionary<string, object?>();
    if (!string.IsNullOrEmpty(item.MetadataJson))
    {
        try { meta = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object?>>(item.MetadataJson) ?? new(); }
        catch { meta = new(); }
    }
    var verifiedDate = DateTimeOffset.UtcNow;
    meta["inventoryVerifiedDate"] = verifiedDate.ToString("o");
    var newJson = System.Text.Json.JsonSerializer.Serialize(meta);
    await updateRepo.UpdateMetadataJsonAsync(new ItemId(itemId), newJson, ct);

    // Record event
    await eventRepo.CreateAsync(new ItemEvent
    {
        ItemId = new ItemId(itemId),
        EventTypeId = 24, // InventoryVerified
        OccurredUtc = verifiedDate,
        Notes = "Inventory verified"
    }, ct);

    return Results.Ok(new { inventoryVerifiedDate = meta["inventoryVerifiedDate"] });
}).RequireAuthorization();

app.MapDelete("/api/items/{itemId:guid}/verify", async (
    Guid itemId,
    ILibraryItemRepository itemRepo,
    IItemUpdateRepository updateRepo,
    IItemEventRepository eventRepo,
    CancellationToken ct) =>
{
    var item = await itemRepo.GetByIdAsync(new ItemId(itemId), ct);
    if (item is null) return Results.NotFound();

    var meta = new Dictionary<string, object?>();
    if (!string.IsNullOrEmpty(item.MetadataJson))
    {
        try { meta = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object?>>(item.MetadataJson) ?? new(); }
        catch { meta = new(); }
    }
    meta.Remove("inventoryVerifiedDate");
    var newJson = System.Text.Json.JsonSerializer.Serialize(meta);
    await updateRepo.UpdateMetadataJsonAsync(new ItemId(itemId), newJson, ct);

    // Record un-verify event
    await eventRepo.CreateAsync(new ItemEvent
    {
        ItemId = new ItemId(itemId),
        EventTypeId = 24, // InventoryVerified
        OccurredUtc = DateTimeOffset.UtcNow,
        Notes = "Inventory verification removed"
    }, ct);

    return Results.NoContent();
}).RequireAuthorization();

app.Run();

public sealed record CreateHouseholdRequest(string Name);
public sealed record CreateAccountRequest(string DisplayName, string? Email);
public sealed record MergeDuplicatesRequest(Guid KeepItemId, Guid[] DeleteItemIds);

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
string? ReadStatus,
string? CompletedDate,
string? DateStarted,
decimal? UserRating,
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
string? ReadStatus,
string? CompletedDate,
string? DateStarted,
decimal? UserRating,
int? LibraryOrder,
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

public sealed record PatchWorkFields(
    JsonElement? Title,
    JsonElement? Subtitle,
    JsonElement? SortTitle,
    JsonElement? Description,
    JsonElement? OriginalTitle,
    JsonElement? Language,
    JsonElement? MetadataJson);

public sealed record PatchEditionFields(
    JsonElement? Publisher,
    JsonElement? PublishedYear,
    JsonElement? PageCount,
    JsonElement? Description,
    JsonElement? Format,
    JsonElement? Binding,
    JsonElement? EditionStatement,
    JsonElement? PlaceOfPublication,
    JsonElement? Language,
    JsonElement? MetadataJson);

public sealed record PatchContributor(
    Guid? PersonId,
    string DisplayName,
    int RoleId,
    int Ordinal,
    string? SortName = null,
    int? BirthYear = null,
    int? DeathYear = null);

public sealed record PatchSubject(int SchemeId, string Text);
public sealed record PatchIdentifier(int IdentifierTypeId, string Value, bool IsPrimary = false);
public sealed record PatchSeries(string Name, string? VolumeNumber = null, int? Ordinal = null);

public sealed record PatchItemRequest(
    // Item-level fields
    JsonElement? Barcode,
    JsonElement? Location,
    JsonElement? Status,
    JsonElement? Condition,
    JsonElement? AcquiredOn,
    JsonElement? Price,
    JsonElement? Notes,
    JsonElement? Tags,
    JsonElement? ReadStatus,
    JsonElement? CompletedDate,
    JsonElement? DateStarted,
    JsonElement? UserRating,
    JsonElement? LibraryOrder,
    JsonElement? ItemMetadataJson,
    // Nested work / edition
    PatchWorkFields? Work,
    PatchEditionFields? Edition,
    // Related entities (full replace when present)
    List<PatchContributor>? Contributors,
    List<PatchSubject>? Subjects,
    List<PatchIdentifier>? Identifiers,
    PatchSeries? Series);

// Auth response records
public sealed record AuthHousehold(Guid Id, string Role);
public sealed record AuthLoginResponse(Guid AccountId, string DisplayName, string? FirstName, string? LastName, string? Email, IReadOnlyList<AuthHousehold> Households, bool IsNewAccount);
public sealed record AuthMeResponse(Guid AccountId, string DisplayName, string? FirstName, string? LastName, string? Email, IReadOnlyList<AuthHousehold> Households);
public sealed record UpdateProfileRequest(string FirstName, string LastName);

// Member management
public sealed record AddMemberRequest(string Email, string? Role);
public sealed record UpdateMemberRoleRequest(string Role);

// Item events
public sealed record CreateItemEventRequest(int EventTypeId, DateTimeOffset? OccurredUtc, string? Notes, string? DetailJson);