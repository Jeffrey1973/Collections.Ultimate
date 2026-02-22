using CollectionsUltimate.Application.Abstractions;
using CollectionsUltimate.Domain;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CollectionsUltimate.Infrastructure.Search;

/// <summary>
/// On startup, ensures the Meilisearch index exists and bulk-syncs all library items.
/// </summary>
public sealed class MeilisearchSyncHostedService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<MeilisearchSyncHostedService> _logger;

    public MeilisearchSyncHostedService(
        IServiceProvider services,
        ILogger<MeilisearchSyncHostedService> logger)
    {
        _services = services;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Small delay so the app can start accepting requests while we sync
        await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);

        try
        {
            var meili = _services.GetRequiredService<MeilisearchService>();
            var healthy = await meili.IsHealthyAsync(stoppingToken);
            if (!healthy)
            {
                _logger.LogWarning("Meilisearch is not reachable. Search will fall back to SQL.");
                return;
            }

            _logger.LogInformation("Meilisearch is healthy. Configuring index...");
            await meili.EnsureIndexAsync(stoppingToken);

            // Bulk-sync all households
            using var scope = _services.CreateScope();
            var householdRepo = scope.ServiceProvider.GetRequiredService<IHouseholdRepository>();
            var searchRepo = scope.ServiceProvider.GetRequiredService<IItemSearchRepository>();

            var households = await householdRepo.ListAsync(stoppingToken);
            foreach (var h in households)
            {
                _logger.LogInformation("Syncing household {HouseholdId} to Meilisearch...", h.Id.Value);
                // Fetch all items for this household using existing SQL search (no query = all items)
                var result = await searchRepo.SearchAsync(
                    h.Id,
                    null, null, null, null, null, null,
                    null, null,
                    10000, 0,
                    stoppingToken);

                await meili.BulkIndexAsync(h.Id.Value, result.Items, stoppingToken);
                _logger.LogInformation("Indexed {Count} items for household {HouseholdId}", result.Items.Count, h.Id.Value);
            }

            _logger.LogInformation("Meilisearch sync complete.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Meilisearch sync failed. Search will fall back to SQL.");
        }
    }
}
