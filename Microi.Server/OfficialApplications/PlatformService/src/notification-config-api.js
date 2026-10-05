export function createNotificationConfigClient(configure) {
  return async function run(Action, params = {}) {
    const sdk=configure(), url='/apiengine/platform-message-notification-config';
    const raw=typeof sdk.Http?.Post==='function'
      ? await sdk.Http.Post({Url:url,PostParam:{...params,Action},ParamType:'json',Timeout:20})
      : await sdk.post(url,{...params,Action},{timeout:20000});
    const result=typeof raw==='string'?JSON.parse(raw):raw;
    if(Number(result?.Code)!==1)throw new Error(result?.Msg||'操作失败，请更新消息通知应用后重试。');
    return result;
  };
}
