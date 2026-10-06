/* OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1
 * 【租户个性化接口：官方升级不会覆盖】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-saas-promotion-hook
 * 此接口仅在首次安装时创建，之后归当前租户维护；官方更新或重新安装不得覆盖。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-saas-promotion-hook
 * Version: v1.0.3
 * Function:
 * - 租户可维护的推广扩展钩子，支持BeforeCreateLink、Assign、UpdateFollowup；不传递密码或基础设施秘密。
 */

/* CreateIfMissing tenant extension; SaaS promotion hook v1.0.0.
 * Event: BeforeCreateLink / Assign / UpdateFollowup. Data contains no credential or capability.
 * Return Code!=1 to reject. Existing tenant hook is preserved when the official app updates.
 */
return { Code : 1 };
