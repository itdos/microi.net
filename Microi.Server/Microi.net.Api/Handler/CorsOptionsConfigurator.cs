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

            Console.WriteLine($"Microi：【成功】动态跨域配置成功，允许的来源: {GetCorsPolicyDescription(clientModel.OsClientModel["CorsAllowOrigins"].Val<string>())}");
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
            var corsAllowOrigins = clientModel.OsClientModel["CorsAllowOrigins"].Val<string>() ?? string.Empty;
            var corsAllowOriginsArr = ParseOriginList(corsAllowOrigins)
                .Concat(ParseOriginList(GetConfigAllowOrigins()))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (!corsAllowOriginsArr.Any())
            {
                ApplyEmptyOriginPolicy(builder);
            }
            else
            {
                builder.SetIsOriginAllowed(origin =>
                {
                    if (string.IsNullOrWhiteSpace(origin))
                        return false;

                    return corsAllowOriginsArr.Any(pattern =>
                    {
                        if (IsAllowAnyOriginPattern(pattern))
                        {
                            return true;
                        }

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
        // 默认配置，避免应用无法启动；未显式配置时默认允许跨域，认证安全由登录校验和JWT签名保证。
        options.AddPolicy("any", builder =>
        {
            var corsAllowOriginsArr = ParseOriginList(GetConfigAllowOrigins());

            if (!corsAllowOriginsArr.Any())
            {
                ApplyEmptyOriginPolicy(builder);
                return;
            }

            builder.SetIsOriginAllowed(origin =>
                {
                    if (string.IsNullOrWhiteSpace(origin))
                        return false;

                    return corsAllowOriginsArr.Any(pattern =>
                    {
                        if (IsAllowAnyOriginPattern(pattern))
                        {
                            return true;
                        }

                        var regexPattern = "^" +
                            Regex.Escape(pattern)
                                .Replace("\\*", "[a-zA-Z0-9-]+")
                                .Replace("\\?", "[a-zA-Z0-9]") + "$";

                        return pattern == origin ||
                            Regex.IsMatch(origin, regexPattern, RegexOptions.IgnoreCase);
                    });
                })
                .AllowAnyMethod()
                .AllowAnyHeader()
                .AllowCredentials()
                .WithExposedHeaders("authorization", "osclient", "set-cookie", "did", "apiengine", "token", "lang", "captchaid")
                .SetPreflightMaxAge(TimeSpan.FromHours(24));
        });
    }

    private void ApplyEmptyOriginPolicy(CorsPolicyBuilder builder)
    {
        if (GetAllowAnyWhenUnconfigured())
        {
            builder.SetIsOriginAllowed(_ => true)
                .AllowAnyMethod()
                .AllowAnyHeader()
                .AllowCredentials()
                .WithExposedHeaders("authorization", "osclient", "set-cookie", "did", "apiengine", "token", "lang", "captchaid")
                .SetPreflightMaxAge(TimeSpan.FromHours(24));
            return;
        }

        builder.SetIsOriginAllowed(_ => false)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials()
            .WithExposedHeaders("authorization", "osclient", "set-cookie", "did", "apiengine", "token", "lang", "captchaid")
            .SetPreflightMaxAge(TimeSpan.FromHours(24));
    }

    private string GetConfigAllowOrigins()
    {
        return Environment.GetEnvironmentVariable("MICROI_CORS_ALLOW_ORIGINS")
            ?? _configuration["Cors:AllowOrigins"]
            ?? string.Empty;
    }

    private bool GetAllowAnyWhenUnconfigured()
    {
        var env = Environment.GetEnvironmentVariable("MICROI_CORS_ALLOW_ANY_WHEN_UNCONFIGURED");
        var value = string.IsNullOrWhiteSpace(env)
            ? _configuration["Cors:AllowAnyWhenUnconfigured"]
            : env;

        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        return IsTruthy(value);
    }

    private static bool IsTruthy(string? value)
    {
        return value != null &&
            (value.Equals("true", StringComparison.OrdinalIgnoreCase) ||
             value.Equals("1", StringComparison.OrdinalIgnoreCase) ||
             value.Equals("yes", StringComparison.OrdinalIgnoreCase) ||
             value.Equals("y", StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsAllowAnyOriginPattern(string pattern)
    {
        return pattern == "*" ||
            pattern.Equals("all", StringComparison.OrdinalIgnoreCase) ||
            pattern.Equals("全部", StringComparison.OrdinalIgnoreCase);
    }

    private static List<string> ParseOriginList(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return new List<string>();
        }

        return value
            .Split(new[] { ';', ',', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .ToList();
    }

    private string GetCorsPolicyDescription(string? dbOrigins)
    {
        var origins = ParseOriginList(dbOrigins)
            .Concat(ParseOriginList(GetConfigAllowOrigins()))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (origins.Any())
        {
            return string.Join(";", origins);
        }

        return GetAllowAnyWhenUnconfigured()
            ? "未配置来源，默认允许全部来源"
            : "未配置来源，已通过配置禁止跨域";
    }
}
