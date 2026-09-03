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
        /// 使用当前租户和当前接口引擎 Key 派生的服务端密钥加密敏感数据。
        /// 密钥永不进入 V8；密文只能由同租户、同接口引擎解密。
        /// </summary>
        string ProtectApiEngineSecret(string plainText);

        /// <summary>
        /// 解密由当前租户、当前接口引擎通过 ProtectApiEngineSecret 生成的密文。
        /// </summary>
        string UnprotectApiEngineSecret(string cipherText);

        /// <summary>
        /// 原子消费宿主为当前租户、当前 Managed ApiEngineKey 建立的一次性协议作用域。
        /// 不接受任何 V8 参数，租户脚本不能自行签发或重放。
        /// </summary>
        DosResult RequireManagedProtocolContext();

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
        /// 刷新当前租户的登录用户身份投影。显式 OsClient 仅作一致性断言；
        /// 普通用户只允许本人，同租户平台管理员经权威复核后才可跨用户。第三参
        /// 仅接受原始 Token，并由宿主重新权威验证其用户和租户。
        /// </summary>
        DosResult<dynamic> RefreshLoginUser(
            string userId,
            string osClient = null,
            string token = null);

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
        /// 仅供官方 Managed 访问密钥接口执行创建、列表、吊销和匿名兑换原子。
        /// 明文密钥只在 Create 结果中返回一次；身份、租户、IP 与管理员边界由宿主重验。
        /// </summary>
        DosResult ManageUserAccessKey(dynamic dynamicParam);
        /// <summary>由官方 Managed 工作流接口调用的可信动作原子。</summary>
        DosResult ManageWorkFlow(dynamic dynamicParam);

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
        /// 仅供 app.microi.sso 的固定 Managed HTTP 端点调用可信 OIDC/SAML2/CAS
        /// 协议原子；返回已签名的 DataAppend.HttpResponse，普通 V8 无法伪造 Cookie。
        /// </summary>
        DosResult RunSsoProtocol(dynamic dynamicParam);

        /// <summary>
        /// 执行官方 Managed 接口引擎绑定的最小插件原子；RuntimeKey 与调用方
        /// ApiEngineKey 使用后端固定白名单校验，租户参数不能扩大调用权限。
        /// </summary>
        dynamic RunPlatformApiRuntime(dynamic dynamicParam);

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

        /// <summary>仅供官方启动接口按域名解析最小租户标识。</summary>
        DosResult ResolveOsClientByDomain(string domain);

        /// <summary>仅供官方启动接口读取浏览器安全的系统设置投影。</summary>
        DosResult GetPublicSysConfig(string lang = null);

        /// <summary>读取当前租户的语言词条包。</summary>
        DosResult GetLangBundle(string lang = null, string prefix = "Msg.");

        /// <summary>仅供官方登录壁纸接口读取固定、启用且有界的公开投影。</summary>
        DosResult GetLoginWallpapers();

        /// <summary>
        /// 仅供官方 microi-init 兼容门面：重验请求体原始 DiyToken，并按该用户
        /// 当前角色生成租户内菜单树。不能作为普通接口引擎的通用菜单查询能力。
        /// </summary>
        DosResult GetLegacyInitMenuTree(string token, string osClient = null);

        /// <summary>按当前用户完整业务上下文签发私有文件审计代理地址。</summary>
        DosResult GetAuthorizedPrivateFileUrl(dynamic dynamicParam);

        /// <summary>在租户开通 Before Hook 前校验可信主租户登录身份。</summary>
        DosResult AuthorizeCurrentUserTenantProvisioning();

        /// <summary>仅供官方租户开通接口按可信当前用户创建其 SaaS 租户。</summary>
        DosResult ProvisionCurrentUserTenant(dynamic dynamicParam);

        /// <summary>仅供主租户超级管理员保留数据修复子租户DatabaseOnly连接。</summary>
        DosResult RepairAdminTenantDatabaseAccess(dynamic dynamicParam);

        /// <summary>仅供官方 Managed 后台工作器幂等升级精确选中的子租户数据库。</summary>
        DosResult UpgradeAdminTenantDatabase(dynamic dynamicParam);

        /// <summary>
        /// 仅供官方 Managed 精确域名绑定接口校验可信主租户平台管理员。
        /// </summary>
        DosResult AuthorizeAdminTenantDomainBinding();

        /// <summary>
        /// 仅供 iTdos 官方运营 Managed 接口校验可信平台管理员。
        /// </summary>
        DosResult AuthorizeExternalSaasTenantDomainBinding();

        /// <summary>仅供官方个人资料接口校验可信目标用户和租户头像路径。</summary>
        DosResult PrepareCurrentUserProfileUpdate(dynamic dynamicParam);

        /// <summary>仅供官方系统账号 Managed 接口执行可信账号管理原子。</summary>
        dynamic ManageSysUserAdmin(dynamic dynamicParam);

        /// <summary>
        /// 仅供官方升级资源接口执行发布控制面授权：固定接口、固定官方租户、
        /// 拒绝访问密钥，并从主库复核当前平台管理员身份。
        /// </summary>
        DosResult AuthorizeOfficialResourcePublish();

        /// <summary>校验官方租户私有设置接口的管理员身份、Key 和非 Secret 边界。</summary>
        DosResult ValidateTenantSystemSettingsOperation(dynamic dynamicParam);

        /// <summary>返回租户私有设置的最小 Secret 状态与迁移 Key 投影，不含任何值或密文。</summary>
        DosResult GetTenantSystemSettingsSecurityProjection();

        /// <summary>
        /// 读取当前租户公有或私有桶中的受控 UTF-8 文本文件。
        /// </summary>
        DosResult GetPrivateFileText(dynamic dynamicParam);

        /// <summary>
        /// 上传文件
        /// </summary>
        DosResult Upload(dynamic dynamicParam);

        /// <summary>
        /// 将 UTF-8 文本直接上传到当前租户 HDFS，避免 V8 先转换为 Base64。
        /// </summary>
        DosResult UploadText(dynamic dynamicParam);

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
        /// 获取当前后端运行程序集的发行版本号。
        /// </summary>
        string GetBackendVersion();

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
        /// 仅供官方 Managed 接口运行数据源：固定当前租户与可信用户，
        /// 并继续执行访问密钥的数据源白名单校验。
        /// </summary>
        dynamic RunDataSourceEngine(dynamic dynamicParam);

        /// <summary>
        /// 仅供官方 Managed 接口运行模块查询：动作采用白名单，身份、租户和
        /// Client 调用标记由可信宿主写入，不能由浏览器覆盖。
        /// </summary>
        dynamic RunModuleEngine(dynamic dynamicParam);

        /// <summary>
        /// 仅供官方 Managed 文件响应接口按模板导出 Word；读取权限在宿主中
        /// 重新校验，接口引擎只负责可升级编排和文件响应。
        /// </summary>
        DosResult ExportWordByTemplate(dynamic dynamicParam);

        /// <summary>
        /// 仅供官方 Managed 接口记录白名单内的客户端行为信号；会话、终端、
        /// 租户与用户均从可信 DiyToken 上下文解析。
        /// </summary>
        DosResult TrackUserBehavior(dynamic dynamicParam);

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
        /// 查询或控制当前租户 Quartz 运行态。接口引擎负责表数据与状态编排；
        /// 原子能力固定租户并拒绝自定义 DLL/类型加载。
        /// </summary>
        DosResult ManageScheduleJob(dynamic dynamicParam);

        /// <summary>
        /// 更新当前后台任务的进度。接口引擎可选调用，不影响普通同步执行。
        /// </summary>
        DosResult UpdateBackgroundTask(dynamic dynamicParam);

        /// <summary>
        /// 对当前登录用户的持久后台任务执行受限原子操作。动作编排由官方接口引擎完成；
        /// 该方法只暴露 V8 无法直接访问的任务运行时，并始终从可信上下文解析租户和身份。
        /// </summary>
        DosResult ManageBackgroundTask(dynamic dynamicParam);

        /// <summary>
        /// 当前租户超级管理员执行受限缓存/Redis 管理原子操作；
        /// 连接密钥、租户身份和任意命令边界不暴露给接口引擎。
        /// </summary>
        DosResult ManageCache(dynamic dynamicParam);

        /// <summary>
        /// 查询当前用户可信终端快照，或由超级管理员踢出指定实时连接。
        /// SignalR/令牌运行时不直接暴露给接口引擎。
        /// </summary>
        DosResult ManageOnlineTerminal(dynamic dynamicParam);

        /// <summary>
        /// 仅供消息通知官方 Managed 接口发送微信公众号模板消息。
        /// 公众号 AppId/AppSecret 固定从当前租户 wx_mp 读取，绝不接受或返回密钥参数。
        /// </summary>
        DosResult SendWeChatTemplateMessage(dynamic dynamicParam);

        /// <summary>当前租户超级管理员查询或发布 MQTT；Broker 实例不直接暴露给 V8。</summary>
        DosResult ManageMq(dynamic dynamicParam);
        DosResult ManageMqtt(dynamic dynamicParam);

        /// <summary>当前租户超级管理员调用搜索插件的受限索引与查询原子能力。</summary>
        DosResult ManageSearchEngine(dynamic dynamicParam);

        /// <summary>调用 AI 插件的工作流图谱原子能力；动作编排由官方接口引擎完成。</summary>
        DosResult ManageAiWorkflow(dynamic dynamicParam);

        /// <summary>
        /// 调用 AI 平台的密钥、额度、供应商协议、任务句柄与媒体落盘受信原子；
        /// 套餐、订阅和订单等普通业务编排由官方 Managed 接口引擎完成。
        /// </summary>
        DosResult ManageAiPlatform(dynamic dynamicParam);

        /// <summary>
        /// 使用当前租户后端私有配置生成腾讯 IM UserSig；Secret 不接受前端或 V8 参数。
        /// </summary>
        DosResult GenerateTencentImUserSig(dynamic dynamicParam);
        dynamic ManageSystemDirectory(dynamic dynamicParam);

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
