using System;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.Extensions.Options;
using Microi.net;
using Dos.Common;
using System.Text.RegularExpressions;

namespace Microi.net.Api;

public class CorsOptionsConfigurator : IConfigureNamedOptions<CorsOptions>
{
    private readonly IConfiguration _configuration;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<CorsOptionsConfigurator> _logger;

    public CorsOptionsConfigurator(
        IConfiguration configuration,
        IServiceProvider serviceProvider,
        ILogger<CorsOptionsConfigurator> logger)
    {
        _configuration = configuration;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public void Configure(string? name, CorsOptions options)
    {
        // 为特定策略名配置，或者为所有策略配置
        if (string.IsNullOrEmpty(name) || name == "any")
        {
            Configure(options);
        }
    }

    public void Configure(CorsOptions options)
    {
        try
        {
            var osClientName = OsClient.GetConfigOsClient();
            var clientModel = GetClientModel(osClientName);
            
            if (clientModel == null)
            {
                throw new InvalidOperationException($"未找到客户端配置: {osClientName}");
            }
            
            ConfigureCorsPolicy(options, clientModel);
            
            Console.WriteLine("Microi：【成功】动态跨域配置成功，允许的来源: {Origins}", 
                clientModel.CorsAllowOrigins ?? "全部");
        }
        catch (Exception ex)
        {
            Console.WriteLine("Microi：【警告】动态跨域配置失败，使用默认配置！" + ex.Message);
            ConfigureDefaultCorsPolicy(options);
        }
    }

    private OsClientSecret? GetClientModel(string osClientName)
    {
        // 使用你现有的方式获取 clientModel
        using var scope = _serviceProvider.CreateScope();
        // 根据实际情况调整
        return OsClient.GetClient(osClientName);
    }

    private void ConfigureCorsPolicy(CorsOptions options, OsClientSecret clientModel)
    {
        options.AddPolicy("any", builder =>
        {
            var corsAllowOrigins = clientModel.CorsAllowOrigins.DosTrim();
            var corsAllowOriginsArr = new List<string>();
            
            if (!corsAllowOrigins.DosIsNullOrWhiteSpace())
            {
                corsAllowOriginsArr = corsAllowOrigins.Split(';', StringSplitOptions.RemoveEmptyEntries).ToList();
            }

            if (!corsAllowOriginsArr.Any())
            {
                builder.SetIsOriginAllowed(s => true)
                        .AllowAnyMethod()
                        .AllowAnyHeader()
                        .AllowCredentials()
                        .WithExposedHeaders("authorization", "osclient", "set-cookie", "did", "apiengine", "token", "lang", "captchaid")
                        .SetPreflightMaxAge(TimeSpan.FromHours(24));
            }
            else
            {
                builder.SetIsOriginAllowed(origin =>
                {
                    if (string.IsNullOrWhiteSpace(origin)) 
                        return false;

                    return corsAllowOriginsArr.Any(pattern =>
                    {
                        // 处理通配符转正则表达式
                        var regexPattern = "^" +
                            Regex.Escape(pattern)
                                .Replace("\\*", "[a-zA-Z0-9-]+")
                                .Replace("\\?", "[a-zA-Z0-9]") + "$";

                        // 精确匹配或正则匹配
                        return pattern == origin ||
                            Regex.IsMatch(origin, regexPattern, RegexOptions.IgnoreCase);
                    });
                })
                .AllowAnyMethod()
                .AllowAnyHeader()
                .AllowCredentials()
                .WithExposedHeaders("authorization", "osclient", "set-cookie", "did", "apiengine", "token", "lang", "captchaid")
                .SetPreflightMaxAge(TimeSpan.FromHours(24));
            }
        });
    }

    private void ConfigureDefaultCorsPolicy(CorsOptions options)
    {
        // 默认配置，避免应用无法启动
        options.AddPolicy("any", builder =>
        {
            builder.SetIsOriginAllowed(s => true)
                    .AllowAnyMethod()
                    .AllowAnyHeader()
                    .AllowCredentials()
                    .WithExposedHeaders("authorization", "osclient", "set-cookie", "did", "apiengine", "token", "lang", "captchaid")
                    .SetPreflightMaxAge(TimeSpan.FromHours(24));
        });
    }
}
