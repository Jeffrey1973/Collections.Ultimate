namespace CollectionsUltimate.Domain;

public readonly record struct PatchField<T>(bool IsSpecified, T? Value)
{
    public static PatchField<T> Unspecified => new(false, default);
    public static PatchField<T> From(T? value) => new(true, value);
}
