namespace CollectionsUltimate.Application.Abstractions;

public interface IBlobStorageService
{
    Task<string> UploadAsync(string path, Stream content, string contentType, CancellationToken ct);
    Task<bool> DeleteAsync(string path, CancellationToken ct);
    string GetPublicUrl(string path);
}
