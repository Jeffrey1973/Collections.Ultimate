using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using Meilisearch;

namespace CollectionsUltimate.Infrastructure.Search;

public sealed class MeilisearchService : IMeilisearchService
{
    private const string IndexName = "library_items";
    private readonly MeilisearchClient _client;

    public MeilisearchService(MeilisearchClient client)
    {
        _client = client;
    }

    public async Task EnsureIndexAsync(CancellationToken ct)
    {
        // Create index if it doesn't exist (idempotent)
        var task = await _client.CreateIndexAsync(IndexName, "id");
        await _client.WaitForTaskAsync(task.TaskUid, cancellationToken: ct);

        var index = _client.Index(IndexName);

        // Configure searchable attributes — order matters for ranking
        await index.UpdateSearchableAttributesAsync([
            "title",
            "workTitle",
            "authors",
            "subtitle",
            "seriesName",
            "publisher",
            "tags",
            "subjects",
            "notes",
            "barcode",
            "identifiers",
            "workDescription",
            "originalTitle",
            "location",
            "status",
            "condition",
            "readStatus",
            "format",
            "binding",
            "editionStatement",
            "placeOfPublication",
            "workLanguage",
            "editionLanguage",
            "workMetadata",
            "editionMetadata",
            "itemMetadata"
        ]);

        // Configure filterable attributes for household scoping
        await index.UpdateFilterableAttributesAsync(["householdId"]);

        // Configure sortable attributes
        await index.UpdateSortableAttributesAsync(["title"]);

        // Set typo tolerance — this is the core value-add
        await index.UpdateTypoToleranceAsync(new TypoTolerance
        {
            Enabled = true,
            MinWordSizeForTypos = new TypoTolerance.TypoSize
            {
                OneTypo = 4,    // Allow 1 typo for words >= 4 chars
                TwoTypos = 8   // Allow 2 typos for words >= 8 chars
            }
        });
    }

    public async Task IndexItemAsync(Guid householdId, ItemSearchResult item, CancellationToken ct)
    {
        var doc = ToDocument(householdId, item);
        var index = _client.Index(IndexName);
        await index.AddDocumentsAsync([doc], cancellationToken: ct);
    }

    public async Task RemoveItemAsync(Guid itemId, CancellationToken ct)
    {
        var index = _client.Index(IndexName);
        await index.DeleteOneDocumentAsync(itemId.ToString(), ct);
    }

    public async Task BulkIndexAsync(Guid householdId, IReadOnlyList<ItemSearchResult> items, CancellationToken ct)
    {
        if (items.Count == 0)
            return;

        var docs = items.Select(i => ToDocument(householdId, i)).ToList();
        var index = _client.Index(IndexName);

        // Index in batches of 500
        const int batchSize = 500;
        for (int i = 0; i < docs.Count; i += batchSize)
        {
            var batch = docs.Skip(i).Take(batchSize).ToList();
            await index.AddDocumentsAsync(batch, cancellationToken: ct);
        }
    }

    public async Task<MeilisearchSearchResult> SearchAsync(
        Guid householdId,
        string query,
        int take,
        int skip,
        CancellationToken ct)
    {
        var index = _client.Index(IndexName);
        var result = await index.SearchAsync<SearchDocument>(query, new SearchQuery
        {
            Filter = $"householdId = \"{householdId}\"",
            Limit = take,
            Offset = skip,
            Sort = ["title:asc"]
        }, ct);

        var ids = result.Hits
            .Select(h => Guid.Parse(h.ItemId))
            .ToList();

        // ISearchable<T> returned; cast to SearchResult<T> for EstimatedTotalHits
        var estimatedTotal = result is SearchResult<SearchDocument> sr
            ? sr.EstimatedTotalHits
            : ids.Count;

        return new MeilisearchSearchResult(estimatedTotal, ids);
    }

    public async Task<bool> IsHealthyAsync(CancellationToken ct)
    {
        try
        {
            return await _client.IsHealthyAsync(ct);
        }
        catch
        {
            return false;
        }
    }

    private static SearchDocument ToDocument(Guid householdId, ItemSearchResult r) => new()
    {
        Id = r.ItemId.ToString(),
        ItemId = r.ItemId.ToString(),
        HouseholdId = householdId.ToString(),
        Title = r.Title,
        Subtitle = r.Subtitle,
        WorkTitle = r.WorkTitle,
        Authors = r.Authors,
        Publisher = r.Publisher,
        PublishedYear = r.PublishedYear,
        Barcode = r.Barcode,
        Location = r.Location,
        Status = r.Status,
        Condition = r.Condition,
        ReadStatus = r.ReadStatus,
        Notes = r.Notes,
        WorkDescription = r.WorkDescription,
        OriginalTitle = r.OriginalTitle,
        WorkLanguage = r.WorkLanguage,
        Format = r.Format,
        Binding = r.Binding,
        EditionStatement = r.EditionStatement,
        PlaceOfPublication = r.PlaceOfPublication,
        EditionLanguage = r.EditionLanguage,
        Tags = r.Tags is not null ? string.Join(", ", r.Tags) : null,
        Subjects = r.Subjects is not null ? string.Join(", ", r.Subjects) : null,
        Identifiers = r.Identifiers,
        SeriesName = r.SeriesName,
        WorkMetadata = r.WorkMetadataJson,
        EditionMetadata = r.EditionMetadataJson,
        ItemMetadata = r.ItemMetadataJson
    };
}
