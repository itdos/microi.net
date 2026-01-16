using System;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Dos.Common;

namespace Microi.net.Api;

public class JwtBearerOptionsConfigurator : IConfigureNamedOptions<JwtBearerOptions>
{
    private readonly IConfiguration _configuration;
    private readonly IServiceProvider _serviceProvider;

    public JwtBearerOptionsConfigurator(IConfiguration configuration, IServiceProvider serviceProvider)
    {
        _configuration = configuration;
        _serviceProvider = serviceProvider;
    }

    public void Configure(string? name, JwtBearerOptions options)
    {
        if (name == JwtBearerDefaults.AuthenticationScheme)
        {
            Configure(options);
        }
    }

    public void Configure(JwtBearerOptions options)
    {
        // 这里可以获取数据库配置
        var osClientName = OsClient.GetConfigOsClient();

        // 使用服务定位器获取数据库服务（注意：这里创建了一个作用域）
        using var scope = _serviceProvider.CreateScope();

        // 假设你有获取客户端信息的方法
        // var clientModel = scope.ServiceProvider.GetRequiredService<IOsClientService>().GetClient(osClientName);
        var clientModel = OsClient.GetClient(osClientName);

        var jwtKey = clientModel.OsClientModel["AuthSecret"].Val<string>().DosIsNullOrWhiteSpace()
            ? clientModel.OsClient
            : clientModel.OsClientModel["AuthSecret"].Val<string>();
        jwtKey = jwtKey.Length > 32
            ? jwtKey.Substring(0, 32)
            : jwtKey.PadRight(32, '.');

        options.RequireHttpsMetadata = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidAudience = "microi",
            ValidateLifetime = true,
            ValidateAudience = true,
            ValidateIssuer = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        };
        options.SaveToken = true;
        options.Audience = "microi";
    }
}
