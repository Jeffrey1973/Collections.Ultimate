using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using CollectionsUltimate.Application.Abstractions;

namespace CollectionsUltimate.Infrastructure.Storage;

public sealed class AzureBlobStorageService : IBlobStorageService
{
    private readonly BlobContainerClient _container;

    public AzureBlobStorageService(string connectionString, string containerName)
    {
        var serviceClient = new BlobServiceClient(connectionString);
        _container = serviceClient.GetBlobContainerClient(containerName);
    }

    public async Task<string> UploadAsync(string path, Stream content, string contentType, CancellationToken ct)
    {
        var blob = _container.GetBlobClient(path);

        await blob.UploadAsync(content, new BlobHttpHeaders
        {
            ContentType = contentType,
            CacheControl = "public, max-age=31536000" // 1 year cache
        }, cancellationToken: ct);

        return blob.Uri.ToString();
    }

    public async Task<bool> DeleteAsync(string path, CancellationToken ct)
    {
        var blob = _container.GetBlobClient(path);
        var response = await blob.DeleteIfExistsAsync(cancellationToken: ct);
        return response.Value;
    }

    public string GetPublicUrl(string path)
    {
        var blob = _container.GetBlobClient(path);
        return blob.Uri.ToString();
    }
}
