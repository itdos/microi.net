using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dos.ORM;

namespace Microi.net
{
    /// <summary>
    /// 将接口引擎历史默认内存预算从 1024 MB 提升到 2048 MB。
    ///
    /// Jint 的内存约束统计单次执行中的累计分配字节，而不是实时存活堆。
    /// 这里只迁移仍等于历史默认值的记录；客户显式设置的其它预算保持不变，
    /// 平台的 4096 MB 硬上限也不变。
    /// </summary>
    public class Upgrade19
    {
        public static string Version = "6.5.7.5";

        public async Task<List<string>> Run(string osClient)
        {
            var messages = new List<string>();
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var client = OsClient.GetClient(osClient);
                if (client?.Db == null)
                {
                    messages.Add("租户数据库连接不存在，无法迁移接口引擎内存预算。");
                    return messages;
                }

                const int newDefaultLimitMemoryMb = 2048;
                const int legacyDefaultLimitMemoryMb = 1024;
                var affected = client.Db
                    .FromSql(
                        "UPDATE sys_apiengine SET LimitMemory = @p0 " +
                        "WHERE LimitMemory = @p1")
                    .AddInParameter("@p0", newDefaultLimitMemoryMb)
                    .AddInParameter("@p1", legacyDefaultLimitMemoryMb)
                    .ExecuteNonQuery();

                Console.WriteLine(
                    $"Microi：【提示】平台自动升级【{osClient}】已将 {affected} 个接口引擎的历史默认内存预算从 1024MB 提升到 2048MB。");
                await Task.CompletedTask;
            }
            catch (Exception ex)
            {
                messages.Add("迁移接口引擎内存预算失败：" + ex.Message);
            }

            return messages;
        }
    }
}
