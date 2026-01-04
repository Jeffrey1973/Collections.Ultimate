using System.Text;
using System.Text.Json;
using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using CollectionsUltimate.Infrastructure.Sql;

static string NormalizeTitle(string title)
    => string.Join(' ', title.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).ToUpperInvariant();

static string? GetArg(string[] args, string name)
{
    var prefix = name + "=";
    foreach (var a in args)
    {
        if (a.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            return a[prefix.Length..];
    }

    return null;
}

static string Require(string? s, string name)
{
    if (string.IsNullOrWhiteSpace(s))
        throw new InvalidOperationException($"Missing {name}");
    return s;
}

static string NormalizeIdentifierValue(string value)
    => new string(value.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();

static string? GetString(JsonElement obj, string prop)
{
    if (!obj.TryGetProperty(prop, out var el))
        return null;

    return el.ValueKind switch
    {
        JsonValueKind.String => el.GetString(),
        JsonValueKind.Number => el.GetRawText(),
        _ => null
    };
}

static int? GetInt(JsonElement obj, string prop)
{
    if (!obj.TryGetProperty(prop, out var el))
        return null;

    if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out var i))
        return i;

    if (el.ValueKind == JsonValueKind.String && int.TryParse(el.GetString(), out var si))
        return si;

    return null;
}

static IEnumerable<string> EnumerateStrings(JsonElement el)
{
    if (el.ValueKind == JsonValueKind.String)
    {
        var s = el.GetString();
        if (!string.IsNullOrWhiteSpace(s))
            yield return s!;
        yield break;
    }

    if (el.ValueKind == JsonValueKind.Array)
    {
        foreach (var item in el.EnumerateArray())
        {
            foreach (var s in EnumerateStrings(item))
                yield return s;
        }

        yield break;
    }

    if (el.ValueKind == JsonValueKind.Object)
    {
        var s = GetString(el, "name") ?? GetString(el, "value") ?? GetString(el, "text") ?? GetString(el, "title");
        if (!string.IsNullOrWhiteSpace(s))
            yield return s!;
    }
}

static IEnumerable<string> GetStrings(JsonElement obj, params string[] props)
{
    foreach (var p in props)
    {
        if (!obj.TryGetProperty(p, out var el))
            continue;

        foreach (var s in EnumerateStrings(el))
            yield return s;
    }
}

static IEnumerable<(string DisplayName, int? RoleId)> ExtractContributors(JsonElement root)
{
    if (root.TryGetProperty("authors", out var authorsEl))
    {
        if (authorsEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in authorsEl.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.String)
                {
                    var s = item.GetString();
                    if (!string.IsNullOrWhiteSpace(s))
                        yield return (s!, 1);
                }
                else if (item.ValueKind == JsonValueKind.Object)
                {
                    var name = GetString(item, "name") ?? GetString(item, "author") ?? GetString(item, "display") ?? GetString(item, "value");
                    if (!string.IsNullOrWhiteSpace(name))
                        yield return (name!, 1);
                }
                else if (item.ValueKind == JsonValueKind.Array)
                {
                    foreach (var s in EnumerateStrings(item))
                        yield return (s, 1);
                }
            }
        }
        else
        {
            foreach (var s in EnumerateStrings(authorsEl))
                yield return (s, 1);
        }
    }

    var author = GetString(root, "author");
    if (!string.IsNullOrWhiteSpace(author))
        yield return (author!, 1);

    foreach (var s in GetStrings(root, "editors", "editor"))
        yield return (s, 2);

    foreach (var s in GetStrings(root, "translators", "translator"))
        yield return (s, 3);
}

static IEnumerable<(int IdentifierTypeId, string Value)> ExtractIdentifiers(JsonElement root)
{
    if (root.TryGetProperty("isbn", out var isbnEl))
    {
        foreach (var raw in EnumerateStrings(isbnEl))
        {
            var v = raw.Trim();
            if (v.Length == 0) continue;
            yield return (v.Length == 10 ? 1 : 2, v);
        }
    }

    foreach (var v in GetStrings(root, "isbn13"))
        yield return (2, v);

    foreach (var v in GetStrings(root, "isbn10"))
        yield return (1, v);

    foreach (var v in GetStrings(root, "originalisbn"))
        yield return (v.Trim().Length == 10 ? 1 : 2, v);

    foreach (var v in GetStrings(root, "asin"))
        yield return (3, v);

    foreach (var v in GetStrings(root, "lccn"))
        yield return (4, v);

    foreach (var v in GetStrings(root, "ean"))
        yield return (5, v);

    foreach (var v in GetStrings(root, "upc"))
        yield return (6, v);
}

static IEnumerable<string> ExtractTags(JsonElement root)
{
    foreach (var s in GetStrings(root, "tags"))
        yield return s;

    foreach (var s in GetStrings(root, "collections", "collection"))
        yield return s;
}

