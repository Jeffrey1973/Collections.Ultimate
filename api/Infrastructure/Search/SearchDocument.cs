using System.Text.Json.Serialization;

namespace CollectionsUltimate.Infrastructure.Search;

/// <summary>
/// Flat document indexed into Meilisearch. All text fields are searchable with typo tolerance.
/// </summary>
public sealed class SearchDocument
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("itemId")]
    public required string ItemId { get; init; }

    [JsonPropertyName("householdId")]
    public required string HouseholdId { get; init; }

    [JsonPropertyName("title")]
    public string? Title { get; init; }

    [JsonPropertyName("subtitle")]
    public string? Subtitle { get; init; }

    [JsonPropertyName("workTitle")]
    public string? WorkTitle { get; init; }

    [JsonPropertyName("authors")]
    public string? Authors { get; init; }

    [JsonPropertyName("publisher")]
    public string? Publisher { get; init; }

    [JsonPropertyName("publishedYear")]
    public int? PublishedYear { get; init; }

    [JsonPropertyName("barcode")]
    public string? Barcode { get; init; }

    [JsonPropertyName("location")]
    public string? Location { get; init; }

    [JsonPropertyName("status")]
    public string? Status { get; init; }

    [JsonPropertyName("condition")]
    public string? Condition { get; init; }

    [JsonPropertyName("readStatus")]
    public string? ReadStatus { get; init; }

    [JsonPropertyName("notes")]
    public string? Notes { get; init; }

    [JsonPropertyName("workDescription")]
    public string? WorkDescription { get; init; }

    [JsonPropertyName("originalTitle")]
    public string? OriginalTitle { get; init; }

    [JsonPropertyName("workLanguage")]
    public string? WorkLanguage { get; init; }

    [JsonPropertyName("format")]
    public string? Format { get; init; }

    [JsonPropertyName("binding")]
    public string? Binding { get; init; }

    [JsonPropertyName("editionStatement")]
    public string? EditionStatement { get; init; }

    [JsonPropertyName("placeOfPublication")]
    public string? PlaceOfPublication { get; init; }

    [JsonPropertyName("editionLanguage")]
    public string? EditionLanguage { get; init; }

    [JsonPropertyName("tags")]
    public string? Tags { get; init; }

    [JsonPropertyName("subjects")]
    public string? Subjects { get; init; }

    [JsonPropertyName("identifiers")]
    public string? Identifiers { get; init; }

    [JsonPropertyName("seriesName")]
    public string? SeriesName { get; init; }

    [JsonPropertyName("workMetadata")]
    public string? WorkMetadata { get; init; }

    [JsonPropertyName("editionMetadata")]
    public string? EditionMetadata { get; init; }

    [JsonPropertyName("itemMetadata")]
    public string? ItemMetadata { get; init; }
}
