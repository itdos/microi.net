using System;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.net
{
    public class HDFSFactory : IHDFSFactory
    {
        private readonly IServiceProvider _serviceProvider;

        public HDFSFactory(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        public IMicroiHDFS Create(HDFSType dbType)
        {
            return dbType switch
            {
                HDFSType.MinIO => _serviceProvider.GetRequiredService<MicroiHDFSMinIO>(),
                HDFSType.Aliyun => _serviceProvider.GetRequiredService<MicroiHDFSAliyun>(),
                HDFSType.AmazonS3 => _serviceProvider.GetRequiredService<MicroiHDFSAmazonS3>(),
                //此模式下仅用于调用【public class MicroiHDFS 】下的3个方法
                HDFSType.Default => _serviceProvider.GetRequiredService<MicroiHDFSMinIO>(),
                _ => throw new ArgumentException($"不支持的存储类型: {dbType}")
            };
        }
    }
    public static class MicroiHDFSExtensions
    {
        public static IServiceCollection AddMicroiHDFS(this IServiceCollection services)
        {
            try
            {
                services.AddSingleton<MicroiHDFSMinIO>();
                services.AddSingleton<MicroiHDFSAliyun>();
                services.AddSingleton<MicroiHDFSAmazonS3>();

                // 注册工厂
                services.AddSingleton<IHDFSFactory, HDFSFactory>();

                Console.WriteLine("Microi：【成功】注入【分布式存储】插件成功！");
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】注入【分布式存储】插件失败：" + ex.Message);
                return services;
            }
        }
    }
}

