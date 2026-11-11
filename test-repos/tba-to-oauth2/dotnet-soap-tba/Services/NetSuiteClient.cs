using System.Security.Cryptography;
using System.Text;
using Acme.FulfillmentSync.NetSuiteService;
using Microsoft.Extensions.Options;

namespace Acme.FulfillmentSync.Services;

public sealed class NetSuiteClient
{
    private readonly NetSuiteOptions _options;
    private readonly ILogger<NetSuiteClient> _log;

    public NetSuiteClient(IOptions<NetSuiteOptions> options, ILogger<NetSuiteClient> log)
    {
        _options = options.Value;
        _log = log;
    }

    private NetSuitePortTypeClient CreatePort()
    {
        var binding = new System.ServiceModel.BasicHttpsBinding
        {
            MaxReceivedMessageSize = 50 * 1024 * 1024,
            SendTimeout = TimeSpan.FromMinutes(10),
        };
        return new NetSuitePortTypeClient(binding, new System.ServiceModel.EndpointAddress(_options.Endpoint));
    }

    private TokenPassport CreateTokenPassport()
    {
        var nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(10));
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        var baseString = string.Join("&", _options.AccountId, _options.ConsumerKey, _options.TokenId, nonce, timestamp);
        var key = $"{_options.ConsumerSecret}&{_options.TokenSecret}";

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
        var signature = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(baseString)));

        return new TokenPassport
        {
            account = _options.AccountId,
            consumerKey = _options.ConsumerKey,
            token = _options.TokenId,
            nonce = nonce,
            timestamp = long.Parse(timestamp),
            signature = new TokenPassportSignature { algorithm = "HMAC_SHA256", Value = signature },
        };
    }

    public async Task<IReadOnlyList<ItemFulfillment>> FulfillmentsSinceAsync(DateTime since)
    {
        var service = CreatePort();
        var search = new TransactionSearchBasic
        {
            type = new SearchEnumMultiSelectField { @operator = SearchEnumMultiSelectFieldOperator.anyOf, operatorSpecified = true, searchValue = new[] { "_itemFulfillment" } },
            lastModifiedDate = new SearchDateField { @operator = SearchDateFieldOperator.after, operatorSpecified = true, searchValue = since, searchValueSpecified = true },
        };

        var response = await service.searchAsync(null, CreateTokenPassport(), null, null, null, search);
        var result = response.searchResult;
        if (!result.status.isSuccess)
        {
            _log.LogError("NetSuite search failed: {Message}", result.status.statusDetail[0].message);
            return Array.Empty<ItemFulfillment>();
        }
        return result.recordList.OfType<ItemFulfillment>().ToList();
    }

    public async Task MarkShippedAsync(string fulfillmentId, string trackingNumber)
    {
        var service = CreatePort();
        var update = new ItemFulfillment
        {
            internalId = fulfillmentId,
            shipStatus = ItemFulfillmentShipStatus._shipped,
            shipStatusSpecified = true,
            packageList = new ItemFulfillmentPackageList
            {
                package = new[] { new ItemFulfillmentPackage { packageTrackingNumber = trackingNumber } },
            },
        };
        await service.updateAsync(null, CreateTokenPassport(), null, null, null, update);
    }
}