static IEnumerable<string> ExtractSubjects(JsonElement root)
{
    foreach (var s in GetStrings(root, "subject", "subjects"))
        yield return s;

    foreach (var s in GetStrings(root, "subject_normalized"))
        yield return s;
}

var connectionString = Require(GetArg(args, "--connection") ?? Environment.GetEnvironmentVariable("IMPORTPROC_CONNECTION"), "--connection (or IMPORTPROC_CONNECTION)");
var batchIdRaw = Require(GetArg(args, "--batch") ?? Environment.GetEnvironmentVariable("IMPORTPROC_BATCH"), "--batch (or IMPORTPROC_BATCH)");
var takeRaw = GetArg(args, "--take") ?? Environment.GetEnvironmentVariable("IMPORTPROC_TAKE");
var schemeRaw = GetArg(args, "--subject-scheme") ?? Environment.GetEnvironmentVariable("IMPORTPROC_SUBJECT_SCHEME");
var strictIdentifiersRaw = GetArg(args, "--strict-identifiers") ?? Environment.GetEnvironmentVariable("IMPORTPROC_STRICT_IDENTIFIERS");
var strictIdentifiers = string.Equals(strictIdentifiersRaw, "true", StringComparison.OrdinalIgnoreCase) || strictIdentifiersRaw == "1";

var subjectSchemeId = int.TryParse(schemeRaw, out var sid) ? sid : 1;
var take = int.TryParse(takeRaw, out var t) ? t : 500;

if (!Guid.TryParse(batchIdRaw, out var batchIdGuid))
    throw new InvalidOperationException("--batch must be a GUID");

var connectionFactory = new SqlConnectionFactory(connectionString);

IImportRepository importRepo = new ImportRepository(connectionFactory);
IWorkRepository workRepo = new WorkRepository(connectionFactory);
IEditionRepository editionRepo = new EditionRepository(connectionFactory);
ILibraryItemRepository itemRepo = new LibraryItemRepository(connectionFactory);
IWorkMetadataRepository metaRepo = new WorkMetadataRepository(connectionFactory);

IEditionLookupRepository editionLookup = new EditionLookupRepository(connectionFactory);
IWorkLookupRepository workLookup = new WorkLookupRepository(connectionFactory);
ILibraryItemLookupRepository itemLookup = new LibraryItemLookupRepository(connectionFactory);

var batchId = new ImportBatchId(batchIdGuid);
var batch = await importRepo.GetBatchAsync(batchId, CancellationToken.None);
if (batch is null)
    throw new InvalidOperationException($"Batch not found: {batchIdGuid}");

var processed = 0;
var failed = 0;

var retryFailedRaw = GetArg(args, "--retry-failed") ?? Environment.GetEnvironmentVariable("IMPORTPROC_RETRY_FAILED");
var resetFailedRaw = GetArg(args, "--reset-failed") ?? Environment.GetEnvironmentVariable("IMPORTPROC_RESET_FAILED");
var retryFailed = string.Equals(retryFailedRaw, "true", StringComparison.OrdinalIgnoreCase) || retryFailedRaw == "1";
var resetFailed = string.Equals(resetFailedRaw, "true", StringComparison.OrdinalIgnoreCase) || resetFailedRaw == "1";

if (resetFailed)
    await importRepo.ResetFailedRecordsAsync(batchId, CancellationToken.None);

