export function createPlatformReminderClient(configure) {
  return async function run(Action, params = {}) {
    const sdk = configure(), url = '/apiengine/platform-reminder-runtime';
    const raw = typeof sdk.Http?.Post === 'function'
      ? await sdk.Http.Post({ Url: url, PostParam: { Action, ...params }, ParamType: 'json', Timeout: 20 })
      : await sdk.post(url, { Action, ...params }, { timeout: 20000 });
    const result = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Number(result?.Code) !== 1) throw new Error(result?.Msg || '操作失败，请确认平台和消息通知应用已更新。');
    return result;
  };
}
