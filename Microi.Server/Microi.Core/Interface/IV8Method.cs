using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

using Dos.ORM;

namespace Microi.net
{
    /// <summary>
    /// V8引擎内置方法/函数接口
    /// </summary>
    public interface IV8Method
    {
        /// <summary>
        /// 重新加载指定 OsClient 的 SaaS 引擎配置
        /// </summary>
        DosResult ReloadOsClient(string osClient, DbTrans _trans = null);

        /// <summary>
        /// Clear all Redis cache keys for a tenant and remove its SaaS config cache.
        /// </summary>
        DosResult ClearTenantCache(string osClient);

        /// <summary>
        /// 解析查询条件
        /// </summary>
        List<DiyWhere> ParseWhere(object whereParam);

        /// <summary>
        /// 获取客户端IP地址
        /// </summary>
        DosResult<string> GetClientIP();

        /// <summary>
        /// 设置系统用户角色信息
        /// </summary>
        JObject SetSysUserRoleInfo(dynamic userModel, string osClient);

        /// <summary>
        /// 刷新登录用户身份信息，token以旧换新
        /// </summary>
        DosResult<dynamic> RefreshLoginUser(string userId, string osClient = null);

        /// <summary>
        /// 清除指定用户全部终端的登录信息，立即吊销所有 Token。仅系统管理员可调用。
        /// </summary>
        DosResult ClearUserLoginInfo(string userId, string osClient = null);

        /// <summary>
        /// 获取当前token
        /// </summary>
        CurrentToken GetCurrentToken(string token = null, string osClient = null);

        /// <summary>
        /// 动态参数转换为上传参数
        /// </summary>
        DiyUploadParam DynamicToDiyUploadParam(dynamic dynamicParam);

        /// <summary>
        /// 获取私有文件地址
        /// </summary>
        DosResult GetPrivateFileUrl(dynamic dynamicParam);

        /// <summary>
        /// 上传文件
        /// </summary>
        DosResult Upload(dynamic dynamicParam);

        /// <summary>
        /// 创建受限的内存 ZIP，供 V8 脚本安全打包应用资产。
        /// </summary>
        DosResult CreateZip(dynamic dynamicParam);

        /// <summary>
        /// 安全解压内存 ZIP，包含路径穿越与解压炸弹防护。
        /// </summary>
        DosResult ExtractZip(dynamic dynamicParam);

        /// <summary>
        /// 移动 HDFS 文件到指定完整路径。用于发布类接口引擎生成稳定对象地址。
        /// </summary>
        DosResult MoveObject(dynamic dynamicParam);

        /// <summary>
        /// 获取访问token
        /// </summary>
        DosResult<CurrentToken> GetAccessToken(dynamic dynamicParam);

        /// <summary>
        /// 获取当前时间戳
        /// </summary>
        long GetTimestamp();

        /// <summary>
        /// 动态参数转换为系统日志参数
        /// </summary>
        SysLogParam DynamicToSysLogParam(dynamic dynamicParam);

        /// <summary>
        /// 添加系统日志
        /// </summary>
        DosResult AddSysLog(dynamic dynamicParam);

        /// <summary>
        /// 更新当前后台任务的进度。接口引擎可选调用，不影响普通同步执行。
        /// </summary>
        DosResult UpdateBackgroundTask(dynamic dynamicParam);

        /// <summary>
        /// 仅供主租户超级管理员重建并复制 microi_empty_temp。
        /// </summary>
        DosResult PrepareEmptyDatabaseRelease(dynamic dynamicParam);

        /// <summary>
        /// 在固定目标库执行接口引擎提供的脱敏 SQL，并完成安全校验。
        /// </summary>
        DosResult ApplyEmptyDatabaseSanitization(dynamic dynamicParam);

        /// <summary>
        /// 导出、压缩并发布已脱敏的固定目标库。
        /// </summary>
        DosResult PublishEmptyDatabaseRelease(dynamic dynamicParam);

        /// <summary>
        /// 清理固定临时空数据库，供接口引擎异常补偿使用。
        /// </summary>
        DosResult CleanupEmptyDatabaseRelease(dynamic dynamicParam);
    }
}
