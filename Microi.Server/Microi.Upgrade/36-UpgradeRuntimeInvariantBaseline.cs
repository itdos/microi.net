using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>
    /// 将历史上为了修复“版本号已推进、运行时结构却缺失”而在每次启动重复执行的
    /// 子租户不变量收口为一次性版本基线。完成后由 TenantUpgradeCoordinator 的
    /// ServerVersion 快路径直接跳过整条升级链；后续新增核心迁移必须使用更高版本，
    /// 业务应用表、字段、菜单和微服务仍应通过应用商城交付。
    /// </summary>
    public sealed class Upgrade36
    {
        public const string Version = "7.6.14.0";

        public static readonly string[] OneTimeInvariantNames =
        {
            "Upgrade23-SaaS运行时结构",
            "Upgrade26-访问密钥菜单",
            "Upgrade28-用户首页与商城事件",
            "Upgrade29-OCR租户配置",
            "Upgrade30-后端运行配置",
            "Upgrade31-翻译引擎配置",
            "Upgrade33-表单V8限额",
            "Upgrade34-数据源迁移接口引擎",
            "Upgrade35-文件上传负向开关"
        };

        public async Task<List<string>> Run(string osClient)
        {
            var steps = new List<KeyValuePair<string, Func<Task<List<string>>>>>
            {
                new KeyValuePair<string, Func<Task<List<string>>>>(
                    OneTimeInvariantNames[0], () => new Upgrade23().Run(osClient)),
                new KeyValuePair<string, Func<Task<List<string>>>>(
                    OneTimeInvariantNames[1], () => new Upgrade26().Run(osClient)),
                new KeyValuePair<string, Func<Task<List<string>>>>(
                    OneTimeInvariantNames[2], () => new Upgrade28().Run(osClient)),
                new KeyValuePair<string, Func<Task<List<string>>>>(
                    OneTimeInvariantNames[3], () => new Upgrade29().Run(osClient)),
                new KeyValuePair<string, Func<Task<List<string>>>>(
                    OneTimeInvariantNames[4], () => new Upgrade30().Run(osClient)),
                new KeyValuePair<string, Func<Task<List<string>>>>(
                    OneTimeInvariantNames[5], () => new Upgrade31().Run(osClient)),
                new KeyValuePair<string, Func<Task<List<string>>>>(
                    OneTimeInvariantNames[6], () => new Upgrade33().Run(osClient, false)),
                new KeyValuePair<string, Func<Task<List<string>>>>(
                    OneTimeInvariantNames[7], () => new Upgrade34().Run(osClient)),
                new KeyValuePair<string, Func<Task<List<string>>>>(
                    OneTimeInvariantNames[8], () => new Upgrade35().Run(osClient))
            };

            foreach (var step in steps)
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                Console.WriteLine(
                    $"Microi：【自动升级状态】【{osClient}】【Upgrade36基线：{step.Key}】开始。");
                var stepMessages = await step.Value().ConfigureAwait(false);
                UpgradeExecutionLeaseContext.ThrowIfLost();
                if (stepMessages?.Count > 0)
                {
                    var failures = new List<string>();
                    foreach (var message in stepMessages)
                    {
                        failures.Add(step.Key + "：" + message);
                    }
                    return failures;
                }
                Console.WriteLine(
                    $"Microi：【自动升级状态】【{osClient}】【Upgrade36基线：{step.Key}】成功。");
            }

            return new List<string>();
        }
    }
}
