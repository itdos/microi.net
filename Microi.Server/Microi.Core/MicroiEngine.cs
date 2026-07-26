using System;
using System.Collections.Generic;
using Dos.Common;
using Dos.ORM;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.net
{
    public static class MicroiEngine
    {
        private static IServiceProvider _serviceProvider;

        public static void Init(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
            RuntimeDiagnostics.Configure(item => QueueSystemLog(
                item.OsClient,
                item.Subsystem,
                item.Action,
                item.Title,
                item.Content,
                item.Level,
                item.Success,
                item.TargetId,
                item.OtherInfo));
            ConsoleLogInterceptor.FlushPendingToMongo();
        }
        public static T GetService<T>() where T : class
        {
            if (_serviceProvider == null)
                throw new InvalidOperationException("Microi：【Error异常】ServiceLocator未初始化！");
            return _serviceProvider.GetRequiredService<T>();
        }
        public static T TryGetService<T>() where T : class
        {
            return _serviceProvider?.GetService<T>();
        }
        // public static IMicroiPlugins Plugins => GetService<IMicroiPlugins>();
        public static IApiEngine ApiEngine => GetService<IApiEngine>();
        internal static IBackgroundTaskApiEngineRunner BackgroundTaskApiEngine => GetService<IBackgroundTaskApiEngineRunner>();
        public static IFormEngine FormEngine => GetService<IFormEngine>();
        public static IV8Engine V8Engine => GetService<IV8Engine>();
        public static IDataSourceEngine DataSource => GetService<IDataSourceEngine>();
        public static IModuleEngine ModuleEngine => GetService<IModuleEngine>();
        public static IMicroiHttp Http => GetService<IMicroiHttp>();
        public static IV8Method V8Method => GetService<IV8Method>();
        public static IMicroiCacheTenant CacheTenant => GetService<IMicroiCacheTenant>();
        public static ITranslateEngine Translate => GetService<ITranslateEngine>();
        public static IMicroiSpider Spider => GetService<IMicroiSpider>();
        public static IMicroiOffice Office => GetService<IMicroiOffice>();
        public static IMicroiMQ MQ => GetService<IMicroiMQ>();
        public static IWFEngine WFEngine => GetService<IWFEngine>();
        public static IMicroiJob Job => GetService<IMicroiJob>();
        public static IMongoDB MongoDB => GetService<IMongoDB>();
        public static ISysLogQueue SysLogQueue => TryGetService<ISysLogQueue>();
        public static IPrivateFileAuditLinkService PrivateFileAuditLink => TryGetService<IPrivateFileAuditLinkService>();
        /// <summary>
        /// 将日志交给后台批量队列。极早期启动阶段未注入队列时返回false，由调用方决定降级策略。
        /// </summary>
        public static bool QueueSysLog(SysLogParam param)
        {
            return param != null && SysLogQueue?.Enqueue(param) == true;
        }
        /// <summary>
        /// 将租户级运行诊断写入平台MongoDB日志队列。该旁路永不向调用方抛异常，
        /// 避免日志系统故障反过来影响Job、MQ等业务线程。
        /// </summary>
        public static bool QueueSystemLog(
            string osClient,
            string subsystem,
            string action,
            string title,
            string content,
            int level = 2,
            bool? success = false,
            string targetId = null,
            string otherInfo = null)
        {
            try
            {
                return QueueSysLog(new SysLogParam
                {
                    OsClient = string.IsNullOrWhiteSpace(osClient) ? OsClientDefault.OsClient : osClient,
                    Category = "System",
                    Action = action,
                    Source = subsystem,
                    TargetType = subsystem,
                    TargetId = targetId,
                    Success = success,
                    OccurredAt = DateTime.Now,
                    Type = subsystem,
                    Title = title,
                    Content = content,
                    OtherInfo = otherInfo,
                    Level = level
                });
            }
            catch
            {
                // 日志是旁路能力；队列未初始化或正在停止时不能破坏原业务流程。
                return false;
            }
        }
        public static IMicroiLock Lock => GetService<IMicroiLock>();

        public static IMicroiORM ORM(DatabaseType dbType) => GetService<IDbFactory>().Create(dbType);
        /// <summary>
        /// 此模式下仅用于调用【public class MicroiHDFS 】下的3个方法
        /// </summary>
        public static IMicroiHDFS HDFS => GetService<IHDFSFactory>().Create(HDFSType.Default);
        public static IMicroiHDFS HDFSFactory(HDFSType hdfsType) => GetService<IHDFSFactory>().Create(hdfsType);

    }
    public interface IMicroiCacheTenant
    {
        IMicroiCache Cache(string osClient);
        IMicroiCache Default();
    }
    public interface IDbFactory
    {
        IMicroiORM Create(Dos.ORM.DatabaseType dbType);
    }
    public interface IHDFSFactory
    {
        IMicroiHDFS Create(HDFSType hdfsType);
    }
}
