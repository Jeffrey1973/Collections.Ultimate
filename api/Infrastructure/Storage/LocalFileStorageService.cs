using CollectionsUltimate.Application.Abstractions;

namespace CollectionsUltimate.Infrastructure.Storage;

/// <summary>
/// Local file system storage for development. In production, use AzureBlobStorageService.
/// </summary>
public sealed class LocalFileStorageService : IBlobStorageService
{
    private readonly string _basePath;
    private readonly string _baseUrl;

    public LocalFileStorageService(string basePath, string baseUrl)
    {
        _basePath = basePath;
        _baseUrl = baseUrl.TrimEnd('/');

        if (!Directory.Exists(_basePath))
            Directory.CreateDirectory(_basePath);
    }

    public async Task<string> UploadAsync(string path, Stream content, string contentType, CancellationToken ct)
    {
        var fullPath = Path.Combine(_basePath, path.Replace('/', Path.DirectorySeparatorChar));
        var directory = Path.GetDirectoryName(fullPath);

        if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
            Directory.CreateDirectory(directory);

        await using var fileStream = new FileStream(fullPath, FileMode.Create, FileAccess.Write);
        await content.CopyToAsync(fileStream, ct);

        return GetPublicUrl(path);
    }

    public Task<bool> DeleteAsync(string path, CancellationToken ct)
    {
        var fullPath = Path.Combine(_basePath, path.Replace('/', Path.DirectorySeparatorChar));

        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
            return Task.FromResult(true);
        }

        return Task.FromResult(false);
    }

    public string GetPublicUrl(string path)
    {
        return $"{_baseUrl}/{path.Replace('\\', '/')}";
    }
}
