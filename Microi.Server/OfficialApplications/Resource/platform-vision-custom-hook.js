/* TENANT_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1
 * 所属官方应用：视觉引擎
 * ApiEngineKey：platform-vision-custom-hook
 * 此接口属于租户扩展点，官方应用仅在 Key 不存在时创建，后续安装/升级不会覆盖租户代码。
 * Hook 只接收阶段、动作、请求/样本编号、模式、状态、来源和对象 Id 等最小元数据；
 * 不接收图片、向量、AI 提示词、模型回答、人员姓名或其它生物识别内容。
 */

// Microi 租户视觉识别扩展 Hook
// Version: v1.0.0
var hookParam = V8.Param || {};
var hookStage = String(hookParam.Stage || 'Before');
var hookAction = String(hookParam.Action || 'Recognize');
var allowedStages = { Before: true, After: true };
var allowedActions = { Recognize: true, Enroll: true, AiFallback: true, Correct: true };
if (!allowedStages[hookStage]) return { Code: 0, Msg: '不支持的视觉 Hook 阶段。' };
if (!allowedActions[hookAction]) return { Code: 0, Msg: '不支持的视觉 Hook 动作。' };

// 在这里添加当前租户自己的日志、业务单据、称重联动或消息通知逻辑。
// 抛出异常或返回 Code!=1 会阻止 Before 阶段继续执行；After 阶段调用方只记录结果，不改变已完成识别事实。
return { Code: 1, Data: { Stage: hookStage, Action: hookAction } };
