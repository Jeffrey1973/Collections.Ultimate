using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface IWorkMetadataRepository
{
    Task AddContributorAsync(WorkId workId, Person person, ContributorRoleId roleId, int ordinal, CancellationToken ct);
    Task AddTagAsync(WorkId workId, HouseholdId householdId, string tagName, CancellationToken ct);
    Task AddSubjectAsync(WorkId workId, SubjectSchemeId schemeId, string text, CancellationToken ct);
    Task AddEditionIdentifierAsync(EditionId editionId, IdentifierTypeId typeId, string value, bool isPrimary, CancellationToken ct);
    Task AddSeriesAsync(WorkId workId, string seriesName, string? volumeNumber, int? ordinal, CancellationToken ct);
    Task ReplaceContributorsAsync(WorkId workId, IReadOnlyList<(Person Person, ContributorRoleId RoleId, int Ordinal)> contributors, CancellationToken ct);
    Task ReplaceSubjectsAsync(WorkId workId, IReadOnlyList<(SubjectSchemeId SchemeId, string Text)> subjects, CancellationToken ct);
    Task ReplaceIdentifiersAsync(EditionId editionId, IReadOnlyList<(IdentifierTypeId TypeId, string Value, bool IsPrimary)> identifiers, CancellationToken ct);
    Task ReplaceSeriesAsync(WorkId workId, string? seriesName, string? volumeNumber, int? ordinal, CancellationToken ct);
}
