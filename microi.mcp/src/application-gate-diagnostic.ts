import type { ApiResponse } from './microi-client.js';

export const APPLICATION_GATE_RECOVERY = '保持用户指定的当前子租户 MCP、ApiBase 和 OsClient。此错误是应用发布门禁取数/配置故障，不能据业务库 sys_osclients 为空推断主控登记缺失；不要索要主租户账号、切换 profile、调用补登记接口或绕过门禁。请向平台提交当前租户三参数、后端版本与原始错误，核查 SaaS 主控库来源及后端修复。';

/** Decorate old and new API failures without changing authentication or retry policy. */
export function withApplicationGateDiagnostic<T>(
  result: ApiResponse<T>,
  binding: { osClient?: string; apiBaseUrl: string },
): ApiResponse<T> {
  const data = result.Data && typeof result.Data === 'object'
    ? result.Data as Record<string, unknown> : {};
  const unavailable = data.ApplicationAssetStreamGateReady === false;
  const rowFailure = result.Code !== 1 && /sys_osclients[^\r\n]*门禁[^\r\n]*Actual=\d+/u.test(result.Msg || '');
  if (!unavailable && !rowFailure) return result;
  const diagnostic = {
    ReasonCode: 'APPLICATION_STREAM_GATE_UNAVAILABLE',
    Hint: APPLICATION_GATE_RECOVERY,
    BoundOsClient: binding.osClient || '',
    BoundApiBase: binding.apiBaseUrl,
    RequiresMainTenantLogin: false,
    RegistrationMissingProven: false,
  };
  return {
    ...result,
    ...(unavailable ? { Data: { ...data, ApplicationAssetStreamGateDiagnostic: diagnostic } as T } : {}),
    ...(rowFailure ? { Msg: `${result.Msg}\n${APPLICATION_GATE_RECOVERY}` } : {}),
    DataAppend: { ...result.DataAppend, ...diagnostic },
  };
}
