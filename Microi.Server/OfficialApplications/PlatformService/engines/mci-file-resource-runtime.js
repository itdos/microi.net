/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 官方应用：系统日志/监控。Managed；ApiEngineKey: mci-file-resource-runtime
 * 从可信官方源安装、更新或重新安装将恢复本接口；本接口不承载租户自定义代码。
 */
/*
 * ApiEngineKey: mci-file-resource-runtime
 * Version: v1.0.0
 * 公有热点运行控制面：只传动作和应用身份，可信后端负责身份、完整日采集、复制与切流。
 * 不接受流量、摘要、Ready、Provider、URL或凭据。复制请求持久入队，禁止HTTP长时间传文件。
 */
var allowedActions = ['Capabilities', 'ProbeBackup', 'Collect', 'Status', 'List', 'Prepare', 'PinHistoricalHotspot', 'Disable', 'Enable'];
var action = String(V8.Param.Action || 'Status');
if (allowedActions.indexOf(action) < 0) return { Code: 0, Msg: 'UnknownOffloadAction' };
var allowed = ['Action', 'SourceTenant', 'AppKey', 'OsClient', 'ApiEngineKey', 'ApiAddress', '_InvokeType', '_Lang'];
var input = JSON.parse(JSON.stringify(V8.Param || {}));
if (Object.keys(input).some(function (key) { return allowed.indexOf(key) < 0; })) return { Code: 0, Msg: 'UnsupportedOffloadArgument' };
var request = { Action: action };
if (input.SourceTenant != null) request.SourceTenant = String(input.SourceTenant);
if (input.AppKey != null) request.AppKey = String(input.AppKey);
return V8.Method.ManagePublicResourceOffload(request);
