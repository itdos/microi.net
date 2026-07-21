using System;
using System.Security.Cryptography;
using System.Text;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8EngineMethodExtend
    {
        /// <summary>
        /// 重建并复制 iTdos 主库到固定临时数据库。
        /// </summary>
        public DosResult PrepareEmptyDatabaseRelease(dynamic dynamicParam)
        {
            try
            {
                var request = ParseEmptyDatabaseReleaseRequest(dynamicParam);
                return request.Service.Prepare(request.CurrentUser, request.OsClient);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "准备主库空数据库失败：" + ex.Message);
            }
        }

        /// <summary>
        /// 在固定临时数据库执行线上接口引擎返回的脱敏 SQL。
        /// </summary>
        public DosResult ApplyEmptyDatabaseSanitization(dynamic dynamicParam)
        {
            try
            {
                var request = ParseEmptyDatabaseReleaseRequest(dynamicParam);
                return request.Service.ApplySanitization(
                    request.CurrentUser,
                    request.OsClient,
                    request.Param["SanitizationSql"]?.ToString() ?? "");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "执行空数据库脱敏失败：" + ex.Message);
            }
        }

        /// <summary>
        /// 导出、压缩并发布已脱敏的固定临时数据库。
        /// </summary>
        public DosResult PublishEmptyDatabaseRelease(dynamic dynamicParam)
        {
            try
            {
                var request = ParseEmptyDatabaseReleaseRequest(dynamicParam);
                return request.Service.Publish(request.CurrentUser, request.OsClient);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "发布主库空数据库失败：" + ex.Message);
            }
        }

        /// <summary>
        /// 清理固定临时数据库，供接口引擎异常补偿调用。
        /// </summary>
        public DosResult CleanupEmptyDatabaseRelease(dynamic dynamicParam)
        {
            try
            {
                var request = ParseEmptyDatabaseReleaseRequest(dynamicParam);
                return request.Service.Cleanup(request.CurrentUser, request.OsClient);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "清理主库空数据库失败：" + ex.Message);
            }
        }

        /// <summary>
        /// 执行全部 SaaS 数据库在线备份。实际并发、租约、节流、HDFS 私有上传由 C# 服务强制控制。
        /// </summary>
        public DosResult RunDatabaseBackup(dynamic dynamicParam)
        {
            try
            {
                var param = JsonHelper.ToJObject(dynamicParam) ?? new JObject();
                var currentUser = param["CurrentUser"] as JObject
                                  ?? param["_CurrentUser"] as JObject
                                  ?? new JObject();
                var osClient = param["OsClient"]?.ToString() ?? "";
                var backgroundTaskId = param["_BackgroundTaskId"]?.ToString()
                                           ?? param["BackgroundTaskId"]?.ToString()
                                           ?? "";
                var retainCountText = param["RetainCount"]?.ToString();
                int retainCount;
                int.TryParse(retainCountText, out retainCount);
                return new DatabaseBackupService(backgroundTaskId).Run(
                    currentUser,
                    osClient,
                    param["TriggerType"]?.ToString() ?? "Manual",
                    retainCount);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "执行数据库备份失败：" + ex.Message);
            }
        }

        /// <summary>
        /// 仅接受固定任务 Id，将计划任务转换为后台任务，使管理员可在通知中心看到日志、进度和结果。
        /// </summary>
        public DosResult QueueScheduledDatabaseBackup(dynamic dynamicParam)
        {
            try
            {
                var param = JsonHelper.ToJObject(dynamicParam) ?? new JObject();
                var osClient = param["OsClient"]?.ToString() ?? "";
                var jobId = param["Id"]?.ToString() ?? param["JobId"]?.ToString() ?? "";
                if (!string.Equals(osClient, DatabaseBackupService.RequiredOsClient, StringComparison.OrdinalIgnoreCase)
                    || !string.Equals(jobId, DatabaseBackupService.ScheduledJobId, StringComparison.Ordinal))
                {
                    return new DosResult(0, null, "仅固定的 iTdos 数据库备份任务可投递后台任务。");
                }

                var client = OsClientExtend.GetClient(DatabaseBackupService.RequiredOsClient);
                if (client?.DbRead == null)
                {
                    return new DosResult(0, null, "iTdos 主租户读取连接不可用。");
                }
                var admin = client.DbRead.FromSql(@"SELECT `Id`,`Account`,`Name`,`Level`
FROM `Sys_User` WHERE (`IsDeleted`=0 OR `IsDeleted` IS NULL) AND `Level`>=9999
ORDER BY `Level` DESC,`CreateTime` ASC LIMIT 1").ToFirst<dynamic>();
                if (admin == null)
                {
                    return new DosResult(0, null, "未找到可接收定时备份通知的超级管理员。");
                }
                var trustedUser = JObject.FromObject(admin);
                var userId = trustedUser["Id"]?.ToString() ?? "";
                if (string.IsNullOrWhiteSpace(userId))
                {
                    return new DosResult(0, null, "定时备份通知管理员 Id 为空。");
                }

                var retainCount = 7;
                var jobParamText = param["JobParam"]?.ToString();
                if (!string.IsNullOrWhiteSpace(jobParamText))
                {
                    try
                    {
                        var settings = JObject.Parse(jobParamText);
                        int.TryParse(settings["RetainCount"]?.ToString(), out retainCount);
                    }
                    catch { }
                }
                retainCount = Math.Max(1, Math.Min(100, retainCount <= 0 ? 7 : retainCount));
                var task = BackgroundTaskService.StartApiEngine(
                    DatabaseBackupService.RequiredOsClient,
                    userId,
                    "数据库定时备份",
                    new JObject
                    {
                        ["ApiEngineKey"] = DatabaseBackupService.WorkerApiEngineKey,
                        ["TriggerType"] = "Scheduled",
                        ["RetainCount"] = retainCount
                    },
                    trustedUser);
                return new DosResult(1, new
                {
                    TaskId = task.Id,
                    task.Status,
                    task.StatusText
                }, "数据库定时备份已进入后台任务队列。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "投递数据库定时备份失败：" + ex.Message);
            }
        }

        private static EmptyDatabaseReleaseRequest ParseEmptyDatabaseReleaseRequest(object dynamicParam)
        {
            var param = JsonHelper.ToJObject(dynamicParam) ?? new JObject();
            var currentUser = param["CurrentUser"] as JObject
                              ?? param["_CurrentUser"] as JObject
                              ?? new JObject();
            string osClient = param["OsClient"]?.ToString() ?? "";
            string backgroundTaskId = param["_BackgroundTaskId"]?.ToString()
                                      ?? param["BackgroundTaskId"]?.ToString()
                                      ?? param["TaskId"]?.ToString()
                                      ?? "";
            return new EmptyDatabaseReleaseRequest
            {
                Param = param,
                CurrentUser = currentUser,
                OsClient = osClient,
                Service = new EmptyDatabaseReleaseService(backgroundTaskId)
            };
        }

        private sealed class EmptyDatabaseReleaseRequest
        {
            public JObject Param { get; set; }
            public JObject CurrentUser { get; set; }
            public string OsClient { get; set; }
            public EmptyDatabaseReleaseService Service { get; set; }
        }

        /// <summary>
        /// 扩展 V8.Method.TestExtend 方法
        /// </summary>
        /// <param name="testParam"></param>
        /// <returns></returns>
        public string TestExtend(string testParam)
        {
            return "V8.Method.TestExtend：" + testParam;
        }
        /// <summary>
        /// 测试故意抛出异常
        /// </summary>
        /// <param name="testParam"></param>
        /// <returns></returns>
        public JObject TestException()
        {
            return JObject.FromObject(null);
        }
        /// <summary>
        /// 生成新的 GUID 字符串，强烈建议使用 NewUlid 方法替代 GUID，Ulid 具有更好的排序性和更短的字符串长度
        /// </summary>
        /// <returns></returns>
        public string NewGuid()
        {
            return Guid.NewGuid().ToString();
        }
        /// <summary>
        /// 生成新的 ULID 字符串，推荐使用 ULID 替代 GUID，ULID 具有更好的排序性和更短的字符串长度，非常适合用作数据库主键
        /// </summary>
        /// <returns></returns>
        public string NewUlid()
        {
            return Ulid.NewUlid().ToString();
        }

        #region 加密签名辅助函数

        /// <summary>
        /// HMAC-SHA1 签名（返回 Base64 编码）
        /// 用于解决 Jint 无法直接实例化 HMACSHA1 的问题
        /// </summary>
        /// <param name="data">待签名的数据</param>
        /// <param name="key">签名密钥</param>
        /// <returns>Base64 编码的签名字符串</returns>
        public string HmacSha1Sign(string data, string key)
        {
            using (var hmac = new HMACSHA1(Encoding.UTF8.GetBytes(key)))
            {
                var hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
                return Convert.ToBase64String(hashBytes);
            }
        }

        /// <summary>
        /// HMAC-SHA256 签名（返回 Base64 编码）
        /// </summary>
        /// <param name="data">待签名的数据</param>
        /// <param name="key">签名密钥</param>
        /// <returns>Base64 编码的签名字符串</returns>
        public string HmacSha256Sign(string data, string key)
        {
            using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key)))
            {
                var hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
                return Convert.ToBase64String(hashBytes);
            }
        }

        /// <summary>
        /// MD5 签名（返回 Base64 编码）
        /// </summary>
        /// <param name="data">待签名的数据</param>
        /// <returns>Base64 编码的 MD5 字符串</returns>
        public string Md5Sign(string data)
        {
            using (var md5 = MD5.Create())
            {
                var hashBytes = md5.ComputeHash(Encoding.UTF8.GetBytes(data));
                return Convert.ToBase64String(hashBytes);
            }
        }

        /// <summary>
        /// MD5 签名（返回十六进制字符串）
        /// </summary>
        /// <param name="data">待签名的数据</param>
        /// <returns>十六进制 MD5 字符串</returns>
        public string Md5SignHex(string data)
        {
            using (var md5 = MD5.Create())
            {
                var hashBytes = md5.ComputeHash(Encoding.UTF8.GetBytes(data));
                return BitConverter.ToString(hashBytes).Replace("-", "").ToLower();
            }
        }

        #endregion

        #region JSON 序列化函数

        /// <summary>
        /// JSON 序列化（解决 Jint 的 JSON.stringify 将整数转为浮点格式的问题）
        /// 使用 Newtonsoft.Json 进行序列化，保持整数格式
        /// </summary>
        /// <param name="obj">待序列化的对象</param>
        /// <returns>JSON 字符串</returns>
        public string JsonStringify(object obj)
        {
            return JsonConvert.SerializeObject(obj, new JsonSerializerSettings
            {
                // 不格式化输出（紧凑格式）
                Formatting = Formatting.None,
                // 忽略 null 值
                NullValueHandling = NullValueHandling.Ignore,
                // 保持默认值
                DefaultValueHandling = DefaultValueHandling.Include
            });
        }

        /// <summary>
        /// JSON 序列化（带格式化）
        /// </summary>
        /// <param name="obj">待序列化的对象</param>
        /// <returns>格式化的 JSON 字符串</returns>
        public string JsonStringifyIndented(object obj)
        {
            return JsonConvert.SerializeObject(obj, Formatting.Indented);
        }

        #endregion
    }
}
