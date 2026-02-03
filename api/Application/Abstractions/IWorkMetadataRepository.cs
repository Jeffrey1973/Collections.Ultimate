using CollectionsUltimate.Domain;

namespace CollectionsUltimate.Application.Abstractions;

public interface IWorkMetadataRepository
{
    Task AddContributorAsync(WorkId workId, Person person, ContributorRoleId roleId, int ordinal, CancellationToken ct);
    Task AddTagAsync(WorkId workId, HouseholdId householdId, string tagName, CancellationToken ct);
    Task AddSubjectAsync(WorkId workId, SubjectSchemeId schemeId, string text, CancellationToken ct);
    Task AddEditionIdentifierAsync(EditionId editionId, IdentifierTypeId typeId, string value, bool isPrimary, CancellationToken ct);
}
