/*
 * V8 ApiEngine
 * ApiEngineKey: platform-saas-promotion-hook
 * Version: v1.0.2
 * Function:
 * - 租户可维护的推广扩展钩子，支持BeforeCreateLink、Assign、UpdateFollowup；不传递密码或基础设施秘密。
 */

/* CreateIfMissing tenant extension; SaaS promotion hook v1.0.0.
 * Event: BeforeCreateLink / Assign / UpdateFollowup. Data contains no credential or capability.
 * Return Code!=1 to reject. Existing tenant hook is preserved when the official app updates.
 */
return {Code:1};
