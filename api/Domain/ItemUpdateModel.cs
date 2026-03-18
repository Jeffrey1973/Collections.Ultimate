namespace CollectionsUltimate.Domain;

public sealed record ItemInventoryPatch(
    PatchField<string> Barcode,
    PatchField<Guid?> LocationId,
    PatchField<Guid?> LibraryId,
    PatchField<string> Status,
    PatchField<string> Condition,
    PatchField<DateOnly?> AcquiredOn,
    PatchField<decimal?> Price,
    PatchField<string> Notes,
    PatchField<string> ReadStatus,
    PatchField<string> CompletedDate,
    PatchField<string> DateStarted,
    PatchField<decimal?> UserRating,
    PatchField<int?> LibraryOrder,
    PatchField<string> Title = default,
    PatchField<string> Subtitle = default);