while (true)
{
    var records = retryFailed
        ? await importRepo.ListFailedRecordsAsync(batchId, take, CancellationToken.None)
        : await importRepo.ListPendingRecordsAsync(batchId, take, CancellationToken.None);

    if (records.Count == 0)
        break;

    foreach (var rec in records)
    {
        try
        {
            using var doc = JsonDocument.Parse(rec.PayloadJson);
            var root = doc.RootElement;

            var title = GetString(root, "title")
                ?? GetString(root, "title_main")
                ?? GetString(root, "name")
                ?? "(untitled)";

            var subtitle = GetString(root, "subtitle");
            var publisher = GetString(root, "publisher");
            var publishedYear = GetInt(root, "publicationyear") ?? GetInt(root, "publishedYear") ?? GetInt(root, "date");

            var barcode = GetString(root, "barcode") ?? GetString(root, "inventory_id");

            // Identify edition by identifiers if possible.
            var identifiers = ExtractIdentifiers(root)
                .Where(i => !string.IsNullOrWhiteSpace(i.Value))
                .Select(i => (i.IdentifierTypeId, Value: i.Value.Trim()))
                .Distinct()
                .ToList();

            EditionId? editionId = null;
            WorkId? workId = null;

            foreach (var (typeId, value) in identifiers)
            {
                var normalized = NormalizeIdentifierValue(value);
                var found = await editionLookup.FindEditionByIdentifierAsync(new IdentifierTypeId(typeId), normalized, CancellationToken.None);
                if (found is not null)
                {
                    editionId = found;
                    break;
                }
            }

            // If we found an edition, derive work from Editions table.
            if (editionId is not null)
            {
                var existingEdition = await editionRepo.GetByIdAsync(editionId.Value, CancellationToken.None);
                workId = existingEdition?.WorkId;
            }

            // If no identifier-derived work, try normalized title + first author (unless strictIdentifiers)
            if (workId is null && !strictIdentifiers)
            {
                var firstAuthor = ExtractContributors(root)
                    .FirstOrDefault(c => (c.RoleId ?? 1) == 1).DisplayName;

                workId = await workLookup.FindWorkByNormalizedTitleAndFirstAuthorAsync(
                    NormalizeTitle(title),
                    string.IsNullOrWhiteSpace(firstAuthor) ? null : firstAuthor,
                    CancellationToken.None);
            }

            if (workId is null)
            {
                var work = new Work
                {
                    Title = title,
                    Subtitle = subtitle,
                    NormalizedTitle = NormalizeTitle(title)
                };

                await workRepo.CreateAsync(work, CancellationToken.None);
                workId = work.Id;
            }

            // Ensure edition exists if we have edition-ish data and none found.
            var hasEditionData = identifiers.Count > 0 || !string.IsNullOrWhiteSpace(publisher) || publishedYear is not null;
            if (editionId is null && hasEditionData)
            {
                var edition = new Edition
                {
                    WorkId = workId.Value,
                    Publisher = publisher,
                    PublishedYear = publishedYear
                };

                await editionRepo.CreateAsync(edition, CancellationToken.None);
                editionId = edition.Id;

                var first = true;
                foreach (var (typeId, value) in identifiers)
                {
                    await metaRepo.AddEditionIdentifierAsync(edition.Id, new IdentifierTypeId(typeId), value, isPrimary: first, CancellationToken.None);
                    first = false;
                }
            }

            // Ensure item exists for this household (barcode first, else by work)
            ItemId? itemId = null;
            if (!string.IsNullOrWhiteSpace(barcode))
                itemId = await itemLookup.FindItemByHouseholdAndBarcodeAsync(batch.OwnerHouseholdId, barcode.Trim(), CancellationToken.None);

            itemId ??= await itemLookup.FindItemByHouseholdAndWorkAsync(batch.OwnerHouseholdId, workId.Value, CancellationToken.None);

            if (itemId is null)
            {
                var item = new LibraryItem
                {
                    OwnerHouseholdId = batch.OwnerHouseholdId,
                    Kind = ItemKind.Book,
                    WorkId = workId.Value,
                    EditionId = editionId,
                    Title = title,
                    Subtitle = subtitle,
                    Notes = GetString(root, "comments") ?? GetString(root, "summary"),
                    Barcode = barcode
                };

                await itemRepo.CreateAsync(item, CancellationToken.None);
                itemId = item.Id;
            }

            // Attach metadata (best-effort; may partially fail by duplicates)
            var ordinal = 1;
            var seenContrib = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var (name, roleId) in ExtractContributors(root))
            {
                var trimmed = name.Trim();
                if (trimmed.Length == 0) continue;
                if (!seenContrib.Add($"{roleId}:{trimmed}")) continue;

                var person = new Person { DisplayName = trimmed };
                await metaRepo.AddContributorAsync(workId.Value, person, new ContributorRoleId(roleId ?? 1), ordinal++, CancellationToken.None);
            }

            foreach (var tag in ExtractTags(root)
                         .Select(t2 => t2.Trim())
                         .Where(t2 => t2.Length > 0)
                         .Distinct(StringComparer.OrdinalIgnoreCase))
            {
                await metaRepo.AddTagAsync(workId.Value, batch.OwnerHouseholdId, tag, CancellationToken.None);
            }

            foreach (var subj in ExtractSubjects(root)
                         .Select(s2 => s2.Trim())
                         .Where(s2 => s2.Length > 0)
                         .Distinct(StringComparer.OrdinalIgnoreCase))
            {
                await metaRepo.AddSubjectAsync(workId.Value, new SubjectSchemeId(subjectSchemeId), subj, CancellationToken.None);
            }

            await importRepo.MarkRecordCompletedAsync(rec.Id, workId.Value.Value, editionId?.Value, itemId.Value.Value, DateTimeOffset.UtcNow, CancellationToken.None);
            processed++;
        }
        catch (Exception ex)
        {
            await importRepo.MarkRecordFailedAsync(rec.Id, ex.ToString(), DateTimeOffset.UtcNow, CancellationToken.None);
            failed++;
        }
    }
}

var finalStatus = failed == 0 ? ImportStatus.Completed : ImportStatus.Failed;
await importRepo.CompleteBatchAsync(batchId, finalStatus, DateTimeOffset.UtcNow, CancellationToken.None);

Console.WriteLine($"Batch {batchIdGuid} processed. Completed={processed}, Failed={failed}");
