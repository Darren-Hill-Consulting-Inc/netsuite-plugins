using Acme.FulfillmentSync.Services;

namespace Acme.FulfillmentSync;

public sealed class Worker(NetSuiteClient netSuite, WarehouseClient wms, ILogger<Worker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var since = DateTime.UtcNow.AddHours(-1);
        while (!stoppingToken.IsCancellationRequested)
        {
            var fulfillments = await netSuite.FulfillmentsSinceAsync(since);
            foreach (var f in fulfillments)
            {
                var tracking = await wms.SubmitAsync(f, stoppingToken);
                if (tracking is not null) await netSuite.MarkShippedAsync(f.internalId, tracking);
            }
            since = DateTime.UtcNow;
            log.LogInformation("Processed {Count} fulfillments", fulfillments.Count);
            await Task.Delay(TimeSpan.FromMinutes(15), stoppingToken);
        }
    }
}
