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
        /// 在当前事务提交成功后刷新当前租户的 V8.Dbs 扩展数据库缓存；
        /// 无事务时立即刷新。用于 microi_database 的后端提交后事件。
        /// </summary>
        DosResult RefreshExtensionDatabases(string osClient = null);

        /// <summary>
        /// Clear all Redis cache keys for a tenant and remove its SaaS config cache.
        /// </summary>
        DosResult ClearTenantCache(string osClient);

        /// <summary>
        /// 读取服务端统一维护的平台表直连授权策略，供受信任的角色表单事件校验。
        /// </summary>
        DosResult GetDirectTableGrantPolicies();

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
        /// 一次性消费由 Passkey、设备生物识别或严格人脸验证签发的二次认证票据。
        /// 票据与当前用户、租户、Purpose 和 ActionHash 绑定，不能重复使用。
        /// </summary>
        DosResult ConsumeIdentityVerificationTicket(dynamic dynamicParam);

        /// <summary>
        /// 仅供 app.microi.sso 的 Managed 身份解析引擎创建最小权限 JIT 用户。
        /// 密码哈希、角色存在性与禁止创建平台管理员均由可信宿主强制执行。
        /// </summary>
        DosResult CreateFederatedUser(dynamic dynamicParam);

        /// <summary>
        /// 仅供 SSO 兼容引擎在外部身份验证完成后签发短期一次性登录票据。
        /// </summary>
        DosResult CreateSsoLoginTicket(dynamic dynamicParam);

        /// <summary>
        /// 原子消费 SSO 一次性票据并签发平台唯一会话 DiyToken。
        /// </summary>
        DosResult CompleteSsoLogin(dynamic dynamicParam);

        /// <summary>
        /// 平台管理员轮换 OIDC 客户端密钥；明文只在本次结果中返回一次。
        /// </summary>
        DosResult RotateSsoClientSecret(dynamic dynamicParam);

        /// <summary>
        /// 仅供 SaaS 身份应用原子校验并消费短信验证码，返回短期、一次性登录证明。
        /// </summary>
        DosResult CreatePlatformSmsProof(dynamic dynamicParam);

        /// <summary>
        /// 仅供持有有效短信证明的 Managed 身份引擎创建 PBKDF2 用户。
        /// </summary>
        DosResult CreatePlatformSmsUser(dynamic dynamicParam);

        /// <summary>
        /// 原子消费短信证明并为证明绑定的已启用用户签发 DiyToken。
        /// </summary>
        DosResult CompletePlatformSmsLogin(dynamic dynamicParam);

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

        /// <summary>超级管理员按 W3C TraceId 查询当前租户的跨月时间线。</summary>
        DosResult GetTraceTimeline(dynamic dynamicParam);

        /// <summary>只读生成当前租户系统日志生命周期物理计划。</summary>
        DosResult PlanSystemLogLifecycle(dynamic dynamicParam);

        /// <summary>仅持久后台任务可执行的日志归档、回读与条件删除原子能力。</summary>
        DosResult RunSystemLogLifecycle(dynamic dynamicParam);

        /// <summary>
        /// 超级管理员从当前租户 SCIM 目录读取一页净化后的 Users/Groups；
        /// 凭据只在可信宿主解密，永不返回 V8。
        /// </summary>
        DosResult ReadIdentityDirectoryPage(dynamic dynamicParam);

        /// <summary>
        /// 使用 FormEngine 真实授权边界解释用户对表、菜单、动作和可选样例行的决策。
        /// </summary>
        DosResult ExplainAuthorizationDecision(dynamic dynamicParam);

        /// <summary>查询当前租户受限系统日志窗口，只返回聚合信号与净化样例。</summary>
        DosResult QuerySystemLogSignal(dynamic dynamicParam);

        /// <summary>
        /// 平台管理员读取当前节点运行快照、系统日志和安全防护状态。
        /// 该方法只提供宿主/Mongo/进程等接口引擎无法直接访问的只读原子能力。
        /// </summary>
        DosResult GetSystemObservability(dynamic dynamicParam);

        /// <summary>
        /// 平台管理员执行受限的 IP 封禁/解封；租户、操作者和审计字段均由可信后端决定。
        /// </summary>
        DosResult ManageSystemObservability(dynamic dynamicParam);

        /// <summary>
        /// 返回当前用户“我的工作”统一统计。宿主并行执行独立计数并复用强类型
        /// 抄送读取逻辑，接口引擎仅负责缓存与展示编排。
        /// </summary>
        DosResult GetCurrentUserWorkflowStats();

        /// <summary>
        /// 当前租户超级管理员幂等保存接口引擎定时任务；Quartz 与元数据均完成回读后才成功。
        /// </summary>
        DosResult SaveScheduleJob(dynamic dynamicParam);

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

        /// <summary>
        /// 超级管理员执行全部 SaaS MySQL 数据库串行备份；结果不包含私有文件地址。
        /// </summary>
        DosResult RunDatabaseBackup(dynamic dynamicParam);

        /// <summary>
        /// 固定 Quartz 任务将定时备份投递到右上角后台任务中心。
        /// </summary>
        DosResult QueueScheduledDatabaseBackup(dynamic dynamicParam);
    }
}
