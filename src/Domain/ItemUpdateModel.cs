namespace CollectionsUltimate.Domain;

public sealed record ItemInventoryPatch(
    PatchField<string> Barcode,
    PatchField<string> Location,
    PatchField<string> Status,
    PatchField<string> Condition,
    PatchField<DateOnly?> AcquiredOn,
    PatchField<decimal?> Price,
    PatchField<string> Notes);
