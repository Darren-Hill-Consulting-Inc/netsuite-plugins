using Acme.FulfillmentSync;
using Acme.FulfillmentSync.Services;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.Configure<NetSuiteOptions>(builder.Configuration.GetSection("NetSuite"));
builder.Services.AddSingleton<NetSuiteClient>();
builder.Services.AddHttpClient<WarehouseClient>();
builder.Services.AddHostedService<Worker>();
builder.Build().Run();
