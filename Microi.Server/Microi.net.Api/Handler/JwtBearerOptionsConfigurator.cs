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
            ValidIssuer = "microi",
            ValidateLifetime = true,
            ValidateAudience = true,
            ValidateIssuer = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        };
        options.SaveToken = true;
        options.Audience = "microi";
        
        // SignalR 专用：从 query string 或 headers 中获取 token
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var path = context.HttpContext.Request.Path;
                
                // 优先从 query string 获取 token（SignalR标准方式）
                var accessToken = context.Request.Query["access_token"].ToString();
                
                if (!string.IsNullOrEmpty(accessToken))
                {
                    // Console.WriteLine($"[JWT] 从 Query String 获取到 Token (Path: {path})");
                    context.Token = accessToken;
                }
                // 如果 query 中没有，尝试从 headers 获取（普通HTTP请求）
                else
                {
                    var authHeader = context.Request.Headers["Authorization"].FirstOrDefault()
                        ?? context.Request.Headers["authorization"].FirstOrDefault();
                    
                    if (!string.IsNullOrEmpty(authHeader))
                    {
                        if (authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                        {
                            context.Token = authHeader.Substring("Bearer ".Length).Trim();
                            // Console.WriteLine($"[JWT] 从 Authorization Header 获取到 Token (Path: {path})");
                        }
                        else
                        {
                            context.Token = authHeader.Trim();
                            // Console.WriteLine($"[JWT] 从 Header 获取到 Token (无Bearer前缀) (Path: {path})");
                        }
                    }
                    else
                    {
                        // Console.WriteLine($"[JWT] 未找到 Token (Path: {path}, Query: {context.Request.QueryString})");
                    }
                }
                
                return Task.CompletedTask;
            },
            OnAuthenticationFailed = context =>
            {
                // Console.WriteLine($"[JWT] 验证失败: {context.Exception.GetType().Name} - {context.Exception.Message}");
                if (context.Exception.InnerException != null)
                {
                    // Console.WriteLine($"[JWT] 内部异常: {context.Exception.InnerException.Message}");
                }
                return Task.CompletedTask;
            },
            OnTokenValidated = context =>
            {
                var userId = context.Principal?.Claims.FirstOrDefault(c => c.Type == "UserId")?.Value;
                var osClient = context.Principal?.Claims.FirstOrDefault(c => c.Type == "OsClient")?.Value;
                // Console.WriteLine($"[JWT] 验证成功 - UserId: {userId}, OsClient: {osClient}, Path: {context.HttpContext.Request.Path}");
                return Task.CompletedTask;
            }
        };
    }
}
