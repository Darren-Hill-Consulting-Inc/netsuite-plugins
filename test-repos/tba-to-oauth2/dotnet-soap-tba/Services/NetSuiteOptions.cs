namespace Acme.FulfillmentSync.Services;

public sealed class NetSuiteOptions
{
    public string AccountId { get; set; } = "";
    public string ConsumerKey { get; set; } = "";
    public string ConsumerSecret { get; set; } = "";
    public string TokenId { get; set; } = "";
    public string TokenSecret { get; set; } = "";
    public string Endpoint { get; set; } = "";
}
