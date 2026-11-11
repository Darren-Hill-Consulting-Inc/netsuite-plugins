using System.Net.Http.Json;
using Acme.FulfillmentSync.NetSuiteService;

namespace Acme.FulfillmentSync.Services;

public sealed class WarehouseClient(HttpClient http, IConfiguration config)
{
    public async Task<string?> SubmitAsync(ItemFulfillment f, CancellationToken ct)
    {
        var url = $"{config["Warehouse:BaseUrl"]}/shipments";
        var resp = await http.PostAsJsonAsync(url, new { reference = f.tranId, lines = f.itemList?.item?.Length ?? 0 }, ct);
        if (!resp.IsSuccessStatusCode) return null;
        var body = await resp.Content.ReadFromJsonAsync<Dictionary<string, string>>(cancellationToken: ct);
        return body?["tracking"];
    }
}
