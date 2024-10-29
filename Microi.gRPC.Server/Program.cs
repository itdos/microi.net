using Microi.net;
using Microi.net.Grpc.Server.Services;
using Microsoft.AspNetCore.Server.Kestrel.Core;

var builder = WebApplication.CreateBuilder(args);

//------- Fix：HTTP/2 over TLS is not supported on macOS due to missing ALPN support.
builder.WebHost.UseKestrel((host, options) => {
    options.Limits.MaxRequestBodySize = long.MaxValue;
    options.ListenLocalhost(50001, a => a.Protocols = HttpProtocols.Http2);
});
//------- END

#region ------- Microi.net -------

var services = builder.Services;

//-------Microi.net初始化
services.AddDiy();

#endregion

// Additional configuration is required to successfully run gRPC on macOS.
// For instructions on how to configure Kestrel and gRPC clients on macOS, visit https://go.microsoft.com/fwlink/?linkid=2099682

// Add services to the container.
builder.Services.AddGrpc();

var app = builder.Build();

// Configure the HTTP request pipeline.
app.MapGrpcService<GreeterService>();
app.MapGrpcService<SysUserProtoService>();

app.MapGet("/", () => "Communication with gRPC endpoints must be made through a gRPC client. To learn how to create a client, visit: https://go.microsoft.com/fwlink/?linkid=2086909");

#region ------- Microi.net -------

//-------Microi.net初始化
app.UseDiy();

#endregion

app.Run();

